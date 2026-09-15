package backend.resources.directories;

import backend.models.Directory;
import backend.services.files.DirectoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("directory")
public class DirectoryResource {
    private final DirectoryService directoryService;

    @Autowired
    public DirectoryResource(DirectoryService directoryService) {
        this.directoryService = directoryService;
    }

    @GetMapping("")
    public ResponseEntity<Directory> getDirectory(@RequestParam(required = false) String path) {
        return ResponseEntity.ok(this.directoryService.getDirectory(path == null ? System.getProperty("user.home") : path));
    }

    @GetMapping("/mock")
    public ResponseEntity<Directory> getMockedDirectory() {
        return ResponseEntity.ok(this.directoryService.getMockedDirectory("Demo"));
    }
}
