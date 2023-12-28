
export class Directory {
    name: string
    subdirectories: Directory[]
    constructor(name: string, subDirectories: Directory[]) {
        this.name = name;
        this.subdirectories = subDirectories;
    }
}