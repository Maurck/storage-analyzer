import React from "react";
import FileTreeComponent from "./fileTree/FileTreeComponent";
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

