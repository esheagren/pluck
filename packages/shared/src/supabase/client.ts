// Supabase client factory
// Creates a Supabase client with configurable options

import { SUPABASE_URL, SUPABASE_KEY } from '../constants/api';
import type {
  SupabaseClientOptions,
  SaveCardOptions,
  SaveCardResult,
  GetCardsByUserOptions,
  UpdateResult,
  SupabaseCardClient,
  CardRow,
} from './types';

/**
 * Create a Supabase client with optional configuration overrides
 * @param options - Configuration options
 * @returns Supabase client with card operations
 */
export function createSupabaseClient(options: SupabaseClientOptions = {}): SupabaseCardClient {
  const url = options.url || SUPABASE_URL;
  const key = options.key || SUPABASE_KEY;
  const onError = options.onError || console.error;

  const headers: Record<string, string> = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  return {
    /**
     * Save a card to Supabase
     * @param question - Card question
     * @param answer - Card answer
     * @param sourceUrl - Source URL
     * @param options - Required parameters
     * @returns Promise with success status and card ID
     */
    async saveCard(
      question: string,
      answer: string,
      sourceUrl: string,
      saveOptions: SaveCardOptions = { userId: '' }
    ): Promise<SaveCardResult> {
      try {
        const { userId, accessToken } = saveOptions;

        // Require user_id for all card saves
        if (!userId) {
          throw new Error('User must be logged in to save cards');
        }

        // Use user's token if provided, otherwise fall back to anon key
        const authHeaders = accessToken
          ? { ...headers, 'Authorization': `Bearer ${accessToken}` }
          : headers;

        const cardData = {
          question,
          answer,
          source_url: sourceUrl,
          user_id: userId
        };

        const response = await fetch(`${url}/rest/v1/cards`, {
          method: 'POST',
          headers: { ...authHeaders, 'Prefer': 'return=representation' },
          body: JSON.stringify(cardData)
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Supabase error: ${error}`);
        }

        const data = await response.json() as CardRow[];
        return { success: true, cardId: data[0]?.id };
      } catch (error) {
        onError('Supabase saveCard error:', error);
        throw error;
      }
    },

    /**
     * Fetch all cards from Supabase (deprecated - use getCardsByUser instead)
     * @param order - Order clause (default: created_at.desc)
     * @returns Array of cards
     */
    async fetchCards(order: string = 'created_at.desc'): Promise<CardRow[]> {
      try {
        const response = await fetch(`${url}/rest/v1/cards?select=*&order=${order}`, {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        return await response.json() as CardRow[];
      } catch (error) {
        onError('Supabase fetchCards error:', error);
        return [];
      }
    },

    /**
     * Fetch cards for a specific user
     * @param userId - User ID to filter by (required)
     * @param options - Optional parameters
     * @returns Array of user's cards
     */
    async getCardsByUser(
      userId: string,
      getOptions: GetCardsByUserOptions = {}
    ): Promise<CardRow[]> {
      if (!userId) {
        throw new Error('userId is required to fetch cards');
      }

      const { accessToken, order = 'created_at.desc' } = getOptions;

      try {
        const authHeaders = accessToken
          ? { 'apikey': key, 'Authorization': `Bearer ${accessToken}` }
          : { 'apikey': key, 'Authorization': `Bearer ${key}` };

        const response = await fetch(
          `${url}/rest/v1/cards?user_id=eq.${userId}&select=*&order=${order}`,
          { headers: authHeaders }
        );

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        return await response.json() as CardRow[];
      } catch (error) {
        onError('Supabase getCardsByUser error:', error);
        return [];
      }
    },

    /**
     * Update a card's image URL
     * @param cardId - Card ID
     * @param imageUrl - Image URL
     * @returns Success status
     */
    async updateCardImage(cardId: string, imageUrl: string): Promise<UpdateResult> {
      try {
        const response = await fetch(`${url}/rest/v1/cards?id=eq.${cardId}`, {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ image_url: imageUrl })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Supabase update error: ${error}`);
        }

        return { success: true };
      } catch (error) {
        onError('Supabase updateCardImage error:', error);
        throw error;
      }
    },

    /**
     * Upload an image to Supabase Storage
     * @param imageData - Base64 image data
     * @param mimeType - Image MIME type
     * @param cardId - Card ID (used for filename)
     * @returns Public URL of uploaded image
     */
    async uploadImage(imageData: string, mimeType: string, cardId: string): Promise<string> {
      const ext = mimeType.includes('png') ? 'png' : 'jpg';
      const filename = `${cardId}.${ext}`;

      // Convert base64 to blob
      const byteCharacters = atob(imageData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const response = await fetch(`${url}/storage/v1/object/card-images/${filename}`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': mimeType
        },
        body: blob
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase storage error: ${error}`);
      }

      // Return the public URL
      return `${url}/storage/v1/object/public/card-images/${filename}`;
    }
  };
}
