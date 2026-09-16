import React, { ReactNode, useState } from "react";
export function SplitPane({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(300);
  const clamp = (value: number) => Math.max(240, Math.min(440, value));
  return (
    <div
      className="workspace"
      style={{ "--explorer-width": `${width}px` } as React.CSSProperties}
    >
      {sidebar}
      {sidebar && (
        <div
          role="separator"
          aria-label="Resize explorer"
          aria-orientation="vertical"
          aria-valuenow={width}
          aria-valuemin={240}
          aria-valuemax={440}
          tabIndex={0}
          className="split-handle"
          onKeyDown={(event) => {
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              setWidth((value) =>
                event.key === "Home"
                  ? 240
                  : event.key === "End"
                    ? 440
                    : clamp(value + (event.key === "ArrowRight" ? 20 : -20)),
              );
            }
          }}
          onPointerDown={(event) =>
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              setWidth(
                clamp(
                  event.clientX -
                    event.currentTarget.parentElement!.getBoundingClientRect()
                      .left,
                ),
              );
          }}
          onPointerUp={(event) =>
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        />
      )}
      <div className="workspace-main">{children}</div>
    </div>
  );
}
