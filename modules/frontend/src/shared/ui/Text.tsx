import React, { HTMLAttributes } from "react";

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: "p" | "span" | "h1" | "h2" | "h3";
}

export function Text({
  as: Element = "p",
  className = "",
  ...props
}: TextProps) {
  return <Element {...props} className={`sa-text ${className}`.trim()} />;
}
