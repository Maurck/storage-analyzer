import React from "react";
import { IconType } from "../../enums/IconType";
import { StorageIcon } from "../../icons/StorageIcon";
import { Color } from "../../enums/Color";
import { FolderIcon } from "../../icons/FolderIcon";
import { ExpandMoreIcon } from "../../icons/ExpandMoreIcon";
import { ChevronRightIcon } from "../../icons/ChevronRightIcon";

interface Props {
    id?: string;
    onClick?: () => void;
    size?: number;
    iconType: IconType;
}
export const Icon = (props: Props) => {
    const getIcon = () => {
        switch (props.iconType) {
            case IconType.STORAGE:
                return (<StorageIcon size={props.size} fillColor={Color.APP_WHITE}/>);
            case IconType.FOLDER:
                return (<FolderIcon size={props.size} fillColor={Color.APP_WHITE}/>);
            case IconType.EXPAND_MORE:
                return (<ExpandMoreIcon size={props.size} fillColor={Color.APP_WHITE}/>);
            case IconType.CHEVRON_RIGHT:
                return (<ChevronRightIcon size={props.size} fillColor={Color.APP_WHITE}/>);
        }
        return <></>;
    }

    return (
        <svg
            id={props.id}
            onClick={props.onClick}
            width={props.size ?? 24}
            height={props.size ?? 24}
            xmlns="http://www.w3.org/2000/svg">
            {getIcon()}
        </svg>
    )
}