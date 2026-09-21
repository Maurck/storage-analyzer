package backend.services.files;

import backend.enums.DirectoryType;
import backend.enums.FileCategory;
import backend.enums.FileOrder;
import backend.enums.NodeIssueCode;
import backend.enums.ScanErrorCode;
import backend.models.Ancestry;
import backend.models.Directory;
import backend.models.FileSearch;
import backend.models.LargestFiles;
import backend.models.SkippedItems;
import backend.models.ScanStatus;
import backend.models.ScanStatus.State;
import backend.models.ScanStatus.Volume;
import backend.models.TypeBreakdown;
import backend.resources.ApiErrorCode;
import backend.resources.ApiException;
import jakarta.annotation.PreDestroy;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.function.Consumer;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/** Bounded, read-only scans. Completed snapshots are immutable and expanded on demand. */
@Service
public class ScanService {
    static final int MAX_DEPTH = 512;
    static final int MAX_SESSIONS = 3;
    /** Share of the JVM's maximum heap that snapshots may hold, by estimate. */
    static final double SNAPSHOT_HEAP_SHARE = 0.5;
    /** Path length used to turn the byte budget into an item count people can read. */
    static final int REFERENCE_PATH_LENGTH = 120;
    static final int MIN_ENTRIES = 100_000;
    static final int MAX_ENTRIES_CEILING = 50_000_000;
    /** Longest ranking any request may ask for; computed once per snapshot. */
    static final int MAX_RANKED_FILES = 500;
    /** Skipped items listed per snapshot; the count beyond it is still reported. */
    static final int MAX_RECORDED_SKIPS = 10_000;
    /** Longest page of search results, and how far into the matches pages may reach. */
    static final int MAX_SEARCH_PAGE = 100;
    static final int MAX_SEARCH_WINDOW = 10_000;
    static final int MAX_QUERY_LENGTH = 1_024;
    /** Extensions listed per category of a breakdown; the rest are only counted. */
    static final int MAX_BREAKDOWN_EXTENSIONS = 10;
    /** A modification time the file system did not report. */
    static final long UNKNOWN_TIME = Long.MIN_VALUE;
    /** Largest first; equal sizes by path so the order never depends on hashing. */
    private static final Comparator<Entry> SIZE_ORDER = Comparator.comparingLong((Entry entry) -> entry.sizeBytes)
            .reversed().thenComparing(entry -> entry.path.toString());
    /** Files with a known time first, then by time; size and path settle ties. */
    private static final Comparator<Entry> KNOWN_TIME_FIRST = Comparator.comparing((Entry entry) -> entry.modifiedMillis == UNKNOWN_TIME);
    private static final Comparator<Entry> OLDEST_ORDER = KNOWN_TIME_FIRST
            .thenComparingLong((Entry entry) -> entry.modifiedMillis).thenComparing(SIZE_ORDER);
    private static final Comparator<Entry> NEWEST_ORDER = KNOWN_TIME_FIRST
            .thenComparing(Comparator.comparingLong((Entry entry) -> entry.modifiedMillis).reversed()).thenComparing(SIZE_ORDER);
    private final ExecutorService executor;
    private final int maximumEntries;
    private final int maximumDepth;
    private final long maximumSnapshotBytes;
    // Guarded by the service monitor; includes active work and retained snapshots.
    private long retainedSnapshotBytes;
    private final LinkedHashMap<String, Session> sessions = new LinkedHashMap<>();
    // Not final so tests can lower it without creating thousands of files.
    int maximumRecordedSkips = MAX_RECORDED_SKIPS;

    /** What this computer can hold, derived from the heap the JVM was given. */
    public record Capacity(long maxHeapBytes, long snapshotBudgetBytes, int maxEntries, int referencePathLength) { }

    /**
     * What a file must satisfy to match a search; every criterion applies at once.
     *
     * @param category       null for any
     * @param extension      with or without its dot, in any case; null or blank for any
     * @param modifiedFrom   inclusive; null for no lower bound
     * @param modifiedBefore exclusive; null for no upper bound. A file whose time is unknown
     *                       never matches a date bound.
     */
    public record FileFilter(String query, long minSizeBytes, FileCategory category, String extension,
                             Instant modifiedFrom, Instant modifiedBefore) {
        public static FileFilter of(String query, long minSizeBytes) {
            return new FileFilter(query, minSizeBytes, null, null, null, null);
        }
    }

