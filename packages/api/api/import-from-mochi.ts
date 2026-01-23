// GET/POST /api/import-from-mochi
// GET - Fetch user's Mochi decks for selection
// POST - Import cards from selected decks

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, isAuthError } from '../lib/auth.js';
import { supabaseAdmin } from '../lib/supabase-admin.js';
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
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const authResult = await authenticateRequest(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { user, profile } = authResult;

  if (!profile.mochi_api_key) {
    res.status(400).json({ error: 'Mochi API key not configured' });
    return;
  }

  const mochiApiKey = profile.mochi_api_key;

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
      const message = error instanceof Error ? error.message : 'Failed to fetch decks';
      res.status(message.includes('Invalid Mochi API key') ? 401 : 500).json({ error: message });
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
      const { data: existingCards } = await supabaseAdmin
        .from('cards')
        .select('question')
        .eq('user_id', user.id);

      const existingQuestions = new Set(
        (existingCards || []).map((c: { question: string }) => normalizeQuestion(c.question))
      );

      // Create folders if needed
      const folderIdMap = new Map<string, string>();

      if (createFolders) {
        // Get existing folders
        const { data: existingFolders } = await supabaseAdmin
          .from('folders')
          .select('id, name')
          .eq('user_id', user.id);

        const existingFolderNames = new Map(
          (existingFolders || []).map((f: { id: string; name: string }) => [f.name, f.id])
        );

        // Create folders for selected decks
        for (const deckId of deckIds) {
          const deckPath = deckPathMap.get(deckId);
          if (!deckPath) continue;

          // Use the leaf name (last segment) as folder name
          const folderName = deckPath.split('/').pop() || deckPath;

          if (existingFolderNames.has(folderName)) {
            folderIdMap.set(deckId, existingFolderNames.get(folderName)!);
          } else {
            const { data: newFolder, error: folderError } = await supabaseAdmin
              .from('folders')
              .insert({ user_id: user.id, name: folderName })
              .select('id')
              .single();

            if (folderError) {
              if (folderError.code === '23505') {
                // Duplicate - fetch existing
                const { data: existing } = await supabaseAdmin
                  .from('folders')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('name', folderName)
                  .single();
                if (existing) {
                  folderIdMap.set(deckId, existing.id);
                  existingFolderNames.set(folderName, existing.id);
                }
              } else {
                result.errors.push(`Failed to create folder "${folderName}": ${folderError.message}`);
              }
            } else if (newFolder) {
              folderIdMap.set(deckId, newFolder.id);
              existingFolderNames.set(folderName, newFolder.id);
              result.foldersCreated.push(folderName);
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
              user_id: user.id,
              question,
              answer,
              style: 'qa',
              tags: [...(card.tags || []), 'imported:mochi'],
              folder_id: folderIdMap.get(deckId) || null,
              source_title: 'Imported from Mochi',
            });
          }

          // Batch insert in chunks to avoid memory issues
          const BATCH_SIZE = 500;
          const deckName = deckPathMap.get(deckId) || deckId;

          for (let i = 0; i < cardsToInsert.length; i += BATCH_SIZE) {
            const batch = cardsToInsert.slice(i, i + BATCH_SIZE);
            const { error: insertError } = await supabaseAdmin.from('cards').insert(batch);

            if (insertError) {
              result.errors.push(`Failed to insert cards from "${deckName}": ${insertError.message}`);
            } else {
              result.imported += batch.length;
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
