import { useEffect, useState, type JSX } from 'react';
import { api } from '@pluckk/shared/api';
import type { FolderRow } from '@pluckk/shared/api';
import type { SessionConfig, SessionMeta } from '../types';

interface Props {
  config: SessionConfig;
  onChange: (config: SessionConfig) => void;
  meta: SessionMeta | null;
}

const modeLabel: Record<SessionConfig['mode'], string> = {
  scheduled: 'Mix',
  focus: 'Focus',
  backlog: 'Backlog',
};

/**
 * Session bar for the review page: mode (Mix / Focus / Backlog), deck picker,
 * session size, and a per-deck editor (weight %, new/day, pause) that writes to
 * the folders API. Changing anything triggers a new session via onChange.
 */
export default function SessionControls({ config, onChange, meta }: Props): JSX.Element {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const loadFolders = async (): Promise<void> => {
    try { setFolders(await api.folders.list()); } catch { /* ignore */ }
  };
  useEffect(() => { loadFolders(); }, []);

  const patchFolder = async (id: string, updates: Parameters<typeof api.folders.update>[1]): Promise<void> => {
    setSaving(id);
    try {
      const row = await api.folders.update(id, updates);
      setFolders((prev) => prev.map((f) => (f.id === id ? row : f)));
      onChange({ ...config }); // refetch session with new weights/pauses
    } catch { /* ignore */ } finally { setSaving(null); }
  };

  const deckStats = (id: string | null) => meta?.per_folder[id ?? 'unfiled'];
  const needsFolder = config.mode === 'focus' || config.mode === 'backlog';

  return (
    <div className="mx-auto mb-4 w-full max-w-2xl text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-dark-border">
          {(Object.keys(modeLabel) as SessionConfig['mode'][]).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...config, mode: m, folderId: needsFolder || m === 'scheduled' ? config.folderId : undefined })}
              className={`px-3 py-1.5 transition-colors ${
                config.mode === m
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                  : 'bg-white text-gray-500 hover:text-gray-800 dark:bg-dark-surface dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {modeLabel[m]}
            </button>
          ))}
        </div>

        {needsFolder && (
          <select
            value={config.folderId ?? 'unfiled'}
            onChange={(e) => onChange({ ...config, folderId: e.target.value === 'unfiled' ? null : e.target.value })}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-dark-border dark:bg-dark-surface dark:text-gray-200"
          >
            <option value="unfiled">Unfiled</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}{f.is_paused ? ' (paused)' : ''}</option>
            ))}
          </select>
        )}

        {config.mode !== 'backlog' && (
          <label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <input
              type="number"
              min={1}
              max={1000}
              value={config.size ?? ''}
              placeholder="100"
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                onChange({ ...config, size: Number.isFinite(n) && n > 0 ? n : undefined });
              }}
              className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center dark:border-dark-border dark:bg-dark-surface dark:text-gray-200"
            />
            cards
          </label>
        )}

        {config.mode === 'backlog' && meta?.backlog_remaining !== undefined && (
          <span className="text-gray-400 dark:text-gray-500">{meta.backlog_remaining} more due after this batch</span>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-gray-500 hover:text-gray-800 dark:border-dark-border dark:text-gray-400 dark:hover:text-gray-200"
        >
          Decks {open ? '▴' : '▾'}
        </button>
      </div>

      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-dark-border dark:bg-dark-surface">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-3 px-4 py-2 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <span>Deck</span><span className="w-14 text-center">Due</span><span className="w-16 text-center">Mix %</span><span className="w-16 text-center">New/day</span><span className="w-16 text-center">Paused</span>
          </div>
          {folders.map((f) => {
            const stats = deckStats(f.id);
            return (
              <div key={f.id} className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-3 border-t border-gray-100 px-4 py-2 dark:border-gray-800 ${f.is_paused ? 'opacity-50' : ''}`}>
                <span className="truncate text-gray-800 dark:text-gray-200">{f.name}</span>
                <span className="w-14 text-center text-gray-500 dark:text-gray-400">{f.is_paused ? '—' : stats?.due ?? '·'}</span>
                <input
                  type="number" min={0} max={100} defaultValue={f.weight ?? ''} placeholder="–" disabled={saving === f.id}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10);
                    const w = Number.isFinite(n) && n > 0 ? n : null;
                    if (w !== f.weight) patchFolder(f.id, { weight: w });
                  }}
                  className="w-16 rounded border border-gray-200 bg-white px-1 py-1 text-center dark:border-dark-border dark:bg-dark-bg dark:text-gray-200"
                />
                <input
                  type="number" min={0} max={500} defaultValue={f.new_per_day ?? ''} placeholder="dflt" disabled={saving === f.id}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10);
                    const v = Number.isFinite(n) && n >= 0 ? n : null;
                    if (v !== f.new_per_day) patchFolder(f.id, { new_per_day: v });
                  }}
                  className="w-16 rounded border border-gray-200 bg-white px-1 py-1 text-center dark:border-dark-border dark:bg-dark-bg dark:text-gray-200"
                />
                <div className="flex w-16 justify-center">
                  <input
                    type="checkbox" checked={f.is_paused} disabled={saving === f.id}
                    onChange={(e) => patchFolder(f.id, { is_paused: e.target.checked })}
                  />
                </div>
              </div>
            );
          })}
          {folders.length === 0 && <div className="border-t border-gray-100 px-4 py-3 text-gray-400 dark:border-gray-800">No decks yet.</div>}
          <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
            Mix % applies in Mix mode (blank = excluded when any deck has a %). New/day caps introductions per deck. Paused decks never appear.
          </div>
        </div>
      )}
    </div>
  );
}
