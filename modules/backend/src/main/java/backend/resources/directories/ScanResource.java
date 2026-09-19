package backend.resources.directories;

import backend.models.Ancestry;
import backend.models.Directory;
import backend.models.FileSearch;
import backend.models.LargestFiles;
import backend.models.ScanStatus;
import backend.models.SkippedItems;
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

    @GetMapping("/{id}/entry")
    public Directory entry(@PathVariable String id, @RequestParam String path) {
        return scanService.entry(id, path);
    }

    @GetMapping("/{id}/ancestors")
    public Ancestry ancestors(@PathVariable String id, @RequestParam String path) {
        return scanService.ancestors(id, path);
    }

    @GetMapping("/{id}/largest")
    public LargestFiles largest(@PathVariable String id,
                                @RequestParam(defaultValue = "100") int limit,
                                @RequestParam(defaultValue = "0") long minSizeBytes) {
        return scanService.largest(id, limit, minSizeBytes);
    }

    @GetMapping("/{id}/files")
    public FileSearch files(@PathVariable String id,
                            @RequestParam(defaultValue = "") String query,
                            @RequestParam(required = false) String scope,
                            @RequestParam(defaultValue = "0") long minSizeBytes,
                            @RequestParam(defaultValue = "0") int offset,
                            @RequestParam(defaultValue = "50") int limit) {
        return scanService.search(id, query, scope, minSizeBytes, offset, limit);
    }

    @GetMapping("/{id}/skipped")
    public SkippedItems skipped(@PathVariable String id,
                                @RequestParam(defaultValue = "0") int offset,
                                @RequestParam(defaultValue = "100") int limit) {
        return scanService.skipped(id, offset, limit);
    }
}
