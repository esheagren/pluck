import { useState, useEffect, useCallback } from 'react';
import { api } from '@pluckk/shared/api';
import type { Folder, FolderUpdates, OperationResult, UseFoldersReturn } from '../types';

export function useFolders(userId: string | undefined): UseFoldersReturn {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFolders = useCallback(async (): Promise<void> => {
    if (!userId) {
      setFolders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setFolders((await api.folders.list()) as unknown as Folder[]);
    } catch (error) {
      console.error('Error fetching folders:', error);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const createFolder = useCallback(async (name: string): Promise<OperationResult<Folder>> => {
    if (!userId || !name.trim()) return { error: new Error('Invalid folder name') };
    try {
      const data = (await api.folders.create(name.trim())) as unknown as Folder;
      setFolders((prev) => [...prev, data]);
      return { data };
    } catch (error) {
      console.error('Error creating folder:', error);
      return { error };
    }
  }, [userId]);

  const updateFolder = useCallback(async (folderId: string, updates: FolderUpdates): Promise<OperationResult<Folder>> => {
    try {
      const data = (await api.folders.update(folderId, updates as Record<string, never>)) as unknown as Folder;
      setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, ...data } : f)));
      return { data };
    } catch (error) {
      console.error('Error updating folder:', error);
      return { error };
    }
  }, []);

  const deleteFolder = useCallback(async (folderId: string): Promise<OperationResult> => {
    try {
      await api.folders.remove(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting folder:', error);
      return { error };
    }
  }, []);

  return { folders, loading, refetch: fetchFolders, createFolder, updateFolder, deleteFolder };
}
