import React from "react";
import { Button } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";

interface WelcomeStateProps {
  onChooseFolder(): void;
}

export function WelcomeState({ onChooseFolder }: WelcomeStateProps) {
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
      <span className="eyebrow">A CLEARER VIEW OF YOUR FILES</span>
      <h2>A little clarity. A lot of space.</h2>
      <p>
        Choose a folder to uncover its largest files, explore what’s inside, and
        understand how your storage adds up.
      </p>
      <Button size="lg" onClick={onChooseFolder}>
        <Icon name="folder-open" />
        Choose a folder
      </Button>
      <span className="privacy-note">
        <Icon name="check" size={15} />
        Local analysis. Your files stay on your device.
      </span>
      <div className="welcome-features">
        <span>
          <Icon name="grid" />
          Visual breakdown
        </span>
        <span>
          <Icon name="search" />
          Find large files
        </span>
        <span>
          <Icon name="folder" />
          Explore every folder
        </span>
      </div>
    </section>
  );
}
