import React, { ReactNode, useState } from "react";
import { IconedLabel } from "../../general/IconedLabel";
import { IconType } from "../../../enums/IconType";

interface Props {
    pathName: string;
    maxLevel: number;
    level: number;
    paddingBottom?: number;
}

export const FileTreeItem = (props: Props) => {
    const [showChildrenItems, setShowChildrenItems] = useState<boolean>(false);
    const [subItems, setSubItems] = useState<string[]>(["Sub1 Nivel " + props.level, "Sub2 Nivel " + props.level]);

    const getSubItems = (): ReactNode[] => {
        return subItems.map(item => <FileTreeItem key={item} pathName={item} maxLevel={props.maxLevel} level={props.level+1}/>)
    }

    return (
        <div
            className={"c-filetree-item-container"}
            style={{paddingLeft: 25, marginBottom: props.paddingBottom}}>
            <a
                className={"c-filetree-item u-cursor-pointer-all"}
                onClick={() => {setShowChildrenItems(!showChildrenItems)}}>
                <IconedLabel hideIcon={props.level - 1 === props.maxLevel} iconType={showChildrenItems ? IconType.EXPAND_MORE : IconType.CHEVRON_RIGHT} width={"auto"} textSize={15} text={props.pathName} textStyle={{paddingLeft: "5px"}}/>
            </a>
            {(showChildrenItems && props.level <= props.maxLevel) &&
                getSubItems()
            }
        </div>
    )
}