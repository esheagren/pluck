/**
 * Type definitions for React Context
 */

import type { Theme } from './hooks';

// ============================================================================
// Theme Context
// ============================================================================

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}
