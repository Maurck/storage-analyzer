package backend.services.files;

import backend.enums.FileCategory;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * The versioned catalog that sorts extensions into categories. It is an approximation
 * by name: contents are never read. Raise {@link #VERSION} whenever an extension moves,
 * so saved or compared results can tell that the same file may be counted elsewhere.
 */
public final class FileTypes {
    public static final int VERSION = 1;
    /** Longest extension kept; longer text after the last dot is rarely one. */
    static final int MAX_EXTENSION_LENGTH = 32;
    private static final Map<String, FileCategory> CATALOG = new HashMap<>();

    static {
        // .ts is left out on purpose: it is as often TypeScript as an MPEG transport stream.
        add(FileCategory.VIDEO, "mp4", "m4v", "mkv", "avi", "mov", "wmv", "webm", "flv", "mpg", "mpeg",
                "m2ts", "mts", "3gp", "vob");
        add(FileCategory.IMAGE, "jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "heic", "heif",
                "avif", "raw", "cr2", "cr3", "nef", "arw", "dng", "psd", "svg", "ico");
        add(FileCategory.AUDIO, "mp3", "wav", "flac", "aac", "m4a", "ogg", "oga", "opus", "wma", "aif",
                "aiff", "mid", "midi");
        add(FileCategory.DOCUMENT, "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
                "rtf", "txt", "md", "csv", "epub");
        add(FileCategory.ARCHIVE, "zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst", "cab");
        add(FileCategory.DISK_IMAGE, "iso", "img", "vhd", "vhdx", "vmdk", "vdi", "qcow2", "wim", "dmg");
        add(FileCategory.PROGRAM, "exe", "msi", "msix", "msixbundle", "appx", "appxbundle", "dll");
    }

    private FileTypes() { }

    private static void add(FileCategory category, String... extensions) {
        for (String extension : extensions) {
            if (CATALOG.put(extension, category) != null) throw new IllegalStateException(extension + " is listed twice.");
        }
    }

    /**
     * The text after the last dot of a file name, in lower case, or null when there is none:
     * no dot, a dot only at the start (".gitignore") or at the end, or text too long to be one.
     */
    public static String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot <= 0 || dot == name.length() - 1 || name.length() - dot - 1 > MAX_EXTENSION_LENGTH) return null;
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public static FileCategory categoryOf(String extension) {
        if (extension == null) return FileCategory.NO_EXTENSION;
        return CATALOG.getOrDefault(extension, FileCategory.OTHER);
    }
}
