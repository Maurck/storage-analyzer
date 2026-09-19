const storageKey = "storage-analyzer:recent-folders";
export const MAX_RECENT_FOLDERS = 5;

// Private windows and blocked site data make localStorage throw rather than
// return null, so every access is guarded and failures only lose the list.
function write(folders: string[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(folders));
  } catch {
    // A list that cannot be stored still works for this session.
  }
}

export function readRecentFolders(): string[] {
  try {
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "[]",
    );
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(
        (folder): folder is string =>
          typeof folder === "string" &&
          folder.length > 0 &&
          folder.length <= 32767,
      )
      .slice(0, MAX_RECENT_FOLDERS);
  } catch {
    return [];
  }
}

/** Most recent first, without duplicates. */
export function rememberFolder(folders: string[], folder: string): string[] {
  const next = [folder, ...folders.filter((entry) => entry !== folder)].slice(
    0,
    MAX_RECENT_FOLDERS,
  );
  write(next);
  return next;
}

export function forgetFolder(folders: string[], folder: string): string[] {
  const next = folders.filter((entry) => entry !== folder);
  write(next);
  return next;
}

/** The last element of a path, or the path itself for a drive root. */
export function folderName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const name = trimmed.split(/[\\/]/).pop();
  return name && !/^[A-Za-z]:$/.test(name) ? name : path;
}

export function clearRecentFolders(): string[] {
  write([]);
  return [];
}

const rememberKey = "storage-analyzer:remember-recent";

/** On unless the person turned it off; storage failures keep the default. */
export function readRememberRecent(): boolean {
  try {
    return window.localStorage.getItem(rememberKey) !== "false";
  } catch {
    return true;
  }
}

/** Only the preference: turning it off hides the list but does not clear it. */
export function writeRememberRecent(remember: boolean) {
  try {
    window.localStorage.setItem(rememberKey, String(remember));
  } catch {
    // The choice still applies for this session.
  }
}
