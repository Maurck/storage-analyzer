package backend.enums;

/**
 * A family of file extensions. It says what a file is called, never what it contains:
 * a renamed file lands in the category of its new extension.
 */
public enum FileCategory {
    VIDEO,
    IMAGE,
    AUDIO,
    DOCUMENT,
    ARCHIVE,
    DISK_IMAGE,
    PROGRAM,
    /** An extension outside the catalog. */
    OTHER,
    /** No extension at all, including names such as ".gitignore". */
    NO_EXTENSION,
}
