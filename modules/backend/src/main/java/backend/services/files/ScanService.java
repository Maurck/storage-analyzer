package backend.services.files;

import backend.enums.DirectoryType;
import backend.models.Directory;
import backend.models.ScanStatus;
import backend.models.ScanStatus.State;
import backend.resources.ApiException;
import jakarta.annotation.PreDestroy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/** Bounded, read-only scans. Completed snapshots are immutable and expanded on demand. */
@Service
public class ScanService {
    static final int MAX_ENTRIES = 250_000;
    static final int MAX_DEPTH = 512;
    static final int MAX_SESSIONS = 3;
    private static final long MAX_SNAPSHOT_BYTES = 256L * 1024 * 1024;
    private final ExecutorService executor;
    private final int maximumEntries;
    private final int maximumDepth;
    private final long maximumSnapshotBytes;
    // Guarded by the service monitor; includes active work and retained snapshots.
    private long retainedSnapshotBytes;
    private final LinkedHashMap<String, Session> sessions = new LinkedHashMap<>();

    public ScanService() {
        this(new ThreadPoolExecutor(2, 2, 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(2), runnable -> {
                    Thread thread = new Thread(runnable, "storage-scan");
                    thread.setDaemon(true);
                    return thread;
                }));
    }

    ScanService(ExecutorService executor) {
        this(executor, MAX_ENTRIES, MAX_DEPTH);
    }

    ScanService(ExecutorService executor, int maximumEntries, int maximumDepth) {
        this(executor, maximumEntries, maximumDepth, snapshotBudget(Runtime.getRuntime().maxMemory()));
    }

    ScanService(ExecutorService executor, int maximumEntries, int maximumDepth, long maximumSnapshotBytes) {
        if (maximumEntries < 1 || maximumDepth < 1 || maximumSnapshotBytes < 1) {
            throw new IllegalArgumentException("Scan resource limits must be positive.");
        }
        this.executor = executor;
        this.maximumEntries = maximumEntries;
        this.maximumDepth = maximumDepth;
        this.maximumSnapshotBytes = maximumSnapshotBytes;
    }

    static long snapshotBudget(long maximumHeapBytes) {
        // Leave headroom for Spring, traversal, response DTOs/JSON and garbage collection.
        return Math.min(MAX_SNAPSHOT_BYTES, maximumHeapBytes / 4);
    }

    static long estimatedEntryBytes(Path path) {
        // Conservative accounting, not an object-layout measurement. Include map/list
        // overhead and path strings/caches; long paths must not cost a single flat unit.
        return 512L + 4L * path.toString().length();
    }

    public ScanStatus start(String requestedPath) {
        // Filesystem metadata may block on network paths. Keep it outside the
        // session monitor so existing scans can still report progress or cancel.
        Path path = validateRoot(requestedPath);
        synchronized (this) {
            return startValidated(path);
        }
    }

