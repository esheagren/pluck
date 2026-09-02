// One pure function turns a card's events into its current state. The API applies it
// incrementally on every write and rebuilds from the full diary when events arrive
// out of order (or when the scheduler changes).

import { componentIdsOf, type Card, type ComponentId, type ComponentState } from './entities.js';
import { sortEvents, type CardEvent } from './events.js';
import { defaultScheduler, MECHANICS_OFF, type Scheduler } from './scheduler/index.js';

export class ReducerError extends Error {
  constructor(message: string, public readonly event: CardEvent) {
    super(message);
    this.name = 'ReducerError';
  }
}

function initialComponents(ids: ComponentId[], at: string, scheduler: Scheduler): Record<ComponentId, ComponentState> {
  const now = new Date(at);
  const out: Record<ComponentId, ComponentState> = {};
  for (const id of ids) out[id] = scheduler.initial(now);
  return out;
}

/**
 * Apply one event. Throws ReducerError for anything but an ingest on a card that
 * does not exist yet. A review of a component the spec no longer has is ignored
 * (the spec was edited after the review was queued), as Orbit does.
 */
export function reduce(card: Card | null, event: CardEvent, scheduler: Scheduler = defaultScheduler): Card {
  if (event.type === 'card.ingest') {
    if (card) {
      // Re-ingesting an existing card never loses history: keep spec and schedules,
      // un-delete, and adopt provenance only if we had none.
      return {
        ...card,
        isDeleted: false,
        provenance: card.provenance ?? event.provenance,
        folderId: card.folderId ?? event.folderId,
        captureKey: card.captureKey ?? event.captureKey,
        imageUrl: card.imageUrl ?? event.imageUrl ?? null,
      };
    }
    return {
      id: event.cardId,
      userId: event.userId,
      spec: event.spec,
      provenance: event.provenance,
      folderId: event.folderId,
      tags: event.tags ?? [],
      imageUrl: event.imageUrl ?? null,
      captureKey: event.captureKey,
      isDeleted: false,
      createdAt: event.at,
      components: initialComponents(componentIdsOf(event.spec), event.at, scheduler),
    };
  }

  if (!card) throw new ReducerError(`${event.type} for card ${event.cardId} before its ingest`, event);

  switch (event.type) {
    case 'card.review': {
      const state = card.components[event.componentId];
      if (!state) return card;
      // Replay with the mechanics that were in force when the rating happened.
      const next = scheduler.next(state, event.rating, new Date(event.at), event.mechanics ?? MECHANICS_OFF);
      return { ...card, components: { ...card.components, [event.componentId]: next } };
    }
    case 'card.reschedule':
      return { ...card, components: { ...card.components, [event.componentId]: { ...event.state } } };
    case 'card.setDeleted':
      return { ...card, isDeleted: event.isDeleted };
    case 'card.setSpec': {
      // Components that survive the edit keep their schedule; new ones start fresh; gone ones go.
      const ids = componentIdsOf(event.spec);
      const components: Record<ComponentId, ComponentState> = {};
      const fresh = initialComponents(ids, event.at, scheduler);
      for (const id of ids) components[id] = card.components[id] ?? fresh[id];
      return { ...card, spec: event.spec, components };
    }
    case 'card.setProvenance':
      return { ...card, provenance: event.provenance };
    case 'card.setFolder':
      return { ...card, folderId: event.folderId };
    case 'card.setTags':
      return { ...card, tags: [...event.tags] };
    case 'card.setImage':
      return { ...card, imageUrl: event.imageUrl };
    default: {
      const never: never = event;
      throw new ReducerError(`Unknown event ${(never as CardEvent).type}`, event);
    }
  }
}

/** The card as it stands after all its events. Null if it was never ingested. */
export function rebuild(events: readonly CardEvent[], scheduler: Scheduler = defaultScheduler): Card | null {
  let card: Card | null = null;
  for (const ev of sortEvents(events)) card = reduce(card, ev, scheduler);
  return card;
}

/**
 * Apply new events on top of a stored snapshot. If any of them is older than the
 * snapshot's last event, the caller must rebuild from the full diary instead;
 * this returns null to say so.
 */
export function applyIncremental(
  snapshot: Card,
  snapshotLastAt: string,
  events: readonly CardEvent[],
  scheduler: Scheduler = defaultScheduler,
): Card | null {
  const sorted = sortEvents(events);
  if (sorted.some((e) => e.at < snapshotLastAt)) return null;
  let card: Card | null = snapshot;
  for (const ev of sorted) card = reduce(card, ev, scheduler);
  return card;
}
