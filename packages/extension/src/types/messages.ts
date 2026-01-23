/**
 * Chrome Extension Message Types
 * Defines all message actions and their payloads for inter-component communication
 */

// All possible message actions sent between extension components
export type MessageAction =
  | 'generateCards'
  | 'generateCardsFromImage'
  | 'answerQuestion'
  | 'sendToMochi'
  | 'saveToSupabase'
  | 'getMochiStatus'
  | 'getAuthStatus'
  | 'getSelection'
  | 'getDOMContext'
  | 'captureViewport'
  | 'ping';

// Selection data from content script
export interface SelectionData {
  selection: string;
  context: string;
  url: string;
  title: string;
  selector?: string;
  textOffset?: number;
}

// Base message interface
export interface ExtensionMessage {
  action: MessageAction;
  [key: string]: unknown;
}

// Generate cards message
export interface GenerateCardsMessage extends ExtensionMessage {
  action: 'generateCards';
  focusText?: string;
  cachedSelection?: SelectionData | null;
}

// Generate cards from image message
export interface GenerateCardsFromImageMessage extends ExtensionMessage {
  action: 'generateCardsFromImage';
  imageData: string;
  mimeType: string;
  focusText?: string;
  pageContext?: PageContext;
}

// Answer question message
export interface AnswerQuestionMessage extends ExtensionMessage {
  action: 'answerQuestion';
  question: string;
  url?: string;
  title?: string;
}

// Send to Mochi message
export interface SendToMochiMessage extends ExtensionMessage {
  action: 'sendToMochi';
  question: string;
  answer: string;
  sourceUrl: string;
  tags?: string[];
  screenshotData?: string;
  screenshotMimeType?: string;
  generateDiagram?: boolean;
  diagramPrompt?: string;
  // Source context for future features (Review Chat, QA analysis)
  sourceSelection?: string;
  sourceContext?: string;
  sourceTitle?: string;
  // Source anchoring for deep-linking
  sourceSelector?: string;
  sourceTextOffset?: number;
}

// Save to Supabase message
export interface SaveToSupabaseMessage extends ExtensionMessage {
  action: 'saveToSupabase';
  question: string;
  answer: string;
  sourceUrl: string;
}

// Content script messages
export interface GetSelectionMessage extends ExtensionMessage {
  action: 'getSelection';
}

export interface PingMessage extends ExtensionMessage {
  action: 'ping';
}

export interface GetDOMContextMessage extends ExtensionMessage {
  action: 'getDOMContext';
}

export interface CaptureViewportMessage extends ExtensionMessage {
  action: 'captureViewport';
}

// Response types
export interface GenerateCardsResponse {
  cards?: GeneratedCard[];
  source?: { url: string; title: string };
  selectionData?: SelectionData;
  usage?: UsageInfo;
  error?: string;
  message?: string;
  isQuestionMode?: boolean;
}

export interface MochiStatusResponse {
  configured: boolean;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user?: { email: string; id: string } | null;
  error?: string;
}

export interface SendToMochiResponse {
  mochi: MochiResult;
  supabase: SupabaseResult;
}

export interface MochiResult {
  success?: boolean;
  cardId?: string;
  error?: string;
  message?: string;
}

export interface SupabaseResult {
  success?: boolean;
  cardId?: string;
  error?: string;
  message?: string;
}

// Generated card from API
export interface GeneratedCard {
  style: CardStyle;
  question?: string;
  answer?: string;
  tags?: string[];
  // Bidirectional cards
  forward?: { question: string; answer: string };
  reverse?: { question: string; answer: string };
  // Cloze list cards
  list_name?: string;
  items?: string[];
  prompts?: CardPrompt[];
  // Diagram cards
  diagram_prompt?: string;
  // Question mode
  wasImproved?: boolean;
  originalQuestion?: string;
}

export interface CardPrompt {
  question: string;
  answer: string;
}

export type CardStyle =
  | 'qa'
  | 'qa_bidirectional'
  | 'cloze'
  | 'cloze_list'
  | 'conceptual'
  | 'definition'
  | 'example'
  | 'explanation'
  | 'application'
  | 'diagram';

export interface UsageInfo {
  cardsThisMonth?: number;
  limit?: number;
  input_tokens?: number;
  output_tokens?: number;
}

// Selection response from content script
export interface SelectionResponse {
  selection: string;
  context: string;
  url: string;
  title: string;
  selector?: string;
  textOffset?: number;
}

export interface PingResponse {
  pong: boolean;
}

// DOM context response for image-based card generation
export interface DOMContextResponse {
  headings: string[];
  visibleText: string;
  url: string;
  title: string;
}

// Viewport screenshot response
export interface ViewportScreenshotResponse {
  imageData: string;
  mimeType: string;
}

// Page context for image-based card generation (combines DOM text + viewport screenshot)
export interface PageContext {
  domContext: DOMContextResponse;
  viewportScreenshot?: ViewportScreenshotResponse;
}
