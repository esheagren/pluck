/**
 * DOM Helper Types
 * Type-safe DOM element access for extension UI components
 */

/**
 * Safely query for an element, returning null if not found
 */
export function getElement<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

/**
 * Query for a required element, throwing if not found
 */
export function getRequiredElement<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return el;
}

/**
 * Safely get element by ID, returning null if not found
 */
export function getElementById<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Get element by ID, throwing if not found
 */
export function getRequiredElementById<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) {
    throw new Error(`Required element not found: #${id}`);
  }
  return el;
}

// Sidepanel DOM element references
export interface SidepanelElements {
  // State containers
  loadingState: HTMLElement | null;
  errorState: HTMLElement | null;
  noSelectionState: HTMLElement | null;
  screenshotState: HTMLElement | null;
  apiKeyState: HTMLElement | null;
  usageLimitState: HTMLElement | null;
  cardsState: HTMLElement | null;

  // Main UI elements
  cardsList: HTMLElement | null;
  errorMessage: HTMLElement | null;
  mochiBtn: HTMLButtonElement | null;
  retryBtn: HTMLButtonElement | null;
  logoText: HTMLElement | null;
  readyHint: HTMLElement | null;
  generateBtn: HTMLButtonElement | null;
  regenerateBtn: HTMLButtonElement | null;
  closeBtn: HTMLButtonElement | null;
  infoBtn: HTMLButtonElement | null;

  // Focus input
  focusInputContainer: HTMLElement | null;
  focusInput: HTMLInputElement | null;
  generateWithFocusBtn: HTMLButtonElement | null;

  // Question input
  questionInputContainer: HTMLElement | null;
  questionInput: HTMLTextAreaElement | null;
  questionSubmitBtn: HTMLButtonElement | null;

  // Settings section
  authLoggedOut: HTMLElement | null;
  authLoggedIn: HTMLElement | null;
  googleSignInBtn: HTMLButtonElement | null;
  usageRow: HTMLElement | null;
  settingsUsageBar: HTMLElement | null;
  settingsUsageText: HTMLElement | null;
  settingsBillingRow: HTMLElement | null;
  settingsProRow: HTMLElement | null;
  settingsUpgradeBtn: HTMLButtonElement | null;
  keepOpenCheckbox: HTMLInputElement | null;

  // Screenshot elements
  screenshotPreviewImg: HTMLImageElement | null;
  screenshotGenerateBtn: HTMLButtonElement | null;
  screenshotClearBtn: HTMLButtonElement | null;
  screenshotFocusInput: HTMLInputElement | null;

  // Count display
  selectedCountEl: HTMLElement | null;
  totalCountEl: HTMLElement | null;
}

// Popup DOM element references
export interface PopupElements {
  // State containers
  loadingState: HTMLElement | null;
  errorState: HTMLElement | null;
  noSelectionState: HTMLElement | null;
  apiKeyState: HTMLElement | null;
  cardsState: HTMLElement | null;

  // Main elements
  cardsList: HTMLElement | null;
  errorMessage: HTMLElement | null;
  sourceInfo: HTMLElement | null;
  copyBtn: HTMLButtonElement | null;
  mochiBtn: HTMLButtonElement | null;
  retryBtn: HTMLButtonElement | null;
  settingsBtn: HTMLButtonElement | null;
  openSettingsBtn: HTMLButtonElement | null;
}

// Options page DOM element references
export interface OptionsElements {
  // Auth sections
  loginSection: HTMLElement | null;
  settingsSection: HTMLElement | null;
  pageSubtitle: HTMLElement | null;

  // Auth buttons
  googleSignInBtn: HTMLButtonElement | null;
  signOutBtn: HTMLButtonElement | null;
  userEmailEl: HTMLElement | null;

  // Usage display
  usageBarFill: HTMLElement | null;
  usageText: HTMLElement | null;
  billingActions: HTMLElement | null;
  proActions: HTMLElement | null;
  upgradeBtn: HTMLButtonElement | null;
  manageSubscriptionBtn: HTMLButtonElement | null;

  // Prompt settings
  systemPromptInput: HTMLTextAreaElement | null;
  resetPromptBtn: HTMLButtonElement | null;

  // Form
  form: HTMLFormElement | null;
  saveBtn: HTMLButtonElement | null;
  statusEl: HTMLElement | null;
  shortcutDisplay: HTMLElement | null;
  closePageBtn: HTMLButtonElement | null;

  // Mochi settings
  mochiApiKeyInput: HTMLInputElement | null;
  mochiDeckSelect: HTMLSelectElement | null;
  fetchDecksBtn: HTMLButtonElement | null;
}

/**
 * Helper to safely add event listener with type inference
 */
export function addClickListener(
  element: HTMLElement | null,
  handler: (event: MouseEvent) => void
): void {
  element?.addEventListener('click', handler);
}

/**
 * Helper to safely add input listener
 */
export function addInputListener(
  element: HTMLElement | null,
  handler: (event: Event) => void
): void {
  element?.addEventListener('input', handler);
}

/**
 * Helper to toggle class on element
 */
export function toggleClass(
  element: HTMLElement | null,
  className: string,
  force?: boolean
): void {
  element?.classList.toggle(className, force);
}

/**
 * Helper to add/remove hidden class
 */
export function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (hidden) {
    element?.classList.add('hidden');
  } else {
    element?.classList.remove('hidden');
  }
}
