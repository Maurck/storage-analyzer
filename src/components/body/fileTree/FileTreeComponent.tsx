import React, { ReactNode, useState } from "react";
import { FileTreeItem } from "./FileTreeItem";
import { IconedLabel } from "../../general/IconedLabel";
import { IconType } from "../../../enums/IconType";

export const FileTreeComponent = () => {
    const [dirNames, setDirNames] = useState<string[]>(["Archivos de programa", "Archivos de programa(x86)"]);
    const [maxItemLevel, setMaxItemLevel] = useState<number>(10);

    const getItems = (): ReactNode[] => {
        return dirNames.map((item, i) =>
            <FileTreeItem
                key={item}
                pathName={item}
                level={1}
                maxLevel={maxItemLevel}
                paddingBottom={5}
                borderButton={true}
            />);
    };

    return (
        <div className={"c-filetree-container"}>
            <div className={"c-filetree complete-box-shadow"}>
                <IconedLabel style={{gap: "10px", paddingLeft: "20px"}} width={"auto"} height={"60px"} iconType={IconType.FOLDER} text={"C:\\"} textSize={25} iconSize={30}/>
                {getItems()}
            </div>
        </div>
    );
}

export default FileTreeComponent;