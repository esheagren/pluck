import { useState, useEffect, useRef, useMemo, useCallback, type JSX } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { getEventCoordinates } from '@dnd-kit/utilities';
import CardGrid from '../components/CardGrid';
import CreateFolderButton from '../components/CreateFolderButton';
import FolderList from '../components/FolderList';
import FolderBadge from '../components/FolderBadge';
import type { CardsPageProps, Card } from '../types';

const FOLDER_ORDER_KEY = 'pluckk-folder-order';

interface CardMove {
  cardId: string;
  fromFolderId: string | null;
}

interface LastMoveAction {
  cardMoves: CardMove[];
}

// Positions the drag overlay so its top-left corner follows near the cursor,
// rather than centering the full-width preview under it (snapCenterToCursor).
const snapTopLeftToCursor: Modifier = ({ transform, activatorEvent, draggingNodeRect }) => {
  if (!activatorEvent || !draggingNodeRect) {
    return transform;
  }

  const activatorCoordinates = getEventCoordinates(activatorEvent);
  if (!activatorCoordinates) {
    return transform;
  }

  // How far into the element the cursor was when dragging started
  const offsetX = activatorCoordinates.x - draggingNodeRect.left;
  const offsetY = activatorCoordinates.y - draggingNodeRect.top;

  return {
    ...transform,
    x: transform.x + offsetX + 8,
    y: transform.y + offsetY + 8,
  };
};

