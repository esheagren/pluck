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
 * Minimal per-session mode switch on the review page. Deck configuration
 * (Mix %, New/day, Paused) and session size live in Settings → Review decks.
 */
export default function SessionControls({ config, onChange, meta }: Props): JSX.Element {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const needsFolder = config.mode === 'focus' || config.mode === 'backlog';

  useEffect(() => {
    if (needsFolder && folders.length === 0) {
      api.folders.list().then(setFolders).catch(() => {});
    }
  }, [needsFolder, folders.length]);

  return (
    <div className="mx-auto mb-2 flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
      <div className="flex gap-1">
        {(Object.keys(modeLabel) as SessionConfig['mode'][]).map((m) => (
          <button
            key={m}
            onClick={() => onChange({ ...config, mode: m })}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              config.mode === m
                ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                : 'hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {modeLabel[m]}
          </button>
        ))}
      </div>
      {needsFolder && (
        <select
          value={config.folderId === null ? 'unfiled' : config.folderId ?? 'unfiled'}
          onChange={(e) => onChange({ ...config, folderId: e.target.value === 'unfiled' ? null : e.target.value })}
          className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 dark:border-dark-border dark:bg-dark-surface dark:text-gray-300"
        >
          <option value="unfiled">Unfiled</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}{f.is_paused ? ' (paused)' : ''}</option>
          ))}
        </select>
      )}
      {config.mode === 'backlog' && meta?.backlog_remaining !== undefined && meta.backlog_remaining > 0 && (
        <span>{meta.backlog_remaining} more due after this batch</span>
      )}
    </div>
  );
}
