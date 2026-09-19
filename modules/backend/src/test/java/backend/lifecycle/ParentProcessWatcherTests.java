package backend.lifecycle;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class ParentProcessWatcherTests {
    @Test
    void reactsWhenTheParentProcessEnds() throws Exception {
        String java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        Process parent = new ProcessBuilder(java, "-version").redirectErrorStream(true).start();
        CountDownLatch ended = new CountDownLatch(1);
        ParentProcessWatcher.watch(parent.pid(), ended::countDown);
        assertTrue(ended.await(20, TimeUnit.SECONDS), "the watcher saw the parent exit");
    }

    @Test
    void reactsAtOnceWhenTheParentIsAlreadyGone() throws Exception {
        String java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        Process parent = new ProcessBuilder(java, "-version").redirectErrorStream(true).start();
        parent.waitFor(20, TimeUnit.SECONDS);
        CountDownLatch ended = new CountDownLatch(1);
        assertFalse(ParentProcessWatcher.watch(parent.pid(), ended::countDown));
        assertEquals(0, ended.getCount());
    }

    @Test
    void keepsWatchingWhileTheParentRuns() {
        CountDownLatch ended = new CountDownLatch(1);
        // Maven (or the IDE) that started this test JVM outlives the test.
        long parent = ProcessHandle.current().parent().orElseThrow().pid();
        assertTrue(ParentProcessWatcher.watch(parent, ended::countDown));
        assertEquals(1, ended.getCount());
    }
}
