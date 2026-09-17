package backend.enums;

/** Why a scan ended in ERROR. */
public enum ScanErrorCode {
    ROOT_UNREADABLE,
    ENTRY_LIMIT,
    MEMORY_BUDGET,
    OUT_OF_MEMORY,
    SCAN_FAILED,
}
