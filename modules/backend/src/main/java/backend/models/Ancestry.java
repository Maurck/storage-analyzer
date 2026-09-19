package backend.models;

import java.util.List;

/**
 * Where one entry of a completed scan sits, so a client can open its folder without
 * expanding the rest of the tree.
 *
 * @param entry     the entry itself, without children, with its canonical path
 * @param ancestors the folders from the scan root down to the entry's parent, each with
 *                  its direct children; empty for the root
 */
public record Ancestry(String scanId, Directory entry, List<Directory> ancestors) { }
