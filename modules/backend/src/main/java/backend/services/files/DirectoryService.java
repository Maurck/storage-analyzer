package backend.services.files;

import backend.enums.DirectoryType;
import backend.models.Directory;
import backend.utils.RandomDirectoryGenerator;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.file.*;
import java.util.List;
import java.util.stream.Stream;

@Service
@NoArgsConstructor
public class DirectoryService {
    private final RandomDirectoryGenerator randomDirectoryGenerator = new RandomDirectoryGenerator(1000, 80, 3);

    public Directory getMockedDirectory(String mockedDirName) {
        Directory rootDir = new Directory(mockedDirName, mockedDirName);
        randomDirectoryGenerator.buildSubdirectories(rootDir, 0, 3);
        return rootDir;
    }

    public Directory getDirectory(String rootPath) {
        Path rootDir = Paths.get(rootPath);
        Directory rootDirectory = new Directory(rootDir.toString(), rootDir.toString(), DirectoryType.FOLDER);
        buildSubdirectories(rootDirectory, 0, 4);
        return rootDirectory;
    }

    public void buildSubdirectories(Directory directory, int currentLevel, int maxLevel) {

        if (currentLevel >= maxLevel || directory.isFile()) {
            return;
        }

        try {
            Path rootDir = Paths.get(directory.getAbsolutePath());
            List<Directory> subDirectories;
            try (Stream<Path> stream = Files.list(rootDir)) {
                subDirectories = stream.map(p -> new Directory(
                        p.getFileName().toString(),
                        p.toAbsolutePath().toString(),
                        p.toFile().isDirectory() ? DirectoryType.FOLDER : DirectoryType.FILE
                )).toList();
            }

            directory.setSubdirectories(subDirectories);
            for (int i = 0; i < directory.getSubdirectories().size(); i++) {
                buildSubdirectories(directory.getSubdirectories().get(i), currentLevel + 1, maxLevel);
            }
        } catch (Exception e) {
            directory.setType(DirectoryType.ERROR);
        }
    }
}
