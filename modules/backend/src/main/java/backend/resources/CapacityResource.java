package backend.resources;

import backend.services.files.ScanService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** How much this computer can analyze at once; derived from the JVM heap at start-up. */
@RestController
public class CapacityResource {
    private final ScanService scanService;

    public CapacityResource(ScanService scanService) {
        this.scanService = scanService;
    }

    @GetMapping("/capacity")
    public ScanService.Capacity capacity() {
        return scanService.capacity();
    }
}
