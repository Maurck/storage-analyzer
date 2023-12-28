import { useQuery } from "react-query";
import { QueryKey } from "../enums/QueryKey";
import { DirectoryService } from "../services/DirectoryService";
import { Directory } from "../models/Directory";

const directoryService: DirectoryService = new DirectoryService();
export const useGetDirectory = () => {
    return useQuery<Directory>(
        [QueryKey.GET_DIRECTORY],
        async() => await directoryService.getDirectory()
    )
}