// Where a card came from, for display and for "visit origin" links.
import type { Provenance } from '@pluckk/core/entities';

/** The few fields the helpers need; both the API row and the webapp's Card satisfy it. */
interface SourceCard {
  id: string;
  source_url?: string | null;
  source_selector?: string | null;
  source_title?: string | null;
  provenance?: Provenance | null;
}

/** The URL to open the card's origin, highlighting the captured passage where the browser supports text fragments. */
export function sourceHref(card: SourceCard): string | null {
  const url = card.provenance?.url ?? card.source_url;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  let href = card.source_selector ? `${url}${url.includes('?') ? '&' : '?'}pluckk_card=${card.id}` : url;
  const exact = card.provenance?.selector?.exact;
  if (exact) {
    const snippet = exact.trim().slice(0, 150);
    href += `#:~:text=${encodeURIComponent(snippet)}`;
  }
  return href;
}

/** "site · page" or the app + window for native captures. */
export function sourceLabel(card: SourceCard): string | null {
  const p = card.provenance;
  if (p) {
    const parts = [p.containerTitle, p.title].filter((s): s is string => !!s && s.trim().length > 0);
    if (parts.length) return parts.join(' · ');
    if (p.identifier.startsWith('app:')) return p.identifier.slice(4).replace('/', ' · ');
    return p.url ?? p.identifier;
  }
  return card.source_title ?? card.source_url ?? null;
}

/** The provenance identifier that groups cards from the same source, if any. */
export function sourceKey(card: SourceCard): string | null {
  return card.provenance?.identifier ?? null;
}
