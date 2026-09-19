package backend.models;

import java.util.List;

/**
 * The largest files of one completed scan, largest first, ties by path.
 *
 * @param matchingFiles files at or above {@code minSizeBytes}; may exceed {@code files.size()}
 * @param partial       the scan skipped something, so files there are missing from the ranking
 */
public record LargestFiles(String scanId, String root, boolean partial, int limit, long minSizeBytes,
                           long matchingFiles, List<RankedFile> files) {
    /** @param relativePath path from the scan root, including the file name */
    public record RankedFile(String name, String absolutePath, String relativePath, long sizeBytes) { }
}
