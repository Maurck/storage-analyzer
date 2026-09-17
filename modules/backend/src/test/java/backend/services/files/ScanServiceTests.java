package backend.services.files;

import backend.enums.NodeIssueCode;
import backend.enums.ScanErrorCode;
import backend.models.Directory;
import backend.models.ScanStatus;
import backend.resources.ApiErrorCode;
import backend.resources.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class ScanServiceTests {
    @TempDir Path temporary;
    private ScanService service = new ScanService();

    @AfterEach
    void close() { service.close(); }

    @Test
    void computesRecursiveLogicalSizesAndLoadsOnlyDirectChildren() throws Exception {
        Path nested = Files.createDirectories(temporary.resolve("photos/nested"));
        Files.write(temporary.resolve("root.bin"), new byte[7]);
        Files.write(nested.resolve("picture.bin"), new byte[13]);

        ScanStatus complete = finish(service.start(temporary.toString()).id());
        assertEquals(ScanStatus.State.COMPLETE, complete.status());
        assertEquals(2, complete.processedFiles());
        assertEquals(3, complete.processedDirectories());
        assertEquals(20, complete.processedBytes());
        assertEquals(20, complete.root().getSizeBytes());
        assertNotNull(complete.volume());
        assertTrue(complete.volume().usableBytes() <= complete.volume().totalBytes());
        assertEquals(2, complete.root().getFileCount());
        assertEquals(2, complete.root().getDirectoryCount());
        assertFalse(complete.root().isPartial());
        assertTrue(complete.root().isChildrenLoaded());
        assertEquals(2, complete.root().getSubdirectories().size());
        Directory photos = complete.root().getSubdirectories().get(0);
        assertEquals("photos", photos.getName());
        assertTrue(photos.isHasChildren());
        assertFalse(photos.isChildrenLoaded());
        assertTrue(photos.getSubdirectories().isEmpty());
        assertEquals(13, photos.getSizeBytes());

        Directory loaded = service.directory(complete.id(), photos.getAbsolutePath());
        assertTrue(loaded.isChildrenLoaded());
        assertEquals(1, loaded.getSubdirectories().size());
        assertFalse(loaded.getSubdirectories().get(0).isChildrenLoaded());
        assertTrue(loaded.getSubdirectories().get(0).getSubdirectories().isEmpty());
    }

    @Test
    void lazyReadsUseTheCompletedSnapshot() throws Exception {
        Path folder = Files.createDirectory(temporary.resolve("folder"));
        Path file = Files.write(folder.resolve("file.bin"), new byte[4]);
        ScanStatus complete = finish(service.start(temporary.toString()).id());
        Files.delete(file);
        Directory loaded = service.directory(complete.id(), folder.toString());
        assertEquals(4, loaded.getSizeBytes());
        assertEquals("file.bin", loaded.getSubdirectories().get(0).getName());
    }

    @Test
    void emptyFoldersHaveRealZeroMetrics() {
        ScanStatus complete = finish(service.start(temporary.toString()).id());
        assertEquals(ScanStatus.State.COMPLETE, complete.status());
        assertEquals(0, complete.root().getSizeBytes());
        assertEquals(0, complete.root().getFileCount());
        assertEquals(0, complete.root().getDirectoryCount());
        assertFalse(complete.root().isHasChildren());
        assertTrue(complete.root().isChildrenLoaded());
    }

    @Test
    void validatesPathsAndRejectsPathsOutsideTheScan() throws Exception {
        assertBadPath(null);
        assertBadPath(" ");
        assertBadPath("relative/path");
        assertBadPath(temporary.resolve("missing").toString());
        assertBadPath(Files.write(temporary.resolve("file"), new byte[0]).toString());
        ScanStatus complete = finish(service.start(temporary.toString()).id());
        ApiException outside = assertThrows(ApiException.class,
                () -> service.directory(complete.id(), temporary.getParent().toString()));
        assertEquals(HttpStatus.BAD_REQUEST, outside.getStatus());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class,
                () -> service.directory(complete.id(), temporary.resolve("unknown").toString())).getStatus());
    }

    @Test
    void rejectsInvalidPathsWithoutWaitingForOtherSessionOperations() throws Exception {
        ExecutorService requester = Executors.newSingleThreadExecutor();
        try {
            synchronized (service) {
                // A different session operation owns the monitor. Validation
                // must still run before a new request attempts to acquire it.
                requester.submit(() -> assertBadPath("relative/path")).get(2, TimeUnit.SECONDS);
            }
        } finally {
            requester.shutdownNow();
        }
    }

    @Test
    void cancelsPendingWorkAndBoundsConcurrentScans() throws Exception {
        service.close();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        CountDownLatch workerStarted = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        executor.submit(() -> {
            workerStarted.countDown();
            try { release.await(); } catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
        });
        workerStarted.await();
        service = new ScanService(executor);
        try {
            ScanStatus first = service.start(temporary.toString());
            ScanStatus second = service.start(temporary.toString());
            assertEquals(ScanStatus.State.SCANNING, first.status());
            assertEquals(HttpStatus.TOO_MANY_REQUESTS, assertThrows(ApiException.class,
                    () -> service.start(temporary.toString())).getStatus());
            assertEquals(HttpStatus.CONFLICT, assertThrows(ApiException.class,
                    () -> service.directory(first.id(), temporary.toString())).getStatus());
            assertEquals(ScanStatus.State.CANCELLED, service.cancel(first.id()).status());
            assertEquals(ScanStatus.State.CANCELLED, service.cancel(first.id()).status());
            assertNull(service.status(first.id()).root());
            release.countDown();
            assertEquals(ScanStatus.State.COMPLETE, finish(second.id()).status());
            assertEquals(ScanStatus.State.CANCELLED, service.status(first.id()).status());
        } finally {
            release.countDown();
        }
    }

    @Test
    void evictsOldCompletedSnapshots() {
        String first = finish(service.start(temporary.toString()).id()).id();
        for (int i = 0; i < ScanService.MAX_SESSIONS; i++) finish(service.start(temporary.toString()).id());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.status(first)).getStatus());
    }

    @Test
    void sizesTheSharedBudgetFromHeapWithAnAbsoluteCeiling() {
        long mebibyte = 1024L * 1024;
        assertEquals(64 * mebibyte, ScanService.snapshotBudget(256 * mebibyte));
        assertEquals(256 * mebibyte, ScanService.snapshotBudget(8 * 1024 * mebibyte));
        assertTrue(ScanService.estimatedEntryBytes(temporary.resolve("longer-filename"))
                > ScanService.estimatedEntryBytes(temporary));
    }

    @Test
    void evictsTheOldestSnapshotBeforeExceedingTheSharedMemoryBudget() {
        service.close();
        long rootBytes = ScanService.estimatedEntryBytes(temporary);
        service = new ScanService(Executors.newSingleThreadExecutor(), 100, 128, 2 * rootBytes);
        String first = finish(service.start(temporary.toString()).id()).id();
        String second = finish(service.start(temporary.toString()).id()).id();
        assertEquals(ScanStatus.State.COMPLETE, service.status(first).status());
        String third = finish(service.start(temporary.toString()).id()).id();

        // Only three sessions were started: eviction is from the shared byte
        // budget, not the session-count ceiling or the per-scan entry limit.
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.status(first)).getStatus());
        assertEquals(ScanStatus.State.COMPLETE, service.status(second).status());
        assertEquals(ScanStatus.State.COMPLETE, service.status(third).status());
        assertNotNull(service.directory(third, temporary.toString()));
    }

    @Test
    void memoryLimitFailureReleasesItsWorkingTreeAndAllowsAnotherScan() throws Exception {
        service.close();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        Path file = Files.write(temporary.resolve("file.bin"), new byte[4]);
        long budget = ScanService.estimatedEntryBytes(temporary) + ScanService.estimatedEntryBytes(file) - 1;
        service = new ScanService(executor, 100, 128, budget);

        ScanStatus failed = finish(service.start(temporary.toString()).id());
        assertEquals(ScanStatus.State.ERROR, failed.status());
        assertNull(failed.root());
        assertTrue(failed.error().contains("memory budget"));
        assertTrue(failed.error().contains("smaller folder"));
        executor.submit(() -> { }).get(2, TimeUnit.SECONDS); // includes worker cleanup
        Files.delete(file);

        ScanStatus recovered = finish(service.start(temporary.toString()).id());
        assertEquals(ScanStatus.State.COMPLETE, recovered.status());
        assertEquals(0, recovered.root().getSizeBytes());
    }

    @Test
    void refusesAnEntryLargerThanTheEntireMemoryBudget() {
        service.close();
        service = new ScanService(Executors.newSingleThreadExecutor(), 100, 128, 1);
        ScanStatus result = finish(service.start(temporary.toString()).id());
        assertEquals(ScanStatus.State.ERROR, result.status());
        assertNull(result.root());
        assertEquals(0, result.processedDirectories());
        assertTrue(result.error().contains("memory budget"));
        assertEquals(ScanErrorCode.MEMORY_BUDGET, result.errorCode());
        assertNull(result.errorParams());
    }

    @Test
    void identifiesEachRejectedRequestWithAStableCode() throws Exception {
        assertRejected(null, ApiErrorCode.PATH_REQUIRED);
        assertRejected(" ", ApiErrorCode.PATH_REQUIRED);
        assertRejected("relative/path", ApiErrorCode.PATH_NOT_ABSOLUTE);
        assertRejected("x".repeat(32_768), ApiErrorCode.PATH_INVALID);
        assertRejected(temporary.resolve("missing").toString(), ApiErrorCode.FOLDER_NOT_FOUND);
        assertRejected(Files.write(temporary.resolve("file"), new byte[0]).toString(), ApiErrorCode.NOT_A_FOLDER);
        String id = finish(service.start(temporary.toString()).id()).id();
        assertEquals(ApiErrorCode.PATH_OUTSIDE_SCAN, assertThrows(ApiException.class,
                () -> service.directory(id, temporary.getParent().toString())).getCode());
        assertEquals(ApiErrorCode.PATH_NOT_IN_SCAN, assertThrows(ApiException.class,
                () -> service.directory(id, temporary.resolve("unknown").toString())).getCode());
        assertEquals(ApiErrorCode.SCAN_NOT_FOUND, assertThrows(ApiException.class,
                () -> service.status("missing")).getCode());
    }

    @Test
    void unknownVolumesAreReportedAsUnknownRatherThanEmpty() {
        assertNull(ScanService.volumeOf(temporary.resolve("missing")));
        assertNotNull(ScanService.volumeOf(temporary));
    }

    @Test
    void reportsActivityWhileScanningAndFreezesElapsedTimeAtTheEnd() throws Exception {
        service.close();
        Path nested = Files.createDirectory(temporary.resolve("nested"));
        Files.write(nested.resolve("file.bin"), new byte[1]);
        CountDownLatch paused = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger added = new AtomicInteger();
        service = new ScanService(Executors.newSingleThreadExecutor(), 100, 128, 1024L * 1024) {
            @Override
            void entryAdded() {
                // The second entry is the nested folder: the root has no other child.
                if (added.incrementAndGet() != 2) return;
                paused.countDown();
                try {
                    release.await();
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
            }
        };
        String id;
        try {
            id = service.start(temporary.toString()).id();
            assertTrue(paused.await(5, TimeUnit.SECONDS));
            Thread.sleep(60);
            ScanStatus scanning = service.status(id);
            assertEquals(ScanStatus.State.SCANNING, scanning.status());
            assertEquals(nested.toString(), scanning.currentPath());
            assertTrue(scanning.millisSinceActivity() >= 50, "idle for " + scanning.millisSinceActivity());
            assertTrue(scanning.elapsedMillis() >= scanning.millisSinceActivity());
        } finally {
            release.countDown();
        }

        ScanStatus done = finish(id);
        assertEquals(ScanStatus.State.COMPLETE, done.status());
        assertNull(done.currentPath());
        assertNull(done.millisSinceActivity());
        assertNull(done.errorCode());
        Thread.sleep(30);
        assertEquals(done.elapsedMillis(), service.status(id).elapsedMillis());
    }

    @Test
    void runsTwoScansAtOnceAndChargesBothToTheSharedBudget() throws Exception {
        service.close();
        Path first = Files.write(Files.createDirectory(temporary.resolve("first")).resolve("a.bin"), new byte[3]);
        Path second = Files.write(Files.createDirectory(temporary.resolve("second")).resolve("b.bin"), new byte[5]);
        CountDownLatch bothRunning = new CountDownLatch(2);
        AtomicBoolean overlapped = new AtomicBoolean(true);
        Set<Thread> workers = ConcurrentHashMap.newKeySet();
        service = new ScanService(Executors.newFixedThreadPool(2), 100, 128, 1024L * 1024) {
            @Override
            void entryAdded() {
                // Each worker waits for the other, so a serial run cannot pass.
                if (workers.add(Thread.currentThread())) {
                    bothRunning.countDown();
                    try {
                        if (!bothRunning.await(5, TimeUnit.SECONDS)) overlapped.set(false);
                    } catch (InterruptedException exception) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
        };

        String a = service.start(first.getParent().toString()).id();
        String b = service.start(second.getParent().toString()).id();
        assertEquals(3, finish(a).root().getSizeBytes());
        assertEquals(5, finish(b).root().getSizeBytes());
        assertTrue(overlapped.get());
        assertEquals(estimate(first.getParent(), first, second.getParent(), second), service.retainedSnapshotBytes());

        service.close();
        assertEquals(0, service.retainedSnapshotBytes());
    }

    @Test
    void cancellingMidScanKeepsItsReservationUntilTheWorkerStops() throws Exception {
        service.close();
        List<Path> files = new ArrayList<>();
        for (int i = 0; i < 5; i++) files.add(Files.write(temporary.resolve("file" + i), new byte[1]));
        CountDownLatch paused = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger added = new AtomicInteger();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        service = new ScanService(executor, 100, 128, 1024L * 1024) {
            @Override
            void entryAdded() {
                if (added.incrementAndGet() != 3) return;
                paused.countDown();
                // Ignore the cancellation interrupt until released, like a
                // worker stuck in a slow filesystem call, then restore it.
                boolean interrupted = false;
                while (true) {
                    try {
                        release.await();
                        break;
                    } catch (InterruptedException exception) {
                        interrupted = true;
                    }
                }
                if (interrupted) Thread.currentThread().interrupt();
            }
        };
        try {
            String cancelled = service.start(temporary.toString()).id();
            assertTrue(paused.await(5, TimeUnit.SECONDS));
            long reserved = service.retainedSnapshotBytes();
            assertTrue(reserved > 0);
            ScanStatus cancelledStatus = service.cancel(cancelled);
            assertEquals(ScanStatus.State.CANCELLED, cancelledStatus.status());
            assertNull(service.status(cancelled).root());
            Thread.sleep(30);
            assertEquals(cancelledStatus.elapsedMillis(), service.status(cancelled).elapsedMillis(),
                    "a cancelled scan stops its clock even while its worker is still winding down");

            // Enough new scans to evict the cancelled session while its worker still holds entries.
            List<String> replacements = new ArrayList<>();
            for (int i = 0; i < ScanService.MAX_SESSIONS; i++) {
                replacements.add(finish(service.start(temporary.toString()).id()).id());
            }
            assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.status(cancelled)).getStatus());
            long perScan = estimate(files.toArray(Path[]::new)) + ScanService.estimatedEntryBytes(temporary);
            assertEquals(reserved + ScanService.MAX_SESSIONS * perScan, service.retainedSnapshotBytes());

            release.countDown();
            long retained = assertTimeoutPreemptively(Duration.ofSeconds(5), () -> {
                while (service.retainedSnapshotBytes() != ScanService.MAX_SESSIONS * perScan) Thread.sleep(5);
                return service.retainedSnapshotBytes();
            });
            assertEquals(ScanService.MAX_SESSIONS * perScan, retained);
            for (String id : replacements) assertEquals(ScanStatus.State.COMPLETE, service.status(id).status());
        } finally {
            release.countDown();
        }
    }

    @Test
    void expandsWideFoldersWithEveryDirectChild() throws Exception {
        Path wide = Files.createDirectory(temporary.resolve("wide"));
        long expectedBytes = 0;
        for (int i = 0; i < 2_000; i++) {
            Files.write(wide.resolve("item-" + i + ".bin"), new byte[i % 7]);
            expectedBytes += i % 7;
        }
        ScanStatus complete = finish(service.start(temporary.toString()).id());
        assertEquals(1, complete.root().getSubdirectories().size());

        // Direct children are not paginated: a wide folder returns all of them at once.
        Directory loaded = service.directory(complete.id(), wide.toString());
        assertEquals(2_000, loaded.getSubdirectories().size());
        assertEquals(2_000, loaded.getFileCount());
        assertEquals(expectedBytes, loaded.getSizeBytes());
        assertEquals(6, loaded.getSubdirectories().get(0).getSizeBytes());
        assertTrue(loaded.getSubdirectories().stream().allMatch(child -> child.getSubdirectories().isEmpty()));
    }

    @Test
    void stopsAtTheItemLimitWithoutPublishingMisleadingTotals() throws Exception {
        service.close();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        service = new ScanService(executor, 2, 128, 2 * ScanService.estimatedEntryBytes(temporary.resolve("second")));
        Files.write(temporary.resolve("first"), new byte[2]);
        Files.write(temporary.resolve("second"), new byte[3]);
        ScanStatus result = finish(service.start(temporary.toString()).id());
        assertEquals(ScanStatus.State.ERROR, result.status());
        assertNull(result.root());
        assertTrue(result.error().contains("limit"));
        assertEquals(ScanErrorCode.ENTRY_LIMIT, result.errorCode());
        assertEquals(Map.of("limit", 2L), result.errorParams());
        executor.submit(() -> { }).get(2, TimeUnit.SECONDS);
        Files.delete(temporary.resolve("second"));
        assertEquals(ScanStatus.State.COMPLETE, finish(service.start(temporary.toString()).id()).status());
    }

    @Test
    void reportsTruncatedDepthAsPartial() throws Exception {
        service.close();
        service = new ScanService(Executors.newSingleThreadExecutor(), 100, 2);
        Path deep = Files.createDirectories(temporary.resolve("child/deep"));
        Files.write(deep.resolve("not-scanned"), new byte[8]);
        ScanStatus result = finish(service.start(temporary.toString()).id());
        assertEquals(ScanStatus.State.COMPLETE, result.status());
        assertTrue(result.root().isPartial());
        assertEquals(1, result.skippedCount());
        assertEquals(0, result.processedBytes());
        Directory child = service.directory(result.id(), temporary.resolve("child").toString());
        assertTrue(child.getSubdirectories().get(0).getError().contains("depth"));
        assertEquals(NodeIssueCode.DEPTH_LIMIT, child.getSubdirectories().get(0).getErrorCode());
    }

    @Test
    void doesNotFollowSymbolicLinksAndMarksIncompleteTotals() throws Exception {
        Path target = Files.write(temporary.resolve("target"), new byte[9]);
        try {
            Files.createSymbolicLink(temporary.resolve("link"), target);
        } catch (IOException | UnsupportedOperationException | SecurityException exception) {
            assumeTrue(false, "This environment does not allow symbolic links: " + exception.getMessage());
        }
        ScanStatus complete = finish(service.start(temporary.toString()).id());
        assertEquals(9, complete.root().getSizeBytes());
        assertEquals(1, complete.skippedCount());
        assertTrue(complete.root().isPartial());
        assertNotNull(complete.root().getSubdirectories().stream().filter(item -> item.getName().equals("link"))
                .findFirst().orElseThrow().getError());
        assertEquals(NodeIssueCode.EXCLUDED_LINK, complete.root().getSubdirectories().stream()
                .filter(item -> item.getName().equals("link")).findFirst().orElseThrow().getErrorCode());
    }

    private void assertBadPath(String path) {
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ApiException.class, () -> service.start(path)).getStatus());
    }

    private void assertRejected(String path, ApiErrorCode code) {
        ApiException exception = assertThrows(ApiException.class, () -> service.start(path));
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertEquals(code, exception.getCode());
    }

    private static long estimate(Path... paths) {
        long total = 0;
        for (Path path : paths) total += ScanService.estimatedEntryBytes(path);
        return total;
    }

    private ScanStatus finish(String id) {
        return assertTimeoutPreemptively(Duration.ofSeconds(10), () -> {
            ScanStatus current;
            do {
                current = service.status(id);
                if (current.status() == ScanStatus.State.SCANNING) Thread.sleep(5);
            } while (current.status() == ScanStatus.State.SCANNING);
            return current;
        });
    }
}
