package backend.models;

import backend.enums.DirectoryType;
import backend.enums.FileCategory;
import backend.enums.NodeIssueCode;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
public class Directory {
    String name = "";
    String absolutePath = "";
    @Setter DirectoryType type = DirectoryType.FOLDER;
    @Setter List<Directory> subdirectories = new ArrayList<>();
    @Setter long sizeBytes;
    @Setter long fileCount;
    @Setter long directoryCount;
    @Setter boolean hasChildren;
    @Setter boolean childrenLoaded = true;
    @Setter boolean partial;
    @Setter String error;
    @Setter NodeIssueCode errorCode;
    /** Files only: when the file was last written, as the scan read it; null when unknown. */
    @Setter Instant lastModified;
    /** Files only: lower-case text after the last dot of the name; null when there is none. */
    @Setter String extension;
    /** Files only; null for folders and skipped items. */
    @Setter FileCategory category;

    public Directory(String name, String absolutePath, DirectoryType type) {
        this.name = name;
        this.absolutePath = absolutePath;
        this.type = type;
    }

}
