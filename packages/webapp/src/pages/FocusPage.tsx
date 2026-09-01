import { useEffect, useState, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@pluckk/shared/api';
import type { DeckSummary } from '@pluckk/shared/api';

/**
 * Focused Review: pick one deck and work on it. Each row shows what's waiting;
 * "Start" runs a focused session (due first, then new up to the deck's daily cap),
 * "All N due" burns down the whole due pile (backlog mode).
 * Starting a paused deck here works — pause only keeps a deck out of Mix Review.
 */
export default function FocusPage(): JSX.Element {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.review.decks()
      .then((r) => setDecks(r.decks))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load decks'));
  }, []);

  const start = (deck: DeckSummary, mode: 'focus' | 'backlog'): void => {
    const folder = deck.folder_id ?? 'unfiled';
    navigate(`/?mode=${mode}&folder=${encodeURIComponent(folder)}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">Focused Review</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Work on one deck at a time. Paused decks stay out of Mix Review but can be studied here.
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!decks && !error && (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-400 dark:text-gray-500">
          <span className="spinner h-4 w-4 rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-300" />
          Loading decks…
        </div>
      )}

      {decks && (
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border divide-y divide-gray-100 dark:divide-dark-border">
          {decks.map((d) => {
            const key = d.folder_id ?? 'unfiled';
            return (
              <div key={key} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-gray-800 dark:text-gray-100">{d.name ?? 'Unfiled'}</span>
                    {d.is_paused && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">paused in Mix</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {d.due > 0 && <span className="text-gray-600 dark:text-gray-300">{d.due} due</span>}
                    {d.due > 0 && ' · '}
                    {d.new} unseen · {d.total} total
                  </div>
                </div>
                {d.due > 0 && (
                  <button
                    onClick={() => start(d, 'backlog')}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-dark-border dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    All {d.due} due
                  </button>
                )}
                <button
                  onClick={() => start(d, 'focus')}
                  disabled={d.total === 0}
                  className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-40 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
                >
                  Start
                </button>
              </div>
            );
          })}
          {decks.length === 0 && (
            <p className="px-5 py-6 text-sm text-gray-400 dark:text-gray-500">No cards yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
