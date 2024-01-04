package backend.resources.directories;

import backend.models.Directory;
import backend.services.files.DirectoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("directory")
@CrossOrigin
public class DirectoryResource {
    private final DirectoryService directoryService;

    @Autowired
    public DirectoryResource(DirectoryService directoryService) {
        this.directoryService = directoryService;
    }

    @RequestMapping("")
    public ResponseEntity<Directory> getDirectory() {
        try {
            return ResponseEntity.ok(this.directoryService.getDirectory("C:\\Program Files"));
        } catch (Exception exception) {
            return ResponseEntity.internalServerError().body(new Directory());
        }
    }

    @RequestMapping("/mock")
    public ResponseEntity<Directory> getMockedDirectory() {
        return ResponseEntity.ok(this.directoryService.getMockedDirectory("C:\\"));
    }
}
