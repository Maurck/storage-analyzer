package backend.models;

import backend.enums.DirectoryType;
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

    public Directory(String name, String absolutePath, DirectoryType type) {
        this.name = name;
        this.absolutePath = absolutePath;
        this.type = type;
    }

    public Directory(String name, String absolutePath) {
        this.name = name;
        this.absolutePath = absolutePath;
    }

    public boolean isFile() {
        return type.equals(DirectoryType.FILE);
    }

    public void setTypeByIsFile(boolean isFile) {
        type = isFile ? DirectoryType.FILE : DirectoryType.FOLDER;
    }
}
