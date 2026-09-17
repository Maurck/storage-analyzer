import React from "react";
import { Alert } from "../../../shared/components/Alert";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Spinner } from "../../../shared/ui/Spinner";
import { backendUrl } from "../../../shared/lib/desktopBridge";
import { TranslationKey } from "../../../shared/i18n/translations";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";
import { ServiceStatus } from "../hooks/useServiceStatus";

interface ServiceStatusBannerProps {
  status: ServiceStatus;
  hasResults: boolean;
  retrying: boolean;
  onRetry(): void;
}

const failures: Record<string, [TranslationKey, TranslationKey]> = {
  "port-in-use": ["service.portInUseTitle", "service.portInUseDescription"],
  "other-service": ["service.portInUseTitle", "service.portInUseDescription"],
  incompatible: ["service.versionTitle", "service.versionDescription"],
  "api-version": ["service.versionTitle", "service.versionDescription"],
  "unsupported-platform": [
    "service.unsupportedTitle",
    "service.unsupportedDescription",
  ],
  timeout: ["service.timeoutTitle", "service.timeoutDescription"],
  exited: ["service.exitedTitle", "service.exitedDescription"],
};

/** Explains why analyses are unavailable and how to recover. Hidden when ready. */
export function ServiceStatusBanner({
  status,
  hasResults,
  retrying,
  onRetry,
}: ServiceStatusBannerProps) {
  const { t } = useTranslation();
  if (status.state === "ready") return null;

  if (status.state === "checking" || status.state === "starting") {
    return (
      <section
        className="service-banner service-banner--waiting"
        aria-labelledby="service-banner-title"
      >
        <Spinner
          label={
            status.state === "checking"
              ? t("service.statusChecking")
              : t("service.statusStarting")
          }
        />
        <div>
          <p id="service-banner-title" className="service-banner__title">
            {status.state === "checking"
              ? t("service.checkingTitle")
              : t("service.startingTitle")}
          </p>
          <p>{t("service.startingDescription")}</p>
        </div>
      </section>
    );
  }

  const [titleKey, descriptionKey] =
    status.state === "unavailable"
      ? status.wasReady
        ? (["service.stoppedTitle", "service.stoppedDescription"] as const)
        : ([
            "service.unavailableTitle",
            "service.unavailableDescription",
          ] as const)
      : failures[status.reason];
  const origin = new URL(backendUrl()).host;

  return (
    <Alert
      variant={
        status.state === "unavailable" && status.wasReady ? "warning" : "error"
      }
      title={t(titleKey)}
      className="service-banner"
    >
      <p>{t(descriptionKey, { origin })}</p>
      {hasResults && <p>{t("service.resultsKept")}</p>}
      <Button
        variant="secondary"
        size="sm"
        onClick={onRetry}
        loading={retrying}
        loadingLabel={t("service.retrying")}
      >
        <Icon name="refresh" size={16} />
        {t("error.tryAgain")}
      </Button>
    </Alert>
  );
}
