import { DirectoryType } from "../enums/DirectoryType";

export class Directory {
    name: string
    absolutePath: string
    type: DirectoryType
    subdirectories: Directory[]
    constructor(name: string, absolutePath: string, type: DirectoryType, subDirectories: Directory[]) {
        this.name = name;
        this.absolutePath = absolutePath;
        this.type = type;
        this.subdirectories = subDirectories;
    }
}