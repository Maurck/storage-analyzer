import { RequestService } from "./RequestService";

export class DirectoryService extends RequestService {
    constructor() {
        super("http://localhost:5000")
    }

    public getDirectory = async() => {
        return this.fetch("/directory", "There was an error when retrieving the directory");
    }
}