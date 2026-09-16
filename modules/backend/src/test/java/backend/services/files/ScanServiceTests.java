package backend.services.files;

import backend.models.Directory;
import backend.models.ScanStatus;
import backend.resources.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

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
    void stopsAtTheItemLimitWithoutPublishingMisleadingTotals() throws Exception {
        service.close();
        service = new ScanService(Executors.newSingleThreadExecutor(), 2, 128);
        Files.write(temporary.resolve("first"), new byte[2]);
        Files.write(temporary.resolve("second"), new byte[3]);
        ScanStatus result = finish(service.start(temporary.toString()).id());
        assertEquals(ScanStatus.State.ERROR, result.status());
        assertNull(result.root());
        assertTrue(result.error().contains("limit"));
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
    }

    private void assertBadPath(String path) {
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ApiException.class, () -> service.start(path)).getStatus());
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
