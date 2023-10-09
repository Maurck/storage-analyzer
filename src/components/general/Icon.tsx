import React from "react";
import { IconType } from "../../enums/IconType";
import { StorageIcon } from "../../icons/StorageIcon";
import { Color } from "../../enums/Color";

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
        }
        return <></>;
    }

    return (
        <svg
            id={props.id}
            // className={`h-icon ${props.onClick ? "clickable" : ""} ${props.className || ""} ${props.type}`}
            onClick={props.onClick}
            width={props.size ?? 24}
            height={props.size ?? 24}
            // data-test={props.dataTest}
            // viewBox={`0 0 ${originalWidth} ${originalHeight}`}
            // fill={fill}
            xmlns="http://www.w3.org/2000/svg"
            // avoid resizing when the window is too small
            // style={{ ...props.style, ...{ minHeight: width, minWidth: width } }}
            >
            {getIcon()}
        </svg>
    )
}