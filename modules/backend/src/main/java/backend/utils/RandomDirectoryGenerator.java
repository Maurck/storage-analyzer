package backend.utils;

import backend.models.Directory;

import java.util.List;
import java.util.Random;

public class RandomDirectoryGenerator {
    private static final String PATH_DELIMITER = "/";
    private final Random random;
    private int directoryPercentage = 80;
    private int subdirectoriesNumber = 3;
    private final List<String> firstLevelNames = List.of("Program Files(x86)", "Program Files", "Games", "Photos", "Memories");
    private final List<String> secondLevelNames = List.of(".minecraft", "Graduation photos", "Fortnite", "Assassin's Creed", "God of War");
    private final List<String> thirdLevelNames = List.of("shaders", "mods", "shaderpacks", "first photo", "second photo", "replays");
    private final List<List<String>> subDirNames = List.of(firstLevelNames, secondLevelNames, thirdLevelNames);

    public RandomDirectoryGenerator(long seed, int directoryPercentage, int subdirectoriesNumber) {
        random = new Random(seed);
        this.directoryPercentage = directoryPercentage;
        this.subdirectoriesNumber = subdirectoriesNumber;
    }

    public void buildSubdirectories(Directory directory, int currentLevel, int maxLevel) {
        if (currentLevel >= maxLevel || directory.isFile()) {
            return;
        }

        for (int i = 0; i < subdirectoriesNumber; i++) {
            boolean newDirIsFile = random.nextInt(0, 100) > directoryPercentage;
            Directory subdirectory = getMockedDirectory(currentLevel, directory.getAbsolutePath(), newDirIsFile);
            buildSubdirectories(subdirectory, currentLevel + 1, maxLevel);

            directory.getSubdirectories().add(subdirectory);
        }
    }

    private Directory getMockedDirectory(int currentLevel, String basePath, boolean isFile) {
        String subdirectoryName = subDirNames.get(currentLevel).get(random.nextInt(0, subDirNames.get(currentLevel).size() - 1));
        String subdirectoryPath = basePath + PATH_DELIMITER + subdirectoryName;

        Directory mockedDirectory = new Directory(subdirectoryName, subdirectoryPath);
        mockedDirectory.setTypeByIsFile(isFile);
        return mockedDirectory;
    }
}
