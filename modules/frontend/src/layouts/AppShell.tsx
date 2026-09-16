import React, { ReactNode } from "react";
import { Icon } from "../shared/ui/Icon";

interface AppShellProps {
  status: string;
  busy: boolean;
  children: ReactNode;
  overlays?: ReactNode;
}

export function AppShell({ status, busy, children, overlays }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#main-content"
          aria-label="Storage Analyzer home"
        >
          <span className="brand-mark">
            <Icon name="hard-drive" size={23} />
          </span>
          <span>
            Storage<span className="brand-light">Analyzer</span>
          </span>
        </a>
        <span className="header-divider" />
        <span className="header-label">WORKSPACE</span>
        <div className="header-status">
          <span className={`status-dot ${busy ? "is-busy" : ""}`} />{" "}
          <span>{status}</span>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
        <footer className="app-footer">
          <span>
            <span className="footer-dot" /> Runs locally on your device
          </span>
          <span>Sizes in KB, MB and GB · Read-only analysis</span>
        </footer>
      </main>
      {overlays}
    </div>
  );
}
