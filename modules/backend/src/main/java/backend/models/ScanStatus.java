package backend.models;

import backend.enums.ScanErrorCode;

import java.time.Instant;
import java.util.Map;

/**
 * @param startedAt           when the scan started, as an instant in UTC
 * @param finishedAt          when it completed, failed or was cancelled; null while scanning
 * @param elapsedMillis       time since the scan started; frozen once it ends
 * @param millisSinceActivity time since the scan last recorded an entry, while it is scanning; otherwise null
 * @param currentPath         the folder being read, while scanning; otherwise null
 * @param volume              capacity of the scanned volume when the scan started, or null when unknown
 */
public record ScanStatus(String id, String path, State status, long processedFiles,
                         long processedDirectories, long processedBytes, long skippedCount,
                         String error, ScanErrorCode errorCode, Map<String, Long> errorParams,
                         Instant startedAt, Instant finishedAt, long elapsedMillis, Long millisSinceActivity, String currentPath,
                         Volume volume, Directory root) {
    public enum State { SCANNING, COMPLETE, CANCELLED, ERROR }

    public record Volume(long totalBytes, long usableBytes) { }
}
