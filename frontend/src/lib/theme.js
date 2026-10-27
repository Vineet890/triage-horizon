export const THEME_KEY = 'triage-horizon.theme.v1';

export const THEMES = ['light', 'dark'];

export function readTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return THEMES.includes(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
}

export function writeTheme(theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  const next = THEMES.includes(theme) ? theme : 'light';

  root.classList.toggle('dark', next === 'dark');
  root.dataset.theme = next;
  root.style.colorScheme = next;
}

export function currentTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
