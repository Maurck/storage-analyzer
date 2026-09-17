import React from "react";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

interface WelcomeStateProps {
  onChooseFolder(): void;
  disabled?: boolean;
}

export function WelcomeState({ onChooseFolder, disabled }: WelcomeStateProps) {
  const { t } = useTranslation();
  return (
    <section className="welcome-panel">
      <div className="welcome-art" aria-hidden="true">
        <div className="art-orbit orbit-one" />
        <div className="art-orbit orbit-two" />
        <div className="art-file file-left">
          <Icon name="file" size={30} />
        </div>
        <div className="art-folder">
          <Icon name="folder-open" size={64} />
        </div>
        <div className="art-file file-right">
          <Icon name="grid" size={26} />
        </div>
        <span className="art-spark" />
      </div>
      <span className="eyebrow">{t("welcome.eyebrow")}</span>
      <h2>{t("welcome.title")}</h2>
      <p>{t("welcome.description")}</p>
      <Button size="lg" onClick={onChooseFolder} disabled={disabled}>
        <Icon name="folder-open" />
        {t("welcome.chooseFolder")}
      </Button>
      <span className="privacy-note">
        <Icon name="check" size={15} />
        {t("welcome.privacy")}
      </span>
      <div className="welcome-features">
        <span>
          <Icon name="grid" />
          {t("welcome.featureBreakdown")}
        </span>
        <span>
          <Icon name="search" />
          {t("welcome.featureFind")}
        </span>
        <span>
          <Icon name="folder" />
          {t("welcome.featureExplore")}
        </span>
      </div>
    </section>
  );
}
