package backend.services.files;

import backend.models.Directory;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@NoArgsConstructor
public class DirectoryService {
    public Directory getDirectory() {
        Directory rootDirectory = new Directory("C:/");
        Directory subDir1 = new Directory("Program files(x86)");
        Directory subDir2 = new Directory(".minecraft");

        subDir1.setSubdirectories(List.of(subDir2));
        subDir2.setSubdirectories(List.of(new Directory("assets"), new Directory("mods"), new Directory("shaderpacks")));
        rootDirectory.setSubdirectories(List.of(subDir1));

        return rootDirectory;
    }
}
