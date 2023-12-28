package backend.models;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@NoArgsConstructor
@Getter
@Setter
public class Directory {
    String name;
    List<Directory> subdirectories;

    public Directory(String name) {
        this.name = name;
        this.subdirectories = new ArrayList<>();
    }
}
