import { useCallback, useEffect, useState } from "react";
import { desktopBridge } from "../../../shared/lib/desktopBridge";
import { useTranslation } from "../../../shared/i18n/LanguageProvider";

interface Failure {
  name: string;
  message: string;
}

/**
 * "Show in Explorer" for items of one scan. Only the desktop app can do it; a
 * browser preview gets `available: false` instead of a button that pretends.
 */
export function useShowItem(scanId?: string) {
  const { t, has } = useTranslation();
  const bridge = desktopBridge();
  const available = !!bridge?.showItemInFolder && !!scanId;
  const [failure, setFailure] = useState<Failure | null>(null);

  useEffect(() => setFailure(null), [scanId]);

  const describe = useCallback(
    (code: string) => {
      const desktopKey = `show.${code}`;
      const apiKey = `api.${code}`;
      return has(desktopKey)
        ? t(desktopKey)
        : has(apiKey)
          ? t(apiKey)
          : t("show.unknown");
    },
    [t, has],
  );

  const show = useCallback(
    async (name: string, path: string) => {
      if (!scanId || !bridge?.showItemInFolder) return;
      setFailure(null);
      try {
        const result = await bridge.showItemInFolder(scanId, path);
        if (!result.ok) setFailure({ name, message: describe(result.code) });
      } catch {
        setFailure({ name, message: t("show.unknown") });
      }
    },
    [bridge, describe, scanId, t],
  );

  return {
    available,
    show,
    failure,
    clearFailure: () => setFailure(null),
  };
}