export default function CardsPage({
  cards,
  loading,
  onUpdateCard,
  onDeleteCard,
  onMoveCardToFolder,
  folders,
  foldersLoading,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
}: CardsPageProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [folderOrder, setFolderOrder] = useState<string[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const lastMoveActionRef = useRef<LastMoveAction | null>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  // Load folder order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem(FOLDER_ORDER_KEY);
    if (savedOrder) {
      try {
        setFolderOrder(JSON.parse(savedOrder));
      } catch (e) {
        // Invalid JSON, use default
        setFolderOrder([]);
      }
    }
  }, []);

  // Escape key clears card selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && selectedCardIds.size > 0) {
        setSelectedCardIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCardIds.size]);

  // Cmd+Z / Ctrl+Z to undo last card move
  useEffect(() => {
    const handleUndo = async (e: KeyboardEvent): Promise<void> => {
      // Don't intercept undo if user is typing in an input/textarea
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const lastMoveAction = lastMoveActionRef.current;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && lastMoveAction && onMoveCardToFolder) {
        e.preventDefault();

        try {
          // Move each card back to its original folder
          const undoPromises = lastMoveAction.cardMoves.map(({ cardId, fromFolderId }) =>
            onMoveCardToFolder(cardId, fromFolderId)
          );
          const results = await Promise.allSettled(undoPromises);

          // Check if any failed
          const failures = results.filter((r) => r.status === 'rejected');
          if (failures.length > 0) {
            console.error('Some undo operations failed:', failures);
            return;
          }

          // Clear only on complete success
          lastMoveActionRef.current = null;
        } catch (error) {
          console.error('Undo failed:', error);
        }
      }
    };
    window.addEventListener('keydown', handleUndo);
    return () => window.removeEventListener('keydown', handleUndo);
  }, [onMoveCardToFolder]);

  // Compute ordered items: merge saved order with current folders
  const orderedItems = useMemo(() => {
    const allIds = ['unfiled', ...folders.map((f) => f.id)];

    if (folderOrder.length === 0) {
      return allIds;
    }

    // Start with saved order, filter out any that no longer exist
    const validSavedOrder = folderOrder.filter((id) => allIds.includes(id));

    // Add any new folders that aren't in the saved order
    const newFolders = allIds.filter((id) => !validSavedOrder.includes(id));

    return [...validSavedOrder, ...newFolders];
  }, [folders, folderOrder]);

  // Get default folder (first in order)
  const defaultFolderId = orderedItems[0] || 'unfiled';

  // Get selected folder from URL (default to first in order if no param)
  const selectedFolderId = searchParams.get('folder') ?? defaultFolderId;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Filter cards based on selected folder
  const filteredCards = useMemo(() => {
    if (selectedFolderId === 'all') return cards;
    if (selectedFolderId === 'unfiled') {
      return cards.filter((c) => !c.folder_id);
    }
    return cards.filter((c) => c.folder_id === selectedFolderId);
  }, [cards, selectedFolderId]);

  // Get the active card being dragged
  const activeCard = useMemo(() => {
    if (!activeId) return null;
    return cards.find((c) => c.id === activeId) || null;
  }, [activeId, cards]);

  // Note: currentFolderName is computed but reserved for future use in header display
  // const currentFolderName = useMemo(() => {
  //   if (selectedFolderId === 'all') return null;
  //   if (selectedFolderId === 'unfiled') return 'Unfiled';
  //   const folder = folders.find((f) => f.id === selectedFolderId);
  //   return folder?.name || null;
  // }, [selectedFolderId, folders]);

  // Update edit fields when a card is selected
  useEffect(() => {
    if (selectedCard) {
      setEditQuestion(selectedCard.question);
      setEditAnswer(selectedCard.answer);
      setIsConfirmingDelete(false);
    }
  }, [selectedCard]);

  const handleDelete = async (): Promise<void> => {
    if (!selectedCard || !onDeleteCard) return;
    setDeleting(true);
    await onDeleteCard(selectedCard.id);
    setDeleting(false);
    setSelectedCard(null);
    setIsConfirmingDelete(false);
    lastMoveActionRef.current = null; // Clear undo history
  };

  // Auto-resize textareas when content is set
  useEffect(() => {
    if (questionRef.current) {
      questionRef.current.style.height = 'auto';
      questionRef.current.style.height = questionRef.current.scrollHeight + 'px';
    }
    if (answerRef.current) {
      answerRef.current.style.height = 'auto';
      answerRef.current.style.height = answerRef.current.scrollHeight + 'px';
    }
  }, [editQuestion, editAnswer]);

  const handleSave = async (): Promise<void> => {
    if (!selectedCard || !onUpdateCard) return;

    setSaving(true);
    const result = await onUpdateCard(selectedCard.id, {
      question: editQuestion,
      answer: editAnswer,
    });
    setSaving(false);

    if (!result.error) {
      setSelectedCard(null);
      lastMoveActionRef.current = null; // Clear undo history
    }
  };

  const hasChanges =
    selectedCard &&
    (editQuestion !== selectedCard.question || editAnswer !== selectedCard.answer);

  const handleSelectFolder = (folderId: string): void => {
    setSearchParams({ folder: folderId });
  };

  // Handle folder tab reorder
  const handleFolderReorder = useCallback((newOrder: string[]): void => {
    setFolderOrder(newOrder);
    localStorage.setItem(FOLDER_ORDER_KEY, JSON.stringify(newOrder));
  }, []);

  // Toggle card selection for multi-select (Shift+click)
  const toggleCardSelection = useCallback((cardId: string): void => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, []);

  // Get count of selected cards for drag overlay
  const selectedCount = useMemo(() => {
    if (!activeId) return 0;
    // If the dragged card is selected, use selection count; otherwise just 1
    return selectedCardIds.has(activeId) ? selectedCardIds.size : 1;
  }, [activeId, selectedCardIds]);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent): void => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Check if this is a folder tab reorder (active.id is in orderedItems)
    const isFolderReorder = orderedItems.includes(activeIdStr);

    if (isFolderReorder) {
      // Handle folder tab reorder
      if (activeIdStr === overIdStr) return;

      const oldIndex = orderedItems.indexOf(activeIdStr);
      const newIndex = orderedItems.indexOf(overIdStr);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(orderedItems, oldIndex, newIndex);
        handleFolderReorder(newOrder);
      }
      return;
    }

    // Handle card move to folder
    if (!onMoveCardToFolder) return;

    // Check if dropping on a valid folder target
    const isValidFolderTarget = orderedItems.includes(overIdStr) && overIdStr !== 'unfiled';
    if (!isValidFolderTarget) return;

    const targetFolderId = overIdStr;

    // Determine which cards to move: selected cards if dragged card is selected, otherwise just the dragged card
    const cardsToMove = selectedCardIds.has(activeIdStr)
      ? [...selectedCardIds]
      : [activeIdStr];

    // Filter out cards already in target folder and record their original folders for undo
    const cardMoves: CardMove[] = cardsToMove
      .map((cardId) => {
        const card = cards.find((c) => c.id === cardId);
        if (!card || card.folder_id === targetFolderId) return null;
        return { cardId, fromFolderId: card.folder_id || null };
      })
      .filter((move): move is CardMove => move !== null);

    if (cardMoves.length === 0) return;

    // Record move action for undo
    lastMoveActionRef.current = { cardMoves };

    // Move all cards
    const movePromises = cardMoves.map(({ cardId }) =>
      onMoveCardToFolder(cardId, targetFolderId)
    );
    await Promise.all(movePromises);

    // Clear selection after move
    setSelectedCardIds(new Set());
  };

  if (loading || foldersLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <div className="spinner w-8 h-8 border-3 border-gray-200 dark:border-gray-700 border-t-gray-800 dark:border-t-gray-200 rounded-full"></div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading cards...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-gray-400 dark:text-gray-500"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="15"></line>
            <line x1="15" y1="9" x2="9" y2="15"></line>
          </svg>
        </div>
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">No cards yet</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Use the Pluckk extension to create some flashcards.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full flex flex-col items-center">
        {/* Folder list / filter bar */}
        <div className="w-full max-w-5xl mb-4">
          <div className="pb-4 border-b border-gray-200 dark:border-dark-border">
            <div className="flex items-center gap-2">
              <CreateFolderButton onCreateFolder={onCreateFolder} />
              <FolderList
                folders={folders}
                cards={cards}
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
                onDeleteFolder={onDeleteFolder}
                onRenameFolder={onUpdateFolder}
                orderedItems={orderedItems}
                onReorder={handleFolderReorder}
                isDraggingCard={isDragging}
              />
            </div>
          </div>
        </div>

        <CardGrid
          cards={filteredCards}
          onCardClick={setSelectedCard}
          showFolderBadge={selectedFolderId === 'all' || selectedFolderId === 'unfiled'}
          selectedCardIds={selectedCardIds}
          onToggleSelect={toggleCardSelection}
          activeId={activeId}
        />

        {/* Drag overlay for visual feedback */}
        <DragOverlay modifiers={[snapTopLeftToCursor]}>
          {activeCard ? (
            <div className="bg-white dark:bg-dark-surface border-2 border-blue-500 rounded-xl p-4 shadow-xl w-[280px]">
              {selectedCount > 1 ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {selectedCount}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Moving {selectedCount} cards
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 mb-2">
                    {activeCard.question}
                  </div>
                  {activeCard.folder && <FolderBadge folder={activeCard.folder} />}
                </>
              )}
            </div>
          ) : null}
        </DragOverlay>

        {/* Card Edit Modal */}
        {selectedCard && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedCard(null)}
          >
            <div
              className="bg-white dark:bg-dark-surface rounded-2xl max-w-lg w-full p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Folder badge */}
              {selectedCard.folder && (
                <div className="mb-4">
                  <FolderBadge folder={selectedCard.folder} />
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 block">
                  Question
                </label>
                <textarea
                  ref={questionRef}
                  value={editQuestion}
                  onChange={(e) => {
                    setEditQuestion(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onFocus={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  className="w-full p-3 border border-gray-200 dark:border-dark-border rounded-lg text-gray-800 dark:text-gray-200 bg-white dark:bg-dark-bg resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 overflow-hidden min-h-[60px]"
                />
              </div>
              <div className="border-t border-gray-100 dark:border-dark-border pt-4">
                <label className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 block">
                  Answer
                </label>
                <textarea
                  ref={answerRef}
                  value={editAnswer}
                  onChange={(e) => {
                    setEditAnswer(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onFocus={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  className="w-full p-3 border border-gray-200 dark:border-dark-border rounded-lg text-gray-800 dark:text-gray-200 bg-white dark:bg-dark-bg resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 overflow-hidden min-h-[60px]"
                />
              </div>
              {selectedCard.source_url && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border">
                  <a
                    href={selectedCard.source_selector
                      ? `${selectedCard.source_url}${selectedCard.source_url.includes('?') ? '&' : '?'}pluckk_card=${selectedCard.id}`
                      : selectedCard.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 hover:underline"
                  >
                    View source
                  </a>
                </div>
              )}
              <div className="mt-6 flex gap-3">
                {!isConfirmingDelete ? (
                  <>
                    <button
                      onClick={() => setIsConfirmingDelete(true)}
                      className="p-3 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete card"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => setSelectedCard(null)}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!hasChanges || saving}
                      className="flex-1 py-3 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsConfirmingDelete(false)}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-3 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
