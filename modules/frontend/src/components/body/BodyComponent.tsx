import React from "react";
import ChartComponent from "./ChartComponent";
import DirectoryTreeComponent from "./directoryTree/DirectoryTreeComponent";

export const BodyComponent = () => {
  return (
    <div className="c-body">
      <DirectoryTreeComponent />
      <ChartComponent />
    </div>
  );
};

export default BodyComponent;
