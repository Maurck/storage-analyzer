import React from "react";
import ChartComponent from "./ChartComponent";
import FileTreeComponent from "./fileTree/FileTreeComponent";

export const BodyComponent = () => {
  return (
    <div className="c-body">
      <FileTreeComponent />
      <ChartComponent />
    </div>
  );
};

export default BodyComponent;
