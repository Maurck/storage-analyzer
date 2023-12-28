import React from "react";
import { IconProps } from "../interfaces/IconProps";

export const StorageIcon = (props: IconProps) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" height={props.size} viewBox="0 -960 960 960" width={props.size}>
            <path d="M120-160v-160h720v160H120Zm80-40h80v-80h-80v80Zm-80-440v-160h720v160H120Zm80-40h80v-80h-80v80Zm-80 280v-160h720v160H120Zm80-40h80v-80h-80v80Z" fill={props.fillColor}/>
        </svg>
    )
}