import React, { ReactNode, useState } from "react";
import { IconedLabel } from "../../general/IconedLabel";
import { IconType } from "../../../enums/IconType";
import { Directory } from "../../../models/Directory";
import { DirectoryType } from "../../../enums/DirectoryType";

interface Props {
    directory: Directory
    maxLevel: number;
    level: number;
    marginBottom?: number;
}

export const DirectoryTreeItem = ({ directory, level, maxLevel, marginBottom }: Props) => {
    const [showChildrenItems, setShowChildrenItems] = useState<boolean>(false);

    const getSubItems = (): ReactNode[] => {
        return directory.subdirectories.map((directory: Directory, i) =>
            <DirectoryTreeItem
                key={i}
                directory={directory}
                maxLevel={maxLevel}
                level={level+1} />)
    }

    const getIconType = () => {
        if (directory.type === DirectoryType.ERROR) return IconType.ROUNDED_ERROR;
        if (directory.type === DirectoryType.FILE) return IconType.FILE;
        if (directory.type === DirectoryType.FOLDER && (directory.subdirectories.length === 0 || level - 1 === maxLevel)) return IconType.FOLDER;
        return showChildrenItems ? IconType.EXPAND_MORE : IconType.CHEVRON_RIGHT
    }

    return (
        <div
            className={"c-directory-item-container"}
            style={{ paddingLeft: 25, marginBottom }}>
            <a
                className={"c-directory-item u-cursor-pointer-all"}
                onClick={() => {setShowChildrenItems(!showChildrenItems)}}>
                <IconedLabel
                    hideIcon={false}
                    iconType={getIconType()}
                    width={"auto"}
                    textSize={18}
                    text={directory.name}
                    textStyle={{paddingLeft: "5px"}} />
            </a>
            {(showChildrenItems && level <= maxLevel) &&
                getSubItems()}
        </div>
    )
}