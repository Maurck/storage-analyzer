import React, { ReactNode, useState } from "react";
import { DirectoryTreeItem } from "./DirectoryTreeItem";
import { IconedLabel } from "../../general/IconedLabel";
import { IconType } from "../../../enums/IconType";
import { useGetDirectory } from "../../../hooks/directories.hooks";
import { Spinner } from "../../general/Spinner";

export const DirectoryTreeComponent = () => {
  const { isLoading, isError, data: directory = null } = useGetDirectory();
  const [ maxItemLevel, setMaxItemLevel ] = useState<number>(4);

  const getItems = (): ReactNode[] => {
    return directory?.subdirectories.map((directory, i) => (
      <DirectoryTreeItem
        key={i}
        directory={directory}
        level={1}
        maxLevel={maxItemLevel}
        marginBottom={5}
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
            textSize={22}
            iconSize={32}
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
