package backend.lifecycle;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Stops the backend once the desktop app that started it is gone, even when that
 * app was killed and never had a chance to stop it. The installed app passes its
 * process id; a backend started by hand passes nothing and is left alone.
 */
@Component
public class ParentProcessWatcher {
    public ParentProcessWatcher(@Value("${storage-analyzer.parent-pid:0}") long parentPid,
                                ConfigurableApplicationContext context) {
        if (parentPid > 0) {
            watch(parentPid, () -> System.exit(SpringApplication.exit(context, () -> 0)));
        }
    }

    /** Runs {@code onExit} when the process ends, or right away if it is already gone. */
    static boolean watch(long pid, Runnable onExit) {
        Optional<ProcessHandle> parent = ProcessHandle.of(pid).filter(ProcessHandle::isAlive);
        if (parent.isEmpty()) {
            onExit.run();
            return false;
        }
        parent.get().onExit().thenRun(onExit);
        return true;
    }
}
