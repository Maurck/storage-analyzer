import React from "react";
import { IconProps } from "../interfaces/IconProps";

export const ChevronRightIcon = (props: IconProps) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" height={props.size} viewBox="0 -960 960 960" width={props.size}>
            <path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" fill={props.fillColor}/>
        </svg>
    )
}