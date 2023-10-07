import React from "react";
import FileTreeComponent from "./FileTreeComponent";
import ChartComponent from "./ChartComponent";
export const BodyComponent = () => {
    return (
        <div className={"c-body"}>
            <FileTreeComponent />
            <ChartComponent />
        </div>
    );
}

export default BodyComponent;

