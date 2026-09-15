package backend.models;

public record ScanStatus(String id, String path, State status, long processedFiles,
                         long processedDirectories, long processedBytes, long skippedCount,
                         String error, Directory root) {
    public enum State { SCANNING, COMPLETE, CANCELLED, ERROR }
}
