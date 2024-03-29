import React from "react";
import HeaderComponent from "./header/HeaderComponent";
import BodyComponent from "./body/BodyComponent";

export const LayoutComponent = () => {
  return (
    <div className="o-layout">
      <HeaderComponent />
      <BodyComponent />
    </div>
  );
};

export default LayoutComponent;
