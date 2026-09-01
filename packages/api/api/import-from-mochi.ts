// GET/POST /api/import-from-mochi
// GET - Fetch user's Mochi decks for selection
// POST - Import cards from selected decks

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, isAuthError } from '../lib/auth.js';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../lib/db.js';
import type { MochiCard, MochiDeck, ImportFromMochiRequest, ImportResult } from '../lib/types.js';

const MOCHI_API_URL = 'https://app.mochi.cards/api';

interface MochiListResponse<T> {
  docs: T[];
  bookmark?: string;
}

/**
 * Fetch all pages from a Mochi API endpoint
 */
async function fetchAllMochiPages<T>(
  endpoint: string,
  apiKey: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const results: T[] = [];
  let bookmark: string | undefined;

  do {
    const searchParams = new URLSearchParams({ ...params, limit: '100' });
    if (bookmark) searchParams.set('bookmark', bookmark);

    const response = await fetch(`${MOCHI_API_URL}${endpoint}?${searchParams}`, {
      headers: { Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Invalid Mochi API key');
      throw new Error(`Mochi API error: ${response.status}`);
    }

    const data = (await response.json()) as MochiListResponse<T>;
    results.push(...data.docs);
    bookmark = data.bookmark;

    // Mochi recommends sequential requests (1 concurrent)
    if (bookmark) await new Promise((r) => setTimeout(r, 100));
  } while (bookmark);

  return results;
}

/**
 * Parse Mochi card content into question/answer
 * Mochi format: "Question\n---\nAnswer" (may have multiple --- separators)
 */
function parseMochiContent(content: string): { question: string; answer: string } {
  const parts = content.split('\n---\n');
  if (parts.length >= 2) {
    return {
      question: parts[0].trim(),
      answer: parts.slice(1).join('\n---\n').trim(),
    };
  }
  // Fallback: treat entire content as question with empty answer
  return { question: content.trim(), answer: '' };
}

/**
 * Normalize question text for duplicate comparison
 */
function normalizeQuestion(question: string): string {
  return question.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Build deck hierarchy map (deck-id -> full path name)
 */
function buildDeckPathMap(decks: MochiDeck[]): Map<string, string> {
  const deckById = new Map(decks.map((d) => [d.id, d]));
  const pathMap = new Map<string, string>();

  function getPath(deckId: string): string {
    if (pathMap.has(deckId)) return pathMap.get(deckId)!;

    const deck = deckById.get(deckId);
    if (!deck) return '';

    const parentId = deck['parent-id'];
    const parentPath = parentId ? getPath(parentId) : '';
    const fullPath = parentPath ? `${parentPath}/${deck.name}` : deck.name;

    pathMap.set(deckId, fullPath);
    return fullPath;
  }

  decks.forEach((d) => getPath(d.id));
  return pathMap;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
    return;
  }

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const authResult = await authenticateRequest(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user, profile } = authResult;

  if (!profile.mochiApiKey) {
    res.status(400).json({ error: 'Mochi API key not configured' });
    return;
  }

  const mochiApiKey = profile.mochiApiKey;
  const db = getDb();

  // GET - Fetch decks
  if (req.method === 'GET') {
    try {
      const decks = await fetchAllMochiPages<MochiDeck>('/decks', mochiApiKey);
      const activeDecks = decks.filter((d) => !d.archived);

      res.status(200).json({
        decks: activeDecks.map((d) => ({
          id: d.id,
          name: d.name,
          'parent-id': d['parent-id'] || null,
        })),
      });
    } catch (error) {
      console.error('Error fetching Mochi decks:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch decks';
      if (message.includes('Invalid Mochi API key')) {
        res.status(401).json({ error: 'Invalid Mochi API key. Please check your API key in Settings.' });
      } else {
        res.status(500).json({ error: `Failed to fetch decks: ${message}` });
      }
    }
    return;
  }

  // POST - Import cards
  if (req.method === 'POST') {
    const { deckIds, createFolders = true } = req.body as ImportFromMochiRequest;

    if (!deckIds || !Array.isArray(deckIds) || deckIds.length === 0) {
      res.status(400).json({ error: 'No decks selected for import' });
      return;
    }

    // Validate deckIds format
    if (!deckIds.every((id) => typeof id === 'string' && id.length > 0 && id.length < 100)) {
      res.status(400).json({ error: 'Invalid deck ID format' });
      return;
    }

    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      foldersCreated: [],
      errors: [],
    };

    try {
      // Fetch all decks for hierarchy mapping
      const allDecks = await fetchAllMochiPages<MochiDeck>('/decks', mochiApiKey);
      const deckPathMap = buildDeckPathMap(allDecks);

      // Get existing questions for duplicate detection
      const existingCards = await db.select({ question: schema.cards.question }).from(schema.cards).where(eq(schema.cards.userId, user.id));
      const existingQuestions = new Set(existingCards.map((c) => normalizeQuestion(c.question)));

      // Create folders if needed
      const folderIdMap = new Map<string, string>();

      if (createFolders) {
        // Get existing folders
        const existingFolders = await db.select({ id: schema.folders.id, name: schema.folders.name }).from(schema.folders).where(eq(schema.folders.userId, user.id));
        const existingFolderNames = new Map(existingFolders.map((f) => [f.name, f.id]));

        // Create folders for selected decks
        for (const deckId of deckIds) {
          const deckPath = deckPathMap.get(deckId);
          if (!deckPath) continue;

          // Use the leaf name (last segment) as folder name
          const folderName = deckPath.split('/').pop() || deckPath;

          if (existingFolderNames.has(folderName)) {
            folderIdMap.set(deckId, existingFolderNames.get(folderName)!);
          } else {
            try {
              const [newFolder] = await db.insert(schema.folders).values({ userId: user.id, name: folderName }).returning({ id: schema.folders.id });
              folderIdMap.set(deckId, newFolder.id);
              existingFolderNames.set(folderName, newFolder.id);
              result.foldersCreated.push(folderName);
            } catch (folderError) {
              result.errors.push(`Failed to create folder "${folderName}": ${folderError instanceof Error ? folderError.message : String(folderError)}`);
            }
          }
        }
      }

      // Fetch and import cards from each deck
      for (const deckId of deckIds) {
        try {
          const cards = await fetchAllMochiPages<MochiCard>('/cards', mochiApiKey, {
            'deck-id': deckId,
          });

          const cardsToInsert = [];

          for (const card of cards) {
            if (card.archived) continue;

            const { question, answer } = parseMochiContent(card.content);
            if (!question) continue;

            // Skip duplicates
            if (existingQuestions.has(normalizeQuestion(question))) {
              result.skipped++;
              continue;
            }

            // Mark as seen to avoid duplicates within this import
            existingQuestions.add(normalizeQuestion(question));

            cardsToInsert.push({
              userId: user.id,
              question,
              answer,
              style: 'qa',
              tags: [...(card.tags || []), 'imported:mochi'],
              folderId: folderIdMap.get(deckId) || null,
              sourceTitle: 'Imported from Mochi',
            });
          }

          // Batch insert in chunks to avoid memory issues
          const BATCH_SIZE = 500;
          const deckName = deckPathMap.get(deckId) || deckId;

          for (let i = 0; i < cardsToInsert.length; i += BATCH_SIZE) {
            const batch = cardsToInsert.slice(i, i + BATCH_SIZE);
            try {
              await db.insert(schema.cards).values(batch);
              result.imported += batch.length;
            } catch (insertError) {
              result.errors.push(`Failed to insert cards from "${deckName}": ${insertError instanceof Error ? insertError.message : String(insertError)}`);
            }
          }
        } catch (deckError) {
          const deckName = deckPathMap.get(deckId) || deckId;
          const message = deckError instanceof Error ? deckError.message : 'Unknown error';
          result.errors.push(`Error fetching deck "${deckName}": ${message}`);
        }
      }

      result.success = result.errors.length === 0;
      res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      res.status(message.includes('Invalid Mochi API key') ? 401 : 500).json({
        success: false,
        error: message,
        imported: result.imported,
        skipped: result.skipped,
        foldersCreated: result.foldersCreated,
        errors: result.errors,
      });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
