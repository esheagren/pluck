// The diary. Every change to a card is one of these, appended and never edited.
// A card's current state is what you get by reducing its events in order.

import type { CardSpec, ComponentId, ComponentState, Provenance, Rating } from './entities.js';

export interface EventBase {
  id: string;
  userId: string;
  cardId: string;
  /** When it happened, ISO. Server-stamped on write. */
  at: string;
  /** Server-assigned, monotonically increasing; the sync cursor. Absent until stored. */
  seq?: number;
}

export type CardEventBody =
  | {
      type: 'card.ingest';
      spec: CardSpec;
      provenance: Provenance | null;
      folderId: string | null;
      tags: string[];
      captureKey: string | null;
      imageUrl?: string | null;
    }
  | { type: 'card.review'; componentId: ComponentId; rating: Rating; sessionId?: string | null; responseMs?: number | null }
  /** Sets a component's whole state. Used by the backfill, by undo, and by algorithm swaps. */
  | { type: 'card.reschedule'; componentId: ComponentId; state: ComponentState }
  | { type: 'card.setDeleted'; isDeleted: boolean }
  | { type: 'card.setSpec'; spec: CardSpec }
  | { type: 'card.setProvenance'; provenance: Provenance | null }
  | { type: 'card.setFolder'; folderId: string | null }
  | { type: 'card.setTags'; tags: string[] }
  | { type: 'card.setImage'; imageUrl: string | null };

export type CardEvent = EventBase & CardEventBody;
export type CardEventType = CardEventBody['type'];

export const CARD_EVENT_TYPES: readonly CardEventType[] = [
  'card.ingest', 'card.review', 'card.reschedule', 'card.setDeleted',
  'card.setSpec', 'card.setProvenance', 'card.setFolder', 'card.setTags', 'card.setImage',
];

/** Stable order for reduction: by time, then by server sequence, then by id (so ties are deterministic). */
export function compareEvents(a: CardEvent, b: CardEvent): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  const sa = a.seq ?? 0, sb = b.seq ?? 0;
  if (sa !== sb) return sa - sb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortEvents(events: readonly CardEvent[]): CardEvent[] {
  return [...events].sort(compareEvents);
}
