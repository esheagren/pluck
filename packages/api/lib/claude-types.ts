/**
 * Type definitions for Claude API interactions
 */

/**
 * Claude API message role
 */
export type ClaudeRole = 'user' | 'assistant';

/**
 * Text content block
 */
export interface ClaudeTextContent {
  type: 'text';
  text: string;
}

/**
 * Image content block for vision API
 */
export interface ClaudeImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * Content block types
 */
export type ClaudeContentBlock = ClaudeTextContent | ClaudeImageContent;

/**
 * Claude API message
 */
export interface ClaudeMessage {
  role: ClaudeRole;
  content: string | ClaudeContentBlock[];
}

/**
 * Claude API request body
 */
export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
}

/**
 * Claude API response content block
 */
export interface ClaudeResponseContent {
  type: 'text';
  text: string;
}

/**
 * Claude API usage information
 */
export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

/**
 * Claude API successful response
 */
export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ClaudeResponseContent[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: ClaudeUsage;
}

/**
 * Claude API error response
 */
export interface ClaudeErrorResponse {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

/**
 * Gemini API request content part
 */
export interface GeminiContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

/**
 * Gemini API request
 */
export interface GeminiRequest {
  contents: Array<{
    parts: GeminiContentPart[];
  }>;
  generationConfig?: {
    responseModalities?: string[];
  };
}

/**
 * Gemini API response candidate
 */
export interface GeminiCandidate {
  content?: {
    parts?: GeminiContentPart[];
  };
  finishReason?: string;
}

/**
 * Gemini API response
 */
export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: unknown;
}
