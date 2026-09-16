import React, { ReactNode, SVGProps } from "react";

export type IconName =
  | "folder"
  | "file"
  | "chevron-right"
  | "chevron-down"
  | "hard-drive"
  | "search"
  | "refresh"
  | "folder-open"
  | "arrow-left"
  | "arrow-right"
  | "close"
  | "check"
  | "alert"
  | "info"
  | "grid"
  | "list"
  | "copy"
  | "more"
  | "stop"
  | "external"
  | "menu"
  | "arrow-up"
  | "arrow-down"
  | "settings";

const paths: Record<IconName, ReactNode> = {
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
  folder: (
    <path d="M3 7V5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
  ),
  "folder-open": (
    <>
      <path d="M3 17V5a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v2" />
      <path d="m3 19 3-9h16l-3 9H3Z" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H5v18h14V8Z" />
      <path d="M14 3v5h5M8 13h8M8 17h6" />
    </>
  ),
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "hard-drive": (
    <>
      <path d="m3 14 3-10h12l3 10M3 14h18v6H3Z" />
      <path d="M7 17h.01M11 17h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.1 8a7 7 0 0 1 11.7-3L20 8M4 16l3.2 3A7 7 0 0 0 18.9 16" />
    </>
  ),
  "arrow-left": <path d="m11 5-7 7 7 7M4 12h16" />,
  "arrow-right": <path d="m13 5 7 7-7 7M4 12h16" />,
  "arrow-up": <path d="m5 11 7-7 7 7M12 4v16" />,
  "arrow-down": <path d="m5 13 7 7 7-7M12 4v16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m4 12 5 5L20 6" />,
  alert: (
    <>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  list: <path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01" />,
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  external: (
    <>
      <path d="M14 3h7v7M21 3 10 14M10 3H3v18h18v-7" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
};

export interface IconProps extends Omit<
  SVGProps<SVGSVGElement>,
  "name" | "children"
> {
  name: IconName;
  size?: number | string;
}

export function Icon({ name, size = 20, className = "", ...props }: IconProps) {
  return (
    <svg
      {...props}
      className={`sa-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
