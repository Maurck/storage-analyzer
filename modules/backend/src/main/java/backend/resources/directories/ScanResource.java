package backend.resources.directories;

import backend.models.Directory;
import backend.models.ScanStatus;
import backend.services.files.ScanService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("scans")
public class ScanResource {
    private final ScanService scanService;

    public ScanResource(ScanService scanService) {
        this.scanService = scanService;
    }

    public record ScanRequest(String path) { }

    @PostMapping
    public ResponseEntity<ScanStatus> start(@RequestBody ScanRequest request) {
        return ResponseEntity.accepted().body(scanService.start(request.path()));
    }

    @GetMapping("/{id}")
    public ScanStatus status(@PathVariable String id) {
        return scanService.status(id);
    }

    @DeleteMapping("/{id}")
    public ScanStatus cancel(@PathVariable String id) {
        return scanService.cancel(id);
    }

    @GetMapping("/{id}/directory")
    public Directory directory(@PathVariable String id, @RequestParam String path) {
        return scanService.directory(id, path);
    }
}
