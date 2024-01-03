import React, { ReactNode, useState } from "react";
import { IconedLabel } from "../../general/IconedLabel";
import { IconType } from "../../../enums/IconType";
import { Directory } from "../../../models/Directory";
import { DirectoryType } from "../../../enums/DirectoryType";

interface Props {
    directory: Directory
    maxLevel: number;
    level: number;
    paddingBottom?: number;
}

export const DirectoryTreeItem = (props: Props) => {
    const [showChildrenItems, setShowChildrenItems] = useState<boolean>(false);

    const getSubItems = (): ReactNode[] => {
        return props.directory.subdirectories.map((directory: Directory, i) =>
            <DirectoryTreeItem
                key={i}
                directory={directory}
                maxLevel={props.maxLevel}
                level={props.level+1} />)
    }

    const getIconType = () => {
        if (props.directory.type === DirectoryType.FILE) return IconType.FILE;
        if (props.directory.type === DirectoryType.FOLDER && (props.directory.subdirectories.length === 0 || props.level - 1 === props.maxLevel)) return IconType.FOLDER;
        return showChildrenItems ? IconType.EXPAND_MORE : IconType.CHEVRON_RIGHT
    }

    return (
        <div
            className={"c-directory-item-container"}
            style={{paddingLeft: 25, marginBottom: props.paddingBottom}}>
            <a
                className={"c-directory-item u-cursor-pointer-all"}
                onClick={() => {setShowChildrenItems(!showChildrenItems)}}>
                <IconedLabel
                    hideIcon={false}
                    iconType={getIconType()}
                    width={"auto"}
                    textSize={18}
                    text={props.directory.name}
                    textStyle={{paddingLeft: "5px"}} />
            </a>
            {(showChildrenItems && props.level <= props.maxLevel) &&
                getSubItems()
            }
        </div>
    )
}