    private ScanStatus startValidated(Path path) {
        if (sessions.values().stream().filter(session -> session.state == State.SCANNING).count() >= 2) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Two scans are already running. Cancel one or wait for completion.");
        }
        while (sessions.size() >= MAX_SESSIONS) {
            String oldest = sessions.values().stream().filter(session -> session.state != State.SCANNING)
                    .map(session -> session.id).findFirst().orElseThrow();
            evict(oldest);
        }
        Session session = new Session(path);
        sessions.put(session.id, session);
        try {
            if (executor instanceof ThreadPoolExecutor pool) pool.purge();
            session.future = executor.submit(() -> scan(session));
        } catch (RejectedExecutionException exception) {
            sessions.remove(session.id);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "The scanner is busy. Try again shortly.");
        }
        return snapshot(session);
    }

    public synchronized ScanStatus status(String id) {
        return snapshot(findSession(id));
    }

    public synchronized ScanStatus cancel(String id) {
        Session session = findSession(id);
        synchronized (session) {
            if (session.state == State.SCANNING) {
                session.state = State.CANCELLED;
                session.future.cancel(true);
            }
        }
        return snapshot(session);
    }

    public synchronized Directory directory(String id, String requestedPath) {
        Session session = findSession(id);
        if (session.state != State.COMPLETE) {
            throw new ApiException(HttpStatus.CONFLICT, "Directory details are available after the scan completes.");
        }
        Path path = parsePath(requestedPath);
        if (!path.startsWith(session.path)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The directory must belong to this scan.");
        }
        Entry entry = session.entries.get(path);
        if (entry == null) throw new ApiException(HttpStatus.NOT_FOUND, "This path was not found in the scan.");
        return toDirectory(entry, true);
    }

    private Session findSession(String id) {
        Session session = sessions.get(id);
        if (session == null) throw new ApiException(HttpStatus.NOT_FOUND, "This scan has expired or does not exist. Start a new scan.");
        return session;
    }

    public static Path validateRoot(String requestedPath) {
        Path path = parsePath(requestedPath);
        if (!Files.exists(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The selected folder does not exist.");
        }
        if (!Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(path)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Choose a folder, not a file or symbolic link.");
        }
        if (!Files.isReadable(path)) throw new ApiException(HttpStatus.FORBIDDEN, "The selected folder cannot be read.");
        return path;
    }

    private static Path parsePath(String value) {
        if (value == null || value.isBlank() || value.length() > 32_767) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter an absolute folder path.");
        }
        try {
            Path path = Path.of(value);
            if (!path.isAbsolute()) throw new ApiException(HttpStatus.BAD_REQUEST, "Enter an absolute folder path.");
            return path.normalize();
        } catch (InvalidPathException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The folder path is invalid.");
        }
    }

    private void scan(Session session) {
        try {
            Files.walkFileTree(session.path, EnumSet.noneOf(FileVisitOption.class), maximumDepth, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path path, BasicFileAttributes attributes) {
                    checkCancelled(session);
                    add(session, path, DirectoryType.FOLDER);
                    session.directories.incrementAndGet();
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path path, BasicFileAttributes attributes) {
                    checkCancelled(session);
                    if (!attributes.isRegularFile()) {
                        Entry entry = add(session, path, DirectoryType.ERROR);
                        entry.partial = true;
                        entry.error = attributes.isDirectory() ? "Maximum scan depth reached." : "Symbolic links and special files are excluded.";
                        session.skipped.incrementAndGet();
                    } else {
                        Entry entry = add(session, path, DirectoryType.FILE);
                        entry.sizeBytes = attributes.size();
                        entry.fileCount = 1;
                        session.files.incrementAndGet();
                        session.bytes.addAndGet(entry.sizeBytes);
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path path, IOException exception) {
                    checkCancelled(session);
                    Entry entry = add(session, path, DirectoryType.ERROR);
                    entry.partial = true;
                    entry.error = "This path could not be read. It may require permission or have moved.";
                    session.skipped.incrementAndGet();
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path path, IOException exception) {
                    checkCancelled(session);
                    Entry entry = session.entries.get(path);
                    if (exception != null) {
                        entry.partial = true;
                        entry.error = "Some items in this folder could not be read.";
                        session.skipped.incrementAndGet();
                    }
                    for (Entry child : entry.children) {
                        entry.sizeBytes += child.sizeBytes;
                        entry.fileCount += child.fileCount;
                        entry.directoryCount += child.directoryCount + (child.type == DirectoryType.FOLDER ? 1 : 0);
                        entry.partial |= child.partial;
                    }
                    entry.children.sort(Comparator.comparing((Entry child) -> child.type != DirectoryType.FOLDER)
                            .thenComparing(Comparator.comparingLong((Entry child) -> child.sizeBytes).reversed())
                            .thenComparing(child -> child.path.getFileName().toString(), String.CASE_INSENSITIVE_ORDER));
                    return FileVisitResult.CONTINUE;
                }
            });
            synchronized (session) {
                checkCancelled(session);
                Entry root = session.entries.get(session.path);
                if (root == null || root.type == DirectoryType.ERROR) {
                    session.error = "The selected folder could not be read.";
                    session.state = State.ERROR;
                } else {
                    session.state = State.COMPLETE;
                }
            }
        } catch (CancellationException exception) {
            synchronized (session) {
                session.state = State.CANCELLED;
            }
        } catch (OutOfMemoryError error) {
            // Best-effort terminal state, not a guarantee that the JVM can recover.
            // Use a constant message and release the working tree in finally.
            synchronized (session) {
                if (session.state != State.CANCELLED) {
                    session.error = "The scanner ran out of memory. Select a smaller folder or restart the local service and try again.";
                    session.state = State.ERROR;
                }
            }
        } catch (Exception exception) {
            synchronized (session) {
                if (session.state != State.CANCELLED) {
                    session.error = exception instanceof ScanLimitException ? exception.getMessage() : "The scan could not finish. Check folder access and try again.";
                    session.state = State.ERROR;
                }
            }
        } finally {
            // Never retain the HashMap backing array after cancellation or failure.
            // A cancelled worker can outlive session eviction; keep charging its
            // reservations until it actually stops using the working tree.
            synchronized (this) {
                if (session.state != State.COMPLETE) releaseEntries(session);
            }
        }
    }

    private Entry add(Session session, Path path, DirectoryType type) {
        Entry entry = addEntry(session, path, type);
        entryAdded();
        return entry;
    }

    /** Test seam: runs on the scan thread after each retained entry, outside the service monitor. */
    void entryAdded() { }

    /** Estimated bytes held by active work and retained snapshots. */
    synchronized long retainedSnapshotBytes() {
        return retainedSnapshotBytes;
    }

    private synchronized Entry addEntry(Session session, Path path, DirectoryType type) {
        checkCancelled(session);
        if (session.entries.size() >= maximumEntries) {
            throw new ScanLimitException("This scan exceeded the limit of " + maximumEntries + " items. Select a smaller folder.");
        }
        long requiredBytes = estimatedEntryBytes(path);
        while (requiredBytes > maximumSnapshotBytes - retainedSnapshotBytes) {
            String oldest = sessions.values().stream().filter(candidate -> candidate.state == State.COMPLETE)
                    .map(candidate -> candidate.id).findFirst().orElse(null);
            if (oldest == null) {
                throw new ScanLimitException("The scan reached the shared snapshot memory budget. Select a smaller folder or cancel another scan and try again.");
            }
            evict(oldest);
        }
        Entry entry = new Entry(path, type);
        session.entries.put(path, entry);
        session.retainedBytes += requiredBytes;
        retainedSnapshotBytes += requiredBytes;
        Entry parent = session.entries.get(path.getParent());
        if (parent != null) parent.children.add(entry);
        return entry;
    }

    private void evict(String id) {
        Session removed = sessions.remove(id);
        if (removed.state == State.COMPLETE) releaseEntries(removed);
    }

    private void releaseEntries(Session session) {
        retainedSnapshotBytes -= session.retainedBytes;
        session.retainedBytes = 0;
        session.entries = Map.of();
    }

    private static void checkCancelled(Session session) {
        if (session.state == State.CANCELLED || Thread.currentThread().isInterrupted()) throw new CancellationException();
    }

    private ScanStatus snapshot(Session session) {
        synchronized (session) {
            return new ScanStatus(session.id, session.path.toString(), session.state, session.files.get(),
                    session.directories.get(), session.bytes.get(), session.skipped.get(), session.error,
                    session.state == State.COMPLETE ? toDirectory(session.entries.get(session.path), true) : null);
        }
    }

    private Directory toDirectory(Entry entry, boolean includeChildren) {
        Path filename = entry.path.getFileName();
        Directory directory = new Directory(filename == null ? entry.path.toString() : filename.toString(), entry.path.toString(), entry.type);
        directory.setSizeBytes(entry.sizeBytes);
        directory.setFileCount(entry.fileCount);
        directory.setDirectoryCount(entry.directoryCount);
        directory.setHasChildren(!entry.children.isEmpty());
        directory.setChildrenLoaded(includeChildren || entry.type != DirectoryType.FOLDER);
        directory.setPartial(entry.partial);
        directory.setError(entry.error);
        if (includeChildren) directory.setSubdirectories(entry.children.stream().map(child -> toDirectory(child, false)).toList());
        return directory;
    }

    @PreDestroy
    public synchronized void close() {
        for (Session session : sessions.values()) {
            synchronized (session) {
                if (session.state == State.SCANNING) session.state = State.CANCELLED;
            }
            if (session.state == State.COMPLETE) releaseEntries(session);
        }
        sessions.clear();
        executor.shutdownNow();
    }

    private static final class Session {
        final String id = UUID.randomUUID().toString();
        final Path path;
        Map<Path, Entry> entries = new HashMap<>();
        long retainedBytes;
        final AtomicLong files = new AtomicLong();
        final AtomicLong directories = new AtomicLong();
        final AtomicLong bytes = new AtomicLong();
        final AtomicLong skipped = new AtomicLong();
        volatile State state = State.SCANNING;
        String error;
        Future<?> future;

        Session(Path path) { this.path = path; }
    }

    private static final class Entry {
        final Path path;
        final DirectoryType type;
        final List<Entry> children = new ArrayList<>();
        long sizeBytes;
        long fileCount;
        long directoryCount;
        boolean partial;
        String error;

        Entry(Path path, DirectoryType type) { this.path = path; this.type = type; }
    }

    private static final class ScanLimitException extends RuntimeException {
        ScanLimitException(String message) { super(message); }
    }
}
