package backend.services.files;

import backend.models.Directory;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@NoArgsConstructor
public class DirectoryService {
    public Directory getDirectory() {
        Directory rootDirectory = new Directory("Terrible lo que va a pasar");
        Directory subDir1 = new Directory("Imagenes funables");
        Directory subDir2 = new Directory("Screenshots de la fisi");

        subDir1.setSubdirectories(List.of(subDir2));
        subDir2.setSubdirectories(List.of(new Directory("una tal.jpg"), new Directory("A.jpg")));
        rootDirectory.setSubdirectories(List.of(subDir1));

        return rootDirectory;
    }
}
