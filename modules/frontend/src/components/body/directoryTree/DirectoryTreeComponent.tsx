import React, { ReactNode, useState } from "react";
import { DirectoryTreeItem } from "./DirectoryTreeItem";
import { IconedLabel } from "../../general/IconedLabel";
import { IconType } from "../../../enums/IconType";
import { useGetDirectory } from "../../../hooks/directories.hooks";
import { Spinner } from "../../general/Spinner";

export const DirectoryTreeComponent = () => {
  const { isLoading, isError, data: directory = null } = useGetDirectory();
  const [ maxItemLevel, setMaxItemLevel ] = useState<number>(20);

  const getItems = (): ReactNode[] => {
    return directory?.subdirectories.map((directory, i) => (
      <DirectoryTreeItem
        key={i}
        directory={directory}
        level={1}
        maxLevel={maxItemLevel}
        paddingBottom={5}
      />
    ));
  };

  return (
    <div className="c-directory-container">
      {directory != null && !isLoading &&
      <>
        <IconedLabel
            style={{ gap: "10px", margin: "20px 10px 0 20px" }}
            width="auto"
            height="60px"
            iconType={IconType.FOLDER}
            text={directory.name || ''}
            textSize={20}
            iconSize={30}
        />
        {getItems()}
      </>
      }
      {isLoading &&
      <Spinner/>}
    </div>
  );
};

export default DirectoryTreeComponent;
