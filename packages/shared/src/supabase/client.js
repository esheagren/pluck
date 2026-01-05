// Supabase client factory
// Creates a Supabase client with configurable options

import { SUPABASE_URL, SUPABASE_KEY } from '../constants/api.js';

/**
 * Create a Supabase client with optional configuration overrides
 * @param {Object} options - Configuration options
 * @param {string} options.url - Supabase URL (defaults to configured URL)
 * @param {string} options.key - Supabase API key (defaults to configured key)
 * @param {Function} options.onError - Error handler function
 * @returns {Object} Supabase client with card operations
 */
export function createSupabaseClient(options = {}) {
  const url = options.url || SUPABASE_URL;
  const key = options.key || SUPABASE_KEY;
  const onError = options.onError || console.error;

  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  return {
    /**
     * Save a card to Supabase
     * @param {string} question - Card question
     * @param {string} answer - Card answer
     * @param {string} sourceUrl - Source URL
     * @returns {Promise<{success: boolean, cardId: string}>}
     */
    async saveCard(question, answer, sourceUrl) {
      try {
        const response = await fetch(`${url}/rest/v1/cards`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            question,
            answer,
            source_url: sourceUrl
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Supabase error: ${error}`);
        }

        const data = await response.json();
        return { success: true, cardId: data[0]?.id };
      } catch (error) {
        onError('Supabase saveCard error:', error);
        throw error;
      }
    },

    /**
     * Fetch all cards from Supabase
     * @param {string} order - Order clause (default: created_at.desc)
     * @returns {Promise<Array>} Array of cards
     */
    async fetchCards(order = 'created_at.desc') {
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

        return await response.json();
      } catch (error) {
        onError('Supabase fetchCards error:', error);
        return [];
      }
    },

    /**
     * Update a card's image URL
     * @param {string} cardId - Card ID
     * @param {string} imageUrl - Image URL
     * @returns {Promise<{success: boolean}>}
     */
    async updateCardImage(cardId, imageUrl) {
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
     * @param {string} imageData - Base64 image data
     * @param {string} mimeType - Image MIME type
     * @param {string} cardId - Card ID (used for filename)
     * @returns {Promise<string>} Public URL of uploaded image
     */
    async uploadImage(imageData, mimeType, cardId) {
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
