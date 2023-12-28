import React, { CSSProperties } from "react";
import { Color } from "../../enums/Color";

interface LabelProps {
  text: string;
  size: number;
  style?: CSSProperties;
}

export const Label = (props: LabelProps) => {
  return (
    <label
      style={{
        fontSize: props.size ?? 10,
        color: Color.APP_WHITE,
        ...props.style,
      }}
    >
      {props.text}
    </label>
  );
};

export default Label;
