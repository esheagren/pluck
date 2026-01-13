import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@pluckk/shared/supabase'

const supabase = getSupabaseClient()

export function useFolders(userId) {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchFolders = useCallback(async () => {
    if (!userId) {
      setFolders([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching folders:', error)
        setFolders([])
      } else {
        setFolders(data || [])
      }
    } catch (error) {
      console.error('Error fetching folders:', error)
      setFolders([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  const createFolder = useCallback(async (name) => {
    if (!userId || !name.trim()) {
      return { error: new Error('Invalid folder name') }
    }

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          user_id: userId,
          name: name.trim()
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating folder:', error)
        return { error }
      }

      setFolders(prev => [...prev, data])
      return { data }
    } catch (error) {
      console.error('Error creating folder:', error)
      return { error }
    }
  }, [userId])

  const updateFolder = useCallback(async (folderId, updates) => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', folderId)
        .select()
        .single()

      if (error) {
        console.error('Error updating folder:', error)
        return { error }
      }

      setFolders(prev => prev.map(folder =>
        folder.id === folderId ? { ...folder, ...data } : folder
      ))

      return { data }
    } catch (error) {
      console.error('Error updating folder:', error)
      return { error }
    }
  }, [])

  const deleteFolder = useCallback(async (folderId) => {
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId)

      if (error) {
        console.error('Error deleting folder:', error)
        return { error }
      }

      setFolders(prev => prev.filter(folder => folder.id !== folderId))
      return { success: true }
    } catch (error) {
      console.error('Error deleting folder:', error)
      return { error }
    }
  }, [])

  return {
    folders,
    loading,
    refetch: fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder
  }
}
