import React from "react";
import { IconedLabel } from "../general/IconedLabel";
import { IconType } from "../../enums/IconType";

export const HeaderComponent = () => {
    return (
        <div className={"c-header"}>
            <IconedLabel
                style={{ paddingLeft: "1rem", justifyContent: "space-evenly" }}
                width={"22rem"}
                iconType={IconType.STORAGE}
                iconSize={48}
                text={"Storage Analyzer"}
                textSize={30} />
        </div>
    );
}

export default HeaderComponent;

