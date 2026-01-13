import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@pluckk/shared/supabase'
import { shuffle } from '@pluckk/shared/utils'

const supabase = getSupabaseClient()

export function useCards(userId) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCards = useCallback(async () => {
    if (!userId) {
      setCards([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*, folder:folders(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching cards:', error)
        setCards([])
      } else {
        setCards(data || [])
      }
    } catch (error) {
      console.error('Error fetching cards:', error)
      setCards([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  const getShuffledCards = useCallback(() => {
    return shuffle([...cards])
  }, [cards])

  const updateCard = useCallback(async (cardId, updates) => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', cardId)
        .select()
        .single()

      if (error) {
        console.error('Error updating card:', error)
        return { error }
      }

      // Update local state
      setCards(prev => prev.map(card =>
        card.id === cardId ? { ...card, ...data } : card
      ))

      return { data }
    } catch (error) {
      console.error('Error updating card:', error)
      return { error }
    }
  }, [])

  const deleteCard = useCallback(async (cardId) => {
    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId)

      if (error) {
        console.error('Error deleting card:', error)
        return { error }
      }

      // Update local state
      setCards(prev => prev.filter(card => card.id !== cardId))

      return { success: true }
    } catch (error) {
      console.error('Error deleting card:', error)
      return { error }
    }
  }, [])

  const moveCardToFolder = useCallback(async (cardId, folderId, folder = null) => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .update({ folder_id: folderId })
        .eq('id', cardId)
        .select('*, folder:folders(*)')
        .single()

      if (error) {
        console.error('Error moving card to folder:', error)
        return { error }
      }

      // Update local state
      setCards(prev => prev.map(card =>
        card.id === cardId ? { ...card, folder_id: folderId, folder: data.folder } : card
      ))

      return { data }
    } catch (error) {
      console.error('Error moving card to folder:', error)
      return { error }
    }
  }, [])

  return {
    cards,
    loading,
    refetch: fetchCards,
    getShuffledCards,
    updateCard,
    deleteCard,
    moveCardToFolder
  }
}
