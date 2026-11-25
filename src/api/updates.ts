import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "./tauri";

// The only network request Sapphire ever makes: a read-only lookup of the
// latest public release. Nothing about the user or their data is sent. The CSP
// in tauri.conf.json allows this host and nothing else.
const LATEST_RELEASE_API = "https://api.github.com/repos/KoRIOz675/Sapphire/releases/latest";
const RELEASES_PAGE = "https://github.com/KoRIOz675/Sapphire/releases/latest";

// Stored in the `settings` table; anything other than "true" means off.
export const AUTO_CHECK_KEY = "update_auto_check";

export type UpdateStatus =
  | { status: "up_to_date" }
  | { status: "no_release" }
  | { status: "available"; version: string }
  | { status: "error"; message: string };

// "v1.2.3" / "1.2.3" -> [1, 2, 3]. Pre-release suffixes are ignored: the
// /releases/latest endpoint never returns drafts or pre-releases anyway.
function parseVersion(v: string): number[] {
  return v
    .replace(/^v/, "")
    .split("-")[0]
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    // 404 = no published release (or the repository can't be reached as public):
    // not the same as being up to date.
    if (res.status === 404) return { status: "no_release" };
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}` };

    const release = (await res.json()) as { tag_name?: string };
    const latest = release.tag_name;
    if (!latest) return { status: "error", message: "missing tag_name" };

    return isNewer(latest, await getVersion())
      ? { status: "available", version: latest.replace(/^v/, "") }
      : { status: "up_to_date" };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function isAutoCheckEnabled(): Promise<boolean> {
  return (await api.getSetting(AUTO_CHECK_KEY)) === "true";
}

export function openReleasesPage() {
  return openUrl(RELEASES_PAGE);
}
