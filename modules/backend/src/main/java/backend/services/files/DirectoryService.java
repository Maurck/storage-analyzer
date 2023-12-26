package backend.services.files;

import backend.models.Directory;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@NoArgsConstructor
public class DirectoryService {
    public Directory getDirectories() {
        Directory rootDirectory = new Directory("C/:");
        Directory subDir1 = new Directory("Program Files");
        Directory subDir2 = new Directory("Program Files(x86)");
        rootDirectory.setSubdirectories(List.of(subDir1, subDir2));

        return rootDirectory;
    }
}
