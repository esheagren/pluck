import { useEffect, useState, type JSX } from 'react';
import { api } from '@pluckk/shared/api';
import type { FolderRow } from '@pluckk/shared/api';

/**
 * Deck configuration table (Settings page): Mix %, New/day, Paused per folder.
 * Writes straight to the folders API; the review mixer reads these on every session.
 */
export default function DeckSettings(): JSX.Element {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.folders.list().then(setFolders).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const patchFolder = async (id: string, updates: Parameters<typeof api.folders.update>[1]): Promise<void> => {
    setSaving(id);
    try {
      const row = await api.folders.update(id, updates);
      setFolders((prev) => prev.map((f) => (f.id === id ? row : f)));
    } catch { /* ignore */ } finally { setSaving(null); }
  };

  if (loading) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Loading decks…</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 py-1.5 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
        <span>Deck</span><span className="w-16 text-center">Mix %</span><span className="w-16 text-center">New/day</span><span className="w-16 text-center">Paused</span>
      </div>
      {folders.map((f) => (
        <div key={f.id} className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-t border-gray-100 py-2 dark:border-gray-800 ${f.is_paused ? 'opacity-50' : ''}`}>
          <span className="truncate text-sm text-gray-800 dark:text-gray-200">{f.name}</span>
          <input
            type="number" min={0} max={100} defaultValue={f.weight ?? ''} placeholder="–" disabled={saving === f.id}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              const w = Number.isFinite(n) && n > 0 ? n : null;
              if (w !== f.weight) patchFolder(f.id, { weight: w });
            }}
            className="w-16 rounded border border-gray-200 bg-white px-1 py-1 text-center text-sm dark:border-dark-border dark:bg-dark-bg dark:text-gray-200"
          />
          <input
            type="number" min={0} max={500} defaultValue={f.new_per_day ?? ''} placeholder="dflt" disabled={saving === f.id}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              const v = Number.isFinite(n) && n >= 0 ? n : null;
              if (v !== f.new_per_day) patchFolder(f.id, { new_per_day: v });
            }}
            className="w-16 rounded border border-gray-200 bg-white px-1 py-1 text-center text-sm dark:border-dark-border dark:bg-dark-bg dark:text-gray-200"
          />
          <div className="flex w-16 justify-center">
            <input type="checkbox" checked={f.is_paused} disabled={saving === f.id} onChange={(e) => patchFolder(f.id, { is_paused: e.target.checked })} />
          </div>
        </div>
      ))}
      {folders.length === 0 && <p className="border-t border-gray-100 py-3 text-sm text-gray-400 dark:border-gray-800">No decks yet.</p>}
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Mix % sets each deck's share of a Mix session (blank = excluded once any deck has a %).
        New/day caps how many unseen cards a deck introduces daily. Paused decks never appear in review.
      </p>
    </div>
  );
}
