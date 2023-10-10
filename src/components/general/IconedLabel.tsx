import React, { CSSProperties } from "react";
import Label from "./Label";
import { Icon } from "./Icon";
import { IconType } from "../../enums/IconType";

interface Props {
    style?: CSSProperties;
    width: string;
    height?: string;
    hideIcon?: boolean;
    iconType: IconType;
    iconSize?: number;
    text: string;
    textSize: number;
    textStyle?: CSSProperties;
}

export const IconedLabel = (props: Props) => {
    return (
        <div style={{ display: "flex", alignItems: "center", width: props.width, height: props.height, ...props.style }}>
            {!props.hideIcon &&
                <Icon iconType={props.iconType} size={props.iconSize}/>}
            <Label text={props.text} size={props.textSize} style={props.textStyle}/>
        </div>
    )
}