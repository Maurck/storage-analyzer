package backend.services.files;

import backend.enums.DirectoryType;
import backend.models.Directory;
import backend.utils.RandomDirectoryGenerator;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Comparator;

@Service
public class DirectoryService {
    private static final int MAX_PREVIEW_ENTRIES = 10_000;

    public Directory getMockedDirectory(String mockedDirName) {
        Directory rootDir = new Directory(mockedDirName, mockedDirName);
        new RandomDirectoryGenerator(1000, 80, 3).buildSubdirectories(rootDir, 0, 3);
        return rootDir;
    }

    public Directory getDirectory(String rootPath) {
        return read(ScanService.validateRoot(rootPath), 0, new int[]{0});
    }

    private Directory read(Path path, int depth, int[] count) {
        count[0]++;
        Directory result = new Directory(path.getFileName() == null ? path.toString() : path.getFileName().toString(), path.toString());
        try {
            BasicFileAttributes attributes = Files.readAttributes(path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            if (attributes.isRegularFile()) {
                result.setType(DirectoryType.FILE);
                result.setSizeBytes(attributes.size());
                result.setFileCount(1);
                return result;
            }
            if (!attributes.isDirectory()) {
                result.setType(DirectoryType.ERROR);
                result.setPartial(true);
                result.setError("Symbolic links and special files are excluded.");
                return result;
            }
            if (depth >= 4) {
                result.setChildrenLoaded(false);
                result.setPartial(true);
                result.setError("Preview depth reached. Start a scan for complete metrics.");
                return result;
            }
            ArrayList<Directory> children = new ArrayList<>();
            result.setSubdirectories(children);
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(path)) {
                for (Path child : stream) {
                    if (count[0] >= MAX_PREVIEW_ENTRIES) {
                        result.setPartial(true);
                        result.setError("Preview item limit reached. Start a scan for complete metrics.");
                        break;
                    }
                    Directory item = read(child, depth + 1, count);
                    children.add(item);
                    result.setSizeBytes(result.getSizeBytes() + item.getSizeBytes());
                    result.setFileCount(result.getFileCount() + item.getFileCount());
                    result.setDirectoryCount(result.getDirectoryCount() + item.getDirectoryCount() + (item.getType() == DirectoryType.FOLDER ? 1 : 0));
                    result.setPartial(result.isPartial() || item.isPartial());
                }
            }
            children.sort(Comparator.comparing((Directory directory) -> directory.getType() != DirectoryType.FOLDER)
                    .thenComparing(Directory::getName, String.CASE_INSENSITIVE_ORDER));
            result.setHasChildren(!children.isEmpty());
        } catch (IOException | SecurityException | DirectoryIteratorException exception) {
            result.setType(DirectoryType.ERROR);
            result.setPartial(true);
            result.setError("This folder could not be read. It may require permission or have moved.");
        }
        return result;
    }
}
