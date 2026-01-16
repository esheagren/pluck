import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@pluckk/shared/supabase';
import type { Folder, FolderUpdates, OperationResult, UseFoldersReturn } from '../types';

const supabase = getSupabaseClient();

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
      // Use type assertion since Supabase types don't include folders table
      const { data, error } = await (supabase
        .from('folders') as any)
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching folders:', error);
        setFolders([]);
      } else {
        setFolders((data as Folder[]) || []);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const createFolder = useCallback(
    async (name: string): Promise<OperationResult<Folder>> => {
      if (!userId || !name.trim()) {
        return { error: new Error('Invalid folder name') };
      }

      try {
        // Use type assertion since Supabase types don't include folders table
        const { data, error } = await (supabase
          .from('folders') as any)
          .insert({
            user_id: userId,
            name: name.trim(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating folder:', error);
          return { error };
        }

        setFolders((prev) => [...prev, data as Folder]);
        return { data: data as Folder };
      } catch (error) {
        console.error('Error creating folder:', error);
        return { error };
      }
    },
    [userId]
  );

  const updateFolder = useCallback(
    async (folderId: string, updates: FolderUpdates): Promise<OperationResult<Folder>> => {
      try {
        // Use type assertion since Supabase types don't include folders table
        const { data, error } = await (supabase
          .from('folders') as any)
          .update(updates)
          .eq('id', folderId)
          .select()
          .single();

        if (error) {
          console.error('Error updating folder:', error);
          return { error };
        }

        setFolders((prev) =>
          prev.map((folder) => (folder.id === folderId ? { ...folder, ...(data as Folder) } : folder))
        );

        return { data: data as Folder };
      } catch (error) {
        console.error('Error updating folder:', error);
        return { error };
      }
    },
    []
  );

  const deleteFolder = useCallback(async (folderId: string): Promise<OperationResult> => {
    try {
      // Use type assertion since Supabase types don't include folders table
      const { error } = await (supabase.from('folders') as any).delete().eq('id', folderId);

      if (error) {
        console.error('Error deleting folder:', error);
        return { error };
      }

      setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting folder:', error);
      return { error };
    }
  }, []);

  return {
    folders,
    loading,
    refetch: fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
  };
}
