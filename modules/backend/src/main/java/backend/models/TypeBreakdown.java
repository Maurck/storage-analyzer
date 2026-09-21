package backend.models;

import backend.enums.FileCategory;

import java.util.List;

/**
 * The files under one folder of a completed scan, subfolders included, grouped by the
 * category of their extension. Each file counts once, so the categories add up to the
 * totals, which equal the folder's own size and file count.
 *
 * @param scope          the folder broken down; the root for the whole scan
 * @param partial        something under the scope was skipped, so its files are missing here too
 * @param catalogVersion version of the extension catalog that sorted the files
 * @param categories     categories with at least one file, largest first
 */
public record TypeBreakdown(String scanId, String root, String scope, boolean partial, int catalogVersion,
                            long totalBytes, long totalFiles, List<CategoryTotal> categories) {
    /**
     * @param extensionCount distinct extensions in the category
     * @param extensions     the largest of them, at most ten; empty for files without one
     */
    public record CategoryTotal(FileCategory category, long sizeBytes, long fileCount, int extensionCount,
                                List<ExtensionTotal> extensions) { }

    public record ExtensionTotal(String extension, long sizeBytes, long fileCount) { }
}
