export type ThemeChoice = "light" | "dark" | "system";
export const THEMES: ThemeChoice[] = ["light", "dark", "system"];
const KEY = "better-mcp-theme";

/** Light unless the person chose otherwise; a stored value that isn't a known theme is ignored. */
export function parseTheme(stored: string | null | undefined): ThemeChoice {
  return THEMES.includes(stored as ThemeChoice) ? (stored as ThemeChoice) : "light";
}

export function readTheme(): ThemeChoice {
  try {
    return parseTheme(localStorage.getItem(KEY));
  } catch {
    return "light";
  }
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice;
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
}
