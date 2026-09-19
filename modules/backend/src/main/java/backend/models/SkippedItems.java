package backend.models;

import backend.enums.DirectoryType;
import backend.enums.NodeIssueCode;

import java.util.List;

/**
 * One page of the items a completed scan skipped or could not fully read, by path.
 *
 * @param total    items flagged in the scan; equals the scan's skippedCount
 * @param recorded items that can be listed; lower than total when the list was truncated
 */
public record SkippedItems(String scanId, long total, int recorded, int offset, List<SkippedItem> items) {
    /** @param relativePath path from the scan root; empty for the root itself */
    public record SkippedItem(String name, String absolutePath, String relativePath, DirectoryType type,
                              NodeIssueCode code) { }
}
