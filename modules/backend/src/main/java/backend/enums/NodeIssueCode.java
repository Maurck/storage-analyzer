package backend.enums;

/** Why a node is excluded, unreadable or partial. */
public enum NodeIssueCode {
    EXCLUDED_LINK,
    DEPTH_LIMIT,
    PATH_UNREADABLE,
    CONTENTS_PARTIALLY_UNREADABLE,
}
