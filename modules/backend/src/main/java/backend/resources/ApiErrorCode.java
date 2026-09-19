package backend.resources;

/** Stable identifiers for request failures. Clients translate these; the message is an English fallback. */
public enum ApiErrorCode {
    INVALID_REQUEST,
    PATH_REQUIRED,
    PATH_INVALID,
    PATH_NOT_ABSOLUTE,
    FOLDER_NOT_FOUND,
    NOT_A_FOLDER,
    FOLDER_UNREADABLE,
    SCANS_AT_CAPACITY,
    SCANNER_BUSY,
    SCAN_NOT_FOUND,
    SCAN_NOT_COMPLETE,
    PATH_OUTSIDE_SCAN,
    PATH_NOT_IN_SCAN,
    INVALID_PARAMETER,
}
