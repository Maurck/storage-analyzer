import React, { CSSProperties } from "react";
import Label from "./Label";
import { Icon } from "./Icon";
import { IconType } from "../../enums/IconType";

interface Props {
    style?: CSSProperties;
    width: string;
    iconType: IconType;
    iconSize?: number;
    text: string;
    textSize: number;
    textStyle?: CSSProperties;
}

export const IconedLabel = (props: Props) => {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-evenly", width: props.width, ...props.style }}>
            <Icon iconType={props.iconType} size={props.iconSize}/>
            <Label text={props.text} size={props.textSize} style={props.textStyle}/>
        </div>
    )
}