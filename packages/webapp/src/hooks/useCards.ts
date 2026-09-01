import { useState, useEffect, useCallback } from 'react';
import { api } from '@pluckk/shared/api';
import { shuffle } from '@pluckk/shared/utils';
import type { Card, Folder, CardUpdates, OperationResult, UseCardsReturn } from '../types';

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
      // API returns cards with `folder` embedded and `due_at` flattened.
      const data = await api.cards.list();
      setCards(data as unknown as Card[]);
    } catch (error) {
      console.error('Error fetching cards:', error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const getShuffledCards = useCallback((): Card[] => shuffle([...cards]), [cards]);

  const updateCard = useCallback(async (cardId: string, updates: CardUpdates): Promise<OperationResult<Card>> => {
    try {
      const data = (await api.cards.update(cardId, updates as Record<string, unknown>)) as unknown as Card;
      setCards((prev) => prev.map((card) => (card.id === cardId ? { ...card, ...data } : card)));
      return { data };
    } catch (error) {
      console.error('Error updating card:', error);
      return { error };
    }
  }, []);

  const deleteCard = useCallback(async (cardId: string): Promise<OperationResult> => {
    try {
      await api.cards.remove(cardId);
      setCards((prev) => prev.filter((card) => card.id !== cardId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting card:', error);
      return { error };
    }
  }, []);

  const moveCardToFolder = useCallback(
    async (cardId: string, folderId: string | null, _folder: Folder | null = null): Promise<OperationResult<Card>> => {
      try {
        const data = (await api.cards.update(cardId, { folder_id: folderId })) as unknown as Card;
        setCards((prev) => prev.map((card) => (card.id === cardId ? { ...card, folder_id: folderId, folder: data.folder } : card)));
        return { data };
      } catch (error) {
        console.error('Error moving card to folder:', error);
        return { error };
      }
    },
    []
  );

  return { cards, loading, refetch: fetchCards, getShuffledCards, updateCard, deleteCard, moveCardToFolder };
}
