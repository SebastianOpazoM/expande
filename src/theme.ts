export type ColorTheme = 'light' | 'dark';

const storageKey = 'expande-color-theme';

export function readColorTheme(): ColorTheme {
  try {
    if (window.localStorage.getItem(storageKey) === 'dark') return 'dark';
  } catch {
    // The explicit light default still works when browser storage is unavailable.
  }
  return 'light';
}

export function applyColorTheme(theme: ColorTheme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // The active document can still use the selected theme for this visit.
  }
}
