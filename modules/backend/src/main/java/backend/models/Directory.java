package backend.models;

import backend.enums.DirectoryType;
import backend.enums.NodeIssueCode;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    public Directory(String name, String absolutePath, DirectoryType type) {
        this.name = name;
        this.absolutePath = absolutePath;
        this.type = type;
    }

}
