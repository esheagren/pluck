// Theme utility module for Pluckk Chrome Extension

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Get the current theme preference from storage
 */
export async function getThemePreference(): Promise<Theme> {
  const result = await chrome.storage.sync.get([STORAGE_KEY]);
  return result[STORAGE_KEY] || 'light';
}

/**
 * Save theme preference to storage
 */
export async function setThemePreference(theme: Theme): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: theme });
}

/**
 * Apply theme to the document
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Initialize theme on page load
 * Returns the current theme and sets up storage change listener
 */
export async function initializeTheme(
  onThemeChange?: (theme: Theme) => void
): Promise<Theme> {
  const theme = await getThemePreference();
  applyTheme(theme);

  // Listen for theme changes from other extension pages
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes[STORAGE_KEY]) {
      const newTheme: Theme = changes[STORAGE_KEY].newValue || 'light';
      applyTheme(newTheme);
      onThemeChange?.(newTheme);
    }
  });

  return theme;
}

/**
 * Toggle between light and dark mode
 */
export async function toggleTheme(): Promise<Theme> {
  const current = await getThemePreference();
  const newTheme: Theme = current === 'light' ? 'dark' : 'light';
  await setThemePreference(newTheme);
  applyTheme(newTheme);
  return newTheme;
}
