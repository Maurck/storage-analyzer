package backend.models;

import backend.enums.FileCategory;
import backend.enums.FileOrder;

import java.time.Instant;
import java.util.List;

/**
 * One page of the files of a completed scan that match every filter, in the order asked for, ties by
 * path. Every file under the scope is considered before the page is cut, so
 * {@code matchingFiles} counts them all.
 *
 * @param scope          the folder searched with all its subfolders; the root for the whole scan
 * @param partial        something under the scope was skipped, so files there cannot match
 * @param query          the text looked for in each file's path from the root; empty matches all
 * @param category       only files of this category; null for any
 * @param extension      only files with this extension, lower case and without the dot; null for any
 * @param modifiedFrom   only files modified at or after this instant; null for no lower bound
 * @param modifiedBefore only files modified before this instant; null for no upper bound
 * @param order          how the matches are sorted before the page is cut
 * @param matchingFiles  files under the scope that match every filter
 */
public record FileSearch(String scanId, String root, String scope, boolean partial, String query,
                         long minSizeBytes, FileCategory category, String extension,
                         Instant modifiedFrom, Instant modifiedBefore, FileOrder order, int offset, int limit,
                         long matchingFiles, List<LargestFiles.RankedFile> files) { }
