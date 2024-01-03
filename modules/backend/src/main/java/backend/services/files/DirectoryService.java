package backend.services.files;

import backend.enums.DirectoryType;
import backend.models.Directory;
import backend.utils.RandomDirectoryGenerator;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.stream.Stream;

@Service
@NoArgsConstructor
public class DirectoryService {
    private final RandomDirectoryGenerator randomDirectoryGenerator = new RandomDirectoryGenerator();

    public Directory getMockedDirectory(String mockedDirName) {
        Directory rootDir = new Directory(mockedDirName, mockedDirName);
        randomDirectoryGenerator.buildSubdirectories(rootDir, 0, 3);
        return rootDir;
    }

    public Directory getDirectory(String rootPath) throws IOException {
        Path root = Paths.get(rootPath);
        Directory rootDirectory = new Directory(root.toString(), "", DirectoryType.FOLDER);
        List<Directory> subDirectories;
        try (Stream<Path> stream = Files.list(root)) {
            subDirectories = stream.map(p -> new Directory(
                    p.getFileName().toString(),
                    p.toAbsolutePath().toString(),
                    p.toFile().isDirectory() ? DirectoryType.FOLDER : DirectoryType.FILE
            )).toList();
        }

        rootDirectory.setSubdirectories(subDirectories);
        return rootDirectory;
    }
}
