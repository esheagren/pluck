import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@pluckk/shared/supabase';
import { shuffle } from '@pluckk/shared/utils';
import type { Card, Folder, CardUpdates, OperationResult, UseCardsReturn } from '../types';

const supabase = getSupabaseClient();

export function useCards(userId: string | undefined): UseCardsReturn {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCards = useCallback(async (): Promise<void> => {
    if (!userId) {
      setCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*, folder:folders(*), review_state:card_review_state(due_at)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching cards:', error);
        setCards([]);
      } else {
        // Flatten review_state.due_at to card.due_at for easier access
        // Note: Supabase returns review_state as an array (one-to-many relationship)
        // so we need to access the first element
        const cardsWithDue = (data || []).map((card: any) => ({
          ...card,
          due_at: Array.isArray(card.review_state)
            ? card.review_state[0]?.due_at ?? null
            : card.review_state?.due_at ?? null,
          review_state: undefined, // Remove nested object
        }));
        setCards(cardsWithDue as Card[]);
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const getShuffledCards = useCallback((): Card[] => {
    return shuffle([...cards]);
  }, [cards]);

  const updateCard = useCallback(
    async (cardId: string, updates: CardUpdates): Promise<OperationResult<Card>> => {
      try {
        const { data, error } = await supabase
          .from('cards')
          .update(updates)
          .eq('id', cardId)
          .select()
          .single();

        if (error) {
          console.error('Error updating card:', error);
          return { error };
        }

        // Update local state
        setCards((prev) =>
          prev.map((card) => (card.id === cardId ? { ...card, ...data } : card))
        );

        return { data: data as Card };
      } catch (error) {
        console.error('Error updating card:', error);
        return { error };
      }
    },
    []
  );

  const deleteCard = useCallback(async (cardId: string): Promise<OperationResult> => {
    try {
      const { error } = await supabase.from('cards').delete().eq('id', cardId);

      if (error) {
        console.error('Error deleting card:', error);
        return { error };
      }

      // Update local state
      setCards((prev) => prev.filter((card) => card.id !== cardId));

      return { success: true };
    } catch (error) {
      console.error('Error deleting card:', error);
      return { error };
    }
  }, []);

  const moveCardToFolder = useCallback(
    async (
      cardId: string,
      folderId: string | null,
      _folder: Folder | null = null
    ): Promise<OperationResult<Card>> => {
      try {
        // Use type assertion since Supabase types don't include folder_id
        const { data, error } = await (supabase
          .from('cards') as any)
          .update({ folder_id: folderId })
          .eq('id', cardId)
          .select('*, folder:folders(*)')
          .single();

        if (error) {
          console.error('Error moving card to folder:', error);
          return { error };
        }

        // Update local state
        setCards((prev) =>
          prev.map((card) =>
            card.id === cardId
              ? { ...card, folder_id: folderId, folder: (data as Card).folder }
              : card
          )
        );

        return { data: data as Card };
      } catch (error) {
        console.error('Error moving card to folder:', error);
        return { error };
      }
    },
    []
  );

  return {
    cards,
    loading,
    refetch: fetchCards,
    getShuffledCards,
    updateCard,
    deleteCard,
    moveCardToFolder,
  };
}
