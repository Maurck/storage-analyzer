import React, { ReactNode } from "react";
import { Icon } from "../shared/ui/Icon";
import { IconButton } from "../shared/ui/IconButton";
import { useTranslation } from "../shared/i18n/LanguageProvider";

interface AppShellProps {
  status: string;
  busy: boolean;
  children: ReactNode;
  overlays?: ReactNode;
  onOpenSettings?(): void;
}

export function AppShell({
  status,
  busy,
  children,
  overlays,
  onOpenSettings,
}: AppShellProps) {
  const { t } = useTranslation();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("shell.skipToContent")}
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#main-content"
          aria-label={t("shell.brandHome")}
        >
          <span className="brand-mark">
            <Icon name="hard-drive" size={23} />
          </span>
          <span>
            Storage<span className="brand-light">Analyzer</span>
          </span>
        </a>
        <span className="header-divider" />
        <span className="header-label">{t("shell.workspace")}</span>
        <div className="header-status">
          <span className={`status-dot ${busy ? "is-busy" : ""}`} />{" "}
          <span>{status}</span>
        </div>
        {onOpenSettings && (
          <IconButton
            label={t("shell.openSettings")}
            variant="ghost"
            className="header-settings"
            onClick={onOpenSettings}
          >
            <Icon name="settings" size={19} />
          </IconButton>
        )}
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
        <footer className="app-footer">
          <span>
            <span className="footer-dot" /> {t("shell.footerLocal")}
          </span>
          <span>{t("shell.footerUnits")}</span>
        </footer>
      </main>
      {overlays}
    </div>
  );
}
