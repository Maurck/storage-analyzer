import React, { CSSProperties } from "react";

interface SpinnerProps {
    style?: CSSProperties;
}

export const Spinner = (props: SpinnerProps) => {
    return (
        <div className={"flex-center"} style={props.style}>
            <div className={"spinner"}></div>
        </div>
    )
}
