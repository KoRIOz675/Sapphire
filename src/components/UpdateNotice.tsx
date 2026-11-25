import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";

import { checkForUpdate, isAutoCheckEnabled, openReleasesPage } from "../api/updates";

// Startup update notice. Does nothing unless the user opted in via Settings;
// errors are silent here (the manual button in Settings shows them).
export default function UpdateNotice() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await isAutoCheckEnabled())) return;
      const result = await checkForUpdate();
      if (!cancelled && result.status === "available") setVersion(result.version);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!version) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-md items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <Download className="h-4 w-4 shrink-0 text-sapphire-600" />
      <span className="text-sm text-slate-700">{t("updater.available", { version })}</span>
      <button
        className="rounded-sm bg-sapphire-600 px-3 py-1 text-xs font-medium text-white hover:bg-sapphire-700"
        onClick={() => void openReleasesPage()}
      >
        {t("updater.download")}
      </button>
      <button
        className="rounded-sm p-1 text-slate-400 hover:text-slate-600"
        onClick={() => setVersion(null)}
        aria-label={t("updater.dismiss")}
      >
        ×
      </button>
    </div>
  );
}
