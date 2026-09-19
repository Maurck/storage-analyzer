package backend.models;

import java.util.List;

/**
 * One page of the files of a completed scan that match a query, largest first, ties by path.
 * Every file under the scope is considered before the page is cut, so {@code matchingFiles}
 * counts them all.
 *
 * @param scope         the folder searched with all its subfolders; the root for the whole scan
 * @param partial       something under the scope was skipped, so files there cannot match
 * @param query         the text looked for in each file's path from the root; empty matches all
 * @param matchingFiles files under the scope that match the query and the minimum size
 */
public record FileSearch(String scanId, String root, String scope, boolean partial, String query,
                         long minSizeBytes, int offset, int limit, long matchingFiles,
                         List<LargestFiles.RankedFile> files) { }
