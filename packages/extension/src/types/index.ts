/**
 * Extension Type Definitions
 * Re-exports all types for easy importing
 */

// Message types
export type {
  MessageAction,
  SelectionData,
  ExtensionMessage,
  GenerateCardsMessage,
  GenerateCardsFromImageMessage,
  AnswerQuestionMessage,
  SendToMochiMessage,
  GetSelectionMessage,
  GetDOMContextMessage,
  CaptureViewportMessage,
  PingMessage,
  GenerateCardsResponse,
  MochiStatusResponse,
  AuthStatusResponse,
  SendToMochiResponse,
  MochiResult,
  SaveResult,
  GeneratedCard,
  CardPrompt,
  CardStyle,
  UsageInfo,
  SelectionResponse,
  PingResponse,
  DOMContextResponse,
  ViewportScreenshotResponse,
  PageContext,
  RefinementAction,
  RefineCardMessage,
  RefineCardResponse,
} from './messages';

// Storage types
export type {
  SyncStorageData,
  MochiDeck,
  LocalStorageData,
  PluckkSession,
  SessionUser,
  UserProfile,
  SyncStorageKey,
  LocalStorageKey,
} from './storage';

export {
  getSyncStorage,
  setSyncStorage,
  getLocalStorage,
  setLocalStorage,
} from './storage';

// UI state types
export type {
  UIMode,
  SidepanelState,
  EditedCard,
  PopupState,
  CardToSave,
  ProfileDisplayState,
  AuthDisplayState,
  UsageUpdate,
} from './ui-state';

export { CARD_STYLE_LABELS, formatStyleLabel } from './ui-state';

// DOM helper types
export type {
  SidepanelElements,
  PopupElements,
  OptionsElements,
} from './dom';

export {
  getElement,
  getRequiredElement,
  getElementById,
  getRequiredElementById,
  addClickListener,
  addInputListener,
  toggleClass,
  setHidden,
} from './dom';