    public ScanService() {
        this(new ThreadPoolExecutor(2, 2, 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(2), runnable -> {
                    Thread thread = new Thread(runnable, "storage-scan");
                    thread.setDaemon(true);
                    return thread;
                }), capacityFor(Runtime.getRuntime().maxMemory()));
    }

    private ScanService(ExecutorService executor, Capacity capacity) {
        this(executor, capacity.maxEntries(), MAX_DEPTH, capacity.snapshotBudgetBytes());
    }

    ScanService(ExecutorService executor) {
        this(executor, capacityFor(Runtime.getRuntime().maxMemory()));
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

    /**
     * The JVM sizes its heap from the machine's memory (a quarter of it unless -Xmx
     * says otherwise), so limits derived from it follow the computer running the app.
     */
    static Capacity capacityFor(long maximumHeapBytes) {
        long budget = snapshotBudget(maximumHeapBytes);
        long entries = budget / estimatedEntryBytes("x".repeat(REFERENCE_PATH_LENGTH));
        int maxEntries = (int) Math.max(MIN_ENTRIES, Math.min(MAX_ENTRIES_CEILING, entries));
        return new Capacity(maximumHeapBytes, budget, maxEntries, REFERENCE_PATH_LENGTH);
    }

    static long snapshotBudget(long maximumHeapBytes) {
        // Estimates carry a ~30% margin, so this keeps well over half of the heap for
        // Spring, the traversal, response DTOs/JSON and garbage collection.
        return (long) (Math.max(0, maximumHeapBytes) * SNAPSHOT_HEAP_SHARE);
    }

    static long estimatedEntryBytes(Path path) {
        return estimatedEntryBytes(path.toString());
    }

    static long estimatedEntryBytes(String path) {
        // Calibrated on JDK 17 with 40,801 entries at average path lengths of 62, 114 and
        // 234 characters: about 307 bytes plus one byte per character, measured after GC.
        // Keeping each file's modification time added exactly 8 bytes (40,021 entries at
        // 164 and 234 characters: 474.6 -> 482.6 and 540.2 -> 548.2), so about 315 now.
        // Characters outside Latin-1 make Java store the string in UTF-16, twice the size.
        // Both terms still carry a margin of about 27%.
        int tenthsPerChar = 13;
        for (int i = 0; i < path.length(); i++) {
            if (path.charAt(i) > 0xFF) {
                tenthsPerChar = 26;
                break;
            }
        }
        return 400L + (long) path.length() * tenthsPerChar / 10;
    }

    public Capacity capacity() {
        return new Capacity(Runtime.getRuntime().maxMemory(), maximumSnapshotBytes, maximumEntries, REFERENCE_PATH_LENGTH);
    }

    public ScanStatus start(String requestedPath) {
        // Filesystem metadata may block on network paths. Keep it outside the
        // session monitor so existing scans can still report progress or cancel.
        Path path = validateRoot(requestedPath);
        Volume volume = volumeOf(path);
        synchronized (this) {
            return startValidated(path, volume);
        }
    }

    /** Capacity of the volume holding the path, or null when the platform cannot tell. */
    static Volume volumeOf(Path path) {
        try {
            FileStore store = Files.getFileStore(path);
            long total = store.getTotalSpace();
            long usable = store.getUsableSpace();
            return total > 0 && usable >= 0 && usable <= total ? new Volume(total, usable) : null;
        } catch (IOException | SecurityException | UnsupportedOperationException exception) {
            return null;
        }
    }

    private ScanStatus startValidated(Path path, Volume volume) {
        if (sessions.values().stream().filter(session -> session.state == State.SCANNING).count() >= 2) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, ApiErrorCode.SCANS_AT_CAPACITY, "Two scans are already running. Cancel one or wait for completion.");
        }
        while (sessions.size() >= MAX_SESSIONS) {
            String oldest = sessions.values().stream().filter(session -> session.state != State.SCANNING)
                    .map(session -> session.id).findFirst().orElseThrow();
            evict(oldest);
        }
        Session session = new Session(path, volume);
        sessions.put(session.id, session);
        try {
            if (executor instanceof ThreadPoolExecutor pool) pool.purge();
            session.future = executor.submit(() -> scan(session));
        } catch (RejectedExecutionException exception) {
            sessions.remove(session.id);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, ApiErrorCode.SCANNER_BUSY, "The scanner is busy. Try again shortly.");
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
                session.end(State.CANCELLED);
                session.future.cancel(true);
            }
        }
        return snapshot(session);
    }

    // Queries below read a completed snapshot outside the service monitor: it never
    // changes once published, and the monitor stays free for the progress and
    // cancellation of other scans while a query walks millions of entries.

    public Directory directory(String id, String requestedPath) {
        Snapshot snapshot = completedSnapshot(id);
        return toDirectory(findEntry(snapshot, requestedPath), true);
    }

    /** One node of a completed scan without its children, e.g. to confirm it belongs to the scan. */
    public Directory entry(String id, String requestedPath) {
        Snapshot snapshot = completedSnapshot(id);
        return toDirectory(findEntry(snapshot, requestedPath), false);
    }

    /**
     * An entry of a completed scan and the folders that lead to it, root first, each with
     * its direct children: only what a client needs to open the entry's folder.
     */
    public Ancestry ancestors(String id, String requestedPath) {
        Snapshot snapshot = completedSnapshot(id);
        Entry entry = findEntry(snapshot, requestedPath);
        LinkedList<Directory> ancestors = new LinkedList<>();
        for (Path path = entry.path; !path.equals(snapshot.session.path); ) {
            path = path.getParent();
            ancestors.addFirst(toDirectory(snapshot.entries.get(path), true));
        }
        return new Ancestry(snapshot.session.id, toDirectory(entry, false), List.copyOf(ancestors));
    }

    /**
     * The largest files of a completed scan. The first request ranks the snapshot once
     * with a bounded heap; later ones only filter that ranking.
     */
    public LargestFiles largest(String id, int limit, long minSizeBytes) {
        if (limit < 1 || limit > MAX_RANKED_FILES || minSizeBytes < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_PARAMETER,
                    "Ask for 1 to " + MAX_RANKED_FILES + " files and a minimum size of 0 bytes or more.");
        }
        Snapshot snapshot = completedSnapshot(id);
        Session session = snapshot.session;
        List<Entry> ranked;
        synchronized (this) {
            ranked = session.ranked;
        }
        if (ranked == null) {
            ranked = rank(snapshot.entries.values());
            synchronized (this) {
                // Kept only while its snapshot is; an evicted session must not hold it.
                if (session.entries == snapshot.entries) session.ranked = ranked;
            }
        }
        long matching = 0;
        for (Entry entry : snapshot.entries.values()) {
            if (entry.type == DirectoryType.FILE && entry.sizeBytes >= minSizeBytes) matching++;
        }
        List<LargestFiles.RankedFile> files = ranked.stream()
                .filter(entry -> entry.sizeBytes >= minSizeBytes)
                .limit(limit)
                .map(entry -> rankedFile(session, entry))
                .toList();
        return new LargestFiles(session.id, session.path.toString(), snapshot.root().partial,
                limit, minSizeBytes, matching, files);
    }

    /**
     * A page of the files under a folder of a completed scan, subfolders included, whose
     * path from the root contains the query, largest first. Every file under the scope is
     * filtered before the page is cut, so the count is exact and nothing depends on the
     * ranking's bounded list. Case and the kind of path separator are ignored.
     */
    public FileSearch search(String id, String query, String scopePath, long minSizeBytes, int offset, int limit) {
        return search(id, scopePath, FileFilter.of(query, minSizeBytes), FileOrder.LARGEST, offset, limit);
    }

    /**
     * A page of the files under a folder of a completed scan, subfolders included, that
     * satisfy every criterion of the filter, in the order asked for. See {@link FileFilter}.
     */
    public FileSearch search(String id, String scopePath, FileFilter filter, FileOrder order, int offset, int limit) {
        String needle = filter.query() == null ? "" : filter.query().strip();
        String extension = normalizedExtension(filter.extension());
        Instant from = filter.modifiedFrom(), before = filter.modifiedBefore();
        if (limit < 1 || limit > MAX_SEARCH_PAGE || offset < 0 || offset > MAX_SEARCH_WINDOW - limit
                || filter.minSizeBytes() < 0 || needle.length() > MAX_QUERY_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_PARAMETER,
                    "Ask for 1 to " + MAX_SEARCH_PAGE + " files within the first " + MAX_SEARCH_WINDOW
                            + " matches, a minimum size of 0 bytes or more and a query of at most "
                            + MAX_QUERY_LENGTH + " characters.");
        }
        if (from != null && before != null && !from.isBefore(before)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_PARAMETER,
                    "The start of the modification range must come before its end.");
        }
        Snapshot snapshot = completedSnapshot(id);
        Session session = snapshot.session;
        Entry scope = scopeOf(snapshot, scopePath);
        String root = session.path.toString();
        // Roots such as C:\ already end with a separator.
        int relativeStart = session.path.getNameCount() == 0 ? root.length() : root.length() + 1;
        long fromMillis = from == null ? UNKNOWN_TIME : clampedMillis(from);
        long beforeMillis = before == null ? UNKNOWN_TIME : clampedMillis(before);
        boolean byType = filter.category() != null || extension != null;
        int window = offset + limit;
        Comparator<Entry> sorted = switch (order) {
            case LARGEST -> SIZE_ORDER;
            case OLDEST -> OLDEST_ORDER;
            case NEWEST -> NEWEST_ORDER;
        };
        PriorityQueue<Entry> lastKept = new PriorityQueue<>(window + 1, sorted.reversed());
        long[] matching = {0};
        forEachFile(scope, entry -> {
            // Cheapest checks first; the name is read only when a type is asked for.
            if (entry.sizeBytes < filter.minSizeBytes()) return;
            if ((from != null || before != null) && (entry.modifiedMillis == UNKNOWN_TIME
                    || from != null && entry.modifiedMillis < fromMillis
                    || before != null && entry.modifiedMillis >= beforeMillis)) return;
            if (byType) {
                String own = FileTypes.extensionOf(name(entry.path));
                if (extension != null && !extension.equals(own)) return;
                if (filter.category() != null && FileTypes.categoryOf(own) != filter.category()) return;
            }
            if (!containsIgnoringCase(entry.path.toString(), relativeStart, needle)) return;
            matching[0]++;
            if (lastKept.size() < window) {
                lastKept.add(entry);
            } else if (sorted.compare(entry, lastKept.peek()) < 0) {
                lastKept.poll();
                lastKept.add(entry);
            }
        });
        List<Entry> kept = new ArrayList<>(lastKept);
        kept.sort(sorted);
        List<LargestFiles.RankedFile> files = kept.stream().skip(offset).map(entry -> rankedFile(session, entry)).toList();
        return new FileSearch(session.id, root, scope.path.toString(), scope.partial, needle, filter.minSizeBytes(),
                filter.category(), extension, from, before, order, offset, limit, matching[0], files);
    }

    /**
     * The files under a folder of a completed scan, subfolders included, grouped by the
     * category of their extension. Every file lands in exactly one category, so the
     * categories add up to the folder's size and file count.
     */
    public TypeBreakdown types(String id, String scopePath) {
        Snapshot snapshot = completedSnapshot(id);
        Session session = snapshot.session;
        Entry scope = scopeOf(snapshot, scopePath);
        EnumMap<FileCategory, long[]> categories = new EnumMap<>(FileCategory.class);
        Map<String, long[]> extensions = new HashMap<>();
        forEachFile(scope, entry -> {
            String extension = FileTypes.extensionOf(name(entry.path));
            add(categories.computeIfAbsent(FileTypes.categoryOf(extension), category -> new long[2]), entry);
            if (extension != null) add(extensions.computeIfAbsent(extension, key -> new long[2]), entry);
        });
        Comparator<long[]> largestFirst = Comparator.comparingLong((long[] total) -> total[0]).reversed()
                .thenComparing(Comparator.comparingLong((long[] total) -> total[1]).reversed());
        long totalBytes = 0, totalFiles = 0;
        List<TypeBreakdown.CategoryTotal> totals = new ArrayList<>();
        for (Map.Entry<FileCategory, long[]> category : categories.entrySet()) {
            List<Map.Entry<String, long[]>> own = extensions.entrySet().stream()
                    .filter(extension -> FileTypes.categoryOf(extension.getKey()) == category.getKey())
                    .sorted(Map.Entry.<String, long[]>comparingByValue(largestFirst).thenComparing(Map.Entry.comparingByKey()))
                    .toList();
            List<TypeBreakdown.ExtensionTotal> listed = own.stream().limit(MAX_BREAKDOWN_EXTENSIONS)
                    .map(extension -> new TypeBreakdown.ExtensionTotal(extension.getKey(), extension.getValue()[0], extension.getValue()[1]))
                    .toList();
            long[] total = category.getValue();
            totals.add(new TypeBreakdown.CategoryTotal(category.getKey(), total[0], total[1], own.size(), listed));
            totalBytes += total[0];
            totalFiles += total[1];
        }
        // Largest first; the enum order settles ties so the order never depends on hashing.
        totals.sort(Comparator.comparingLong(TypeBreakdown.CategoryTotal::sizeBytes).reversed()
                .thenComparing(Comparator.comparingLong(TypeBreakdown.CategoryTotal::fileCount).reversed())
                .thenComparing(TypeBreakdown.CategoryTotal::category));
        return new TypeBreakdown(session.id, session.path.toString(), scope.path.toString(), scope.partial,
                FileTypes.VERSION, totalBytes, totalFiles, List.copyOf(totals));
    }

    private static void add(long[] total, Entry file) {
        total[0] += file.sizeBytes;
        total[1]++;
    }

    /** The folder a query covers with its subfolders: the root when no path is given. */
    private static Entry scopeOf(Snapshot snapshot, String scopePath) {
        Entry scope = scopePath == null || scopePath.isBlank() ? snapshot.root() : findEntry(snapshot, scopePath);
        if (scope.type != DirectoryType.FOLDER) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.NOT_A_FOLDER, "Search within a folder of the scan, not a file.");
        }
        return scope;
    }

    /** Visits every file under a folder, depth first, outside the service monitor. */
    private void forEachFile(Entry scope, Consumer<Entry> visit) {
        ArrayDeque<Entry> pending = new ArrayDeque<>();
        pending.push(scope);
        while (!pending.isEmpty()) {
            Entry entry = pending.pop();
            searchStep();
            if (entry.type == DirectoryType.FOLDER) {
                for (Entry child : entry.children) pending.push(child);
            } else if (entry.type == DirectoryType.FILE) {
                visit.accept(entry);
            }
        }
    }

    /** Test seam: runs on the requesting thread for each entry a query visits, outside the service monitor. */
    void searchStep() { }

    /** An extension as the catalog spells it, or null for any; rejects what could never be one. */
    static String normalizedExtension(String requested) {
        if (requested == null || requested.isBlank()) return null;
        String extension = requested.strip();
        if (extension.startsWith(".")) extension = extension.substring(1);
        extension = extension.toLowerCase(Locale.ROOT);
        if (extension.isEmpty() || extension.length() > FileTypes.MAX_EXTENSION_LENGTH
                || extension.contains(".") || extension.contains("/") || extension.contains("\\")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_PARAMETER,
                    "An extension has 1 to " + FileTypes.MAX_EXTENSION_LENGTH + " characters and no dots or separators.");
        }
        return extension;
    }

    /** An ISO-8601 instant such as 2026-09-20T00:00:00Z, or null when absent. */
    public static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value.strip());
        } catch (DateTimeParseException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_PARAMETER,
                    "Dates are ISO-8601 instants in UTC, such as 2026-09-20T00:00:00Z.");
        }
    }

    /** Milliseconds since the epoch, saturated for instants a long cannot hold. */
    private static long clampedMillis(Instant instant) {
        try {
            return instant.toEpochMilli();
        } catch (ArithmeticException exception) {
            return instant.isBefore(Instant.EPOCH) ? UNKNOWN_TIME + 1 : Long.MAX_VALUE;
        }
    }

    /**
     * When a file was last written, or UNKNOWN_TIME. Windows and FAT store zero for a time
     * that was never set, which reads as 1601 or 1970; no file on a real disk predates 1980,
     * so nothing at or before the epoch is taken as a date.
     */
    static long modifiedMillis(FileTime time) {
        if (time == null) return UNKNOWN_TIME;
        long millis = time.toMillis();
        return millis > 0 ? millis : UNKNOWN_TIME;
    }

    private static Instant instantOf(long millis) {
        return millis == UNKNOWN_TIME ? null : Instant.ofEpochMilli(millis);
    }

    /** Whether {@code text}, from {@code from} on, contains {@code needle} ignoring case and separator kind. */
    static boolean containsIgnoringCase(String text, int from, String needle) {
        for (int start = from, last = text.length() - needle.length(); start <= last; start++) {
            int i = 0;
            while (i < needle.length() && sameCharacter(text.charAt(start + i), needle.charAt(i))) i++;
            if (i == needle.length()) return true;
        }
        return false;
    }

    private static boolean sameCharacter(char a, char b) {
        if (a == b) return true;
        if ((a == '/' || a == '\\') && (b == '/' || b == '\\')) return true;
        // Both directions, as String.regionMatches does, for scripts whose cases do not round-trip.
        char upperA = Character.toUpperCase(a), upperB = Character.toUpperCase(b);
        return upperA == upperB || Character.toLowerCase(upperA) == Character.toLowerCase(upperB);
    }

    private static LargestFiles.RankedFile rankedFile(Session session, Entry entry) {
        String name = name(entry.path);
        String extension = FileTypes.extensionOf(name);
        return new LargestFiles.RankedFile(name, entry.path.toString(),
                session.path.relativize(entry.path).toString(), entry.sizeBytes,
                instantOf(entry.modifiedMillis), extension, FileTypes.categoryOf(extension));
    }

    /** A page of the items a completed scan skipped or could not fully read, ordered by path. */
    public SkippedItems skipped(String id, int offset, int limit) {
        if (offset < 0 || limit < 1 || limit > 500) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_PARAMETER,
                    "Ask for 1 to 500 items from an offset of 0 or more.");
        }
        Snapshot snapshot = completedSnapshot(id);
        Session session = snapshot.session;
        List<Entry> recorded;
        long total;
        synchronized (this) {
            recorded = session.flagged;
            total = session.flaggedTotal;
        }
        if (recorded == null) {
            List<Entry> flagged = new ArrayList<>();
            total = 0;
            for (Entry entry : snapshot.entries.values()) {
                if (entry.errorCode == null) continue;
                total++;
                flagged.add(entry);
            }
            flagged.sort(Comparator.comparing(entry -> entry.path.toString()));
            recorded = flagged.size() > maximumRecordedSkips
                    ? List.copyOf(flagged.subList(0, maximumRecordedSkips)) : flagged;
            synchronized (this) {
                if (session.entries == snapshot.entries) {
                    session.flagged = recorded;
                    session.flaggedTotal = total;
                }
            }
        }
        List<SkippedItems.SkippedItem> items = recorded.stream().skip(offset).limit(limit)
                .map(entry -> new SkippedItems.SkippedItem(name(entry.path), entry.path.toString(),
                        session.path.relativize(entry.path).toString(), entry.type, entry.errorCode))
                .toList();
        return new SkippedItems(session.id, total, recorded.size(), offset, items);
    }

    private static List<Entry> rank(Collection<Entry> entries) {
        PriorityQueue<Entry> smallestKept = new PriorityQueue<>(SIZE_ORDER.reversed());
        for (Entry entry : entries) {
            if (entry.type != DirectoryType.FILE) continue;
            smallestKept.add(entry);
            if (smallestKept.size() > MAX_RANKED_FILES) smallestKept.poll();
        }
        List<Entry> ranked = new ArrayList<>(smallestKept);
        ranked.sort(SIZE_ORDER);
        return ranked;
    }

    /**
     * A completed snapshot with the entries it held when captured under the monitor. Its
     * entries and their fields are final once the scan completes: the worker's writes
     * happen before the volatile write of COMPLETE that {@link #completed} reads. Eviction
     * swaps the session's map for an empty one without touching this one, so a query that
     * has started keeps a consistent view until it returns.
     */
    private record Snapshot(Session session, Map<Path, Entry> entries) {
        Entry root() { return entries.get(session.path); }
    }

    private synchronized Snapshot completedSnapshot(String id) {
        Session session = completed(id);
        return new Snapshot(session, session.entries);
    }

    private Session completed(String id) {
        Session session = findSession(id);
        if (session.state != State.COMPLETE) {
            throw new ApiException(HttpStatus.CONFLICT, ApiErrorCode.SCAN_NOT_COMPLETE, "Directory details are available after the scan completes.");
        }
        return session;
    }

    private static Entry findEntry(Snapshot snapshot, String requestedPath) {
        Path path = parsePath(requestedPath);
        // Path.startsWith compares whole name elements, never a text prefix.
        if (!path.startsWith(snapshot.session.path)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.PATH_OUTSIDE_SCAN, "The directory must belong to this scan.");
        }
        Entry entry = snapshot.entries.get(path);
        if (entry == null) throw new ApiException(HttpStatus.NOT_FOUND, ApiErrorCode.PATH_NOT_IN_SCAN, "This path was not found in the scan.");
        return entry;
    }

    private static String name(Path path) {
        Path filename = path.getFileName();
        return filename == null ? path.toString() : filename.toString();
    }

    private Session findSession(String id) {
        Session session = sessions.get(id);
        if (session == null) throw new ApiException(HttpStatus.NOT_FOUND, ApiErrorCode.SCAN_NOT_FOUND, "This scan has expired or does not exist. Start a new scan.");
        return session;
    }

    public static Path validateRoot(String requestedPath) {
        Path path = parsePath(requestedPath);
        if (!Files.exists(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.FOLDER_NOT_FOUND, "The selected folder does not exist.");
        }
        if (!Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(path)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.NOT_A_FOLDER, "Choose a folder, not a file or symbolic link.");
        }
        if (!Files.isReadable(path)) throw new ApiException(HttpStatus.FORBIDDEN, ApiErrorCode.FOLDER_UNREADABLE, "The selected folder cannot be read.");
        return path;
    }

    private static Path parsePath(String value) {
        if (value == null || value.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.PATH_REQUIRED, "Enter an absolute folder path.");
        }
        if (value.length() > 32_767) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.PATH_INVALID, "The folder path is invalid.");
        }
        try {
            Path path = Path.of(value);
            if (!path.isAbsolute()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.PATH_NOT_ABSOLUTE, "Enter an absolute folder path.");
            }
            return path.normalize();
        } catch (InvalidPathException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ApiErrorCode.PATH_INVALID, "The folder path is invalid.");
        }
    }

    private void scan(Session session) {
        try {
            Files.walkFileTree(session.path, EnumSet.noneOf(FileVisitOption.class), maximumDepth, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path path, BasicFileAttributes attributes) {
                    checkCancelled(session);
                    session.currentPath = path.toString();
                    add(session, path, DirectoryType.FOLDER);
                    session.directories.incrementAndGet();
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path path, BasicFileAttributes attributes) {
                    checkCancelled(session);
                    if (!attributes.isRegularFile()) {
                        Entry entry = add(session, path, DirectoryType.ERROR);
                        if (attributes.isDirectory()) entry.flag(NodeIssueCode.DEPTH_LIMIT, "Maximum scan depth reached.");
                        else entry.flag(NodeIssueCode.EXCLUDED_LINK, "Symbolic links and special files are excluded.");
                        session.skipped.incrementAndGet();
                    } else {
                        Entry entry = add(session, path, DirectoryType.FILE);
                        entry.sizeBytes = attributes.size();
                        entry.fileCount = 1;
                        entry.modifiedMillis = modifiedMillis(attributes.lastModifiedTime());
                        session.files.incrementAndGet();
                        session.bytes.addAndGet(entry.sizeBytes);
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path path, IOException exception) {
                    checkCancelled(session);
                    Entry entry = add(session, path, DirectoryType.ERROR);
                    entry.flag(NodeIssueCode.PATH_UNREADABLE, "This path could not be read. It may require permission or have moved.");
                    session.skipped.incrementAndGet();
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path path, IOException exception) {
                    checkCancelled(session);
                    Entry entry = session.entries.get(path);
                    if (exception != null) {
                        entry.flag(NodeIssueCode.CONTENTS_PARTIALLY_UNREADABLE, "Some items in this folder could not be read.");
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
                    session.fail(ScanErrorCode.ROOT_UNREADABLE, "The selected folder could not be read.", Map.of());
                } else {
                    session.end(State.COMPLETE);
                }
            }
        } catch (CancellationException exception) {
            synchronized (session) {
                session.end(State.CANCELLED);
            }
        } catch (OutOfMemoryError error) {
            // Best-effort terminal state, not a guarantee that the JVM can recover.
            // Use a constant message and release the working tree in finally.
            synchronized (session) {
                if (session.state != State.CANCELLED) {
                    session.fail(ScanErrorCode.OUT_OF_MEMORY,
                            "The scanner ran out of memory. Select a smaller folder or restart the local service and try again.", Map.of());
                }
            }
        } catch (Exception exception) {
            synchronized (session) {
                if (session.state != State.CANCELLED) {
                    if (exception instanceof ScanLimitException limit) {
                        session.fail(limit.code, limit.getMessage(), limit.params);
                    } else {
                        session.fail(ScanErrorCode.SCAN_FAILED, "The scan could not finish. Check folder access and try again.", Map.of());
                    }
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
            throw new ScanLimitException(ScanErrorCode.ENTRY_LIMIT,
                    "This scan exceeded the limit of " + maximumEntries + " items. Select a smaller folder.",
                    Map.of("limit", (long) maximumEntries));
        }
        long requiredBytes = estimatedEntryBytes(path);
        while (requiredBytes > maximumSnapshotBytes - retainedSnapshotBytes) {
            String oldest = sessions.values().stream().filter(candidate -> candidate.state == State.COMPLETE)
                    .map(candidate -> candidate.id).findFirst().orElse(null);
            if (oldest == null) {
                throw new ScanLimitException(ScanErrorCode.MEMORY_BUDGET,
                        "The scan reached the shared snapshot memory budget. Select a smaller folder or cancel another scan and try again.",
                        Map.of());
            }
            evict(oldest);
        }
        Entry entry = new Entry(path, type);
        session.entries.put(path, entry);
        session.retainedBytes += requiredBytes;
        retainedSnapshotBytes += requiredBytes;
        session.lastActivityNanos = System.nanoTime();
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
        session.ranked = null;
        session.flagged = null;
    }

    private static void checkCancelled(Session session) {
        if (session.state == State.CANCELLED || Thread.currentThread().isInterrupted()) throw new CancellationException();
    }

    private ScanStatus snapshot(Session session) {
        synchronized (session) {
            long now = System.nanoTime();
            boolean scanning = session.state == State.SCANNING;
            long end = scanning ? now : session.finishedNanos;
            return new ScanStatus(session.id, session.path.toString(), session.state, session.files.get(),
                    session.directories.get(), session.bytes.get(), session.skipped.get(),
                    session.error, session.errorCode, session.errorParams,
                    session.startedAt, session.finishedAt,
                    TimeUnit.NANOSECONDS.toMillis(end - session.startedNanos),
                    scanning ? TimeUnit.NANOSECONDS.toMillis(now - session.lastActivityNanos) : null,
                    scanning ? session.currentPath : null,
                    session.volume,
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
        directory.setErrorCode(entry.errorCode);
        if (entry.type == DirectoryType.FILE) {
            String extension = FileTypes.extensionOf(directory.getName());
            directory.setLastModified(instantOf(entry.modifiedMillis));
            directory.setExtension(extension);
            directory.setCategory(FileTypes.categoryOf(extension));
        }
        if (includeChildren) directory.setSubdirectories(entry.children.stream().map(child -> toDirectory(child, false)).toList());
        return directory;
    }

    @PreDestroy
    public synchronized void close() {
        for (Session session : sessions.values()) {
            synchronized (session) {
                if (session.state == State.SCANNING) session.end(State.CANCELLED);
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
        final Volume volume;
        final long startedNanos = System.nanoTime();
        // Wall-clock identity of the result for people; durations use nanoTime.
        final Instant startedAt = Instant.now();
        Instant finishedAt;
        volatile long lastActivityNanos = startedNanos;
        volatile String currentPath;
        volatile State state = State.SCANNING;
        // Written with the session monitor held, like state transitions.
        long finishedNanos;
        String error;
        ScanErrorCode errorCode;
        Map<String, Long> errorParams;
        Future<?> future;
        // Derived from a completed snapshot on first use, outside the service monitor;
        // the fields themselves are guarded by it.
        List<Entry> ranked;
        List<Entry> flagged;
        long flaggedTotal;

        Session(Path path, Volume volume) {
            this.path = path;
            this.volume = volume;
        }

        /** Moves to a terminal state; the first transition fixes the elapsed time. */
        void end(State terminal) {
            if (state == State.SCANNING) {
                finishedNanos = System.nanoTime();
                finishedAt = Instant.now();
            }
            state = terminal;
        }

        void fail(ScanErrorCode code, String message, Map<String, Long> params) {
            error = message;
            errorCode = code;
            errorParams = params.isEmpty() ? null : params;
            end(State.ERROR);
        }
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
        NodeIssueCode errorCode;
        // Files only. Eight bytes per entry, included in estimatedEntryBytes.
        long modifiedMillis = UNKNOWN_TIME;

        Entry(Path path, DirectoryType type) { this.path = path; this.type = type; }

        void flag(NodeIssueCode code, String message) {
            partial = true;
            errorCode = code;
            error = message;
        }
    }

    private static final class ScanLimitException extends RuntimeException {
        final ScanErrorCode code;
        final Map<String, Long> params;

        ScanLimitException(ScanErrorCode code, String message, Map<String, Long> params) {
            super(message);
            this.code = code;
            this.params = params;
        }
    }
}
