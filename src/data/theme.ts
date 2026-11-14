export type Theme = "dark" | "light";
const KEY = "po.theme";

export function savedTheme(): Theme {
  try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* private window: applies for this session only */ }
}
export function toggleTheme(): Theme {
  const next: Theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
  return next;
}
