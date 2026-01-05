// Pluckk Review - App Logic
// Simple spaced repetition review interface

import { createSupabaseClient } from '@pluckk/shared/supabase';
import { shuffle } from '@pluckk/shared/utils';

// Initialize Supabase client
const supabase = createSupabaseClient();

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const completeState = document.getElementById('complete-state');
const reviewContainer = document.getElementById('review-container');
const card = document.getElementById('card');
const cardQuestion = document.getElementById('card-question');
const cardAnswer = document.getElementById('card-answer');
const hint = document.getElementById('hint');
const actions = document.getElementById('actions');
const forgotBtn = document.getElementById('forgot-btn');
const gotItBtn = document.getElementById('got-it-btn');
const restartBtn = document.getElementById('restart-btn');
const progressText = document.getElementById('progress-text');

// State
let cards = [];
let currentIndex = 0;
let isFlipped = false;
let reviewedCount = 0;

/**
 * Show a specific state, hide all others
 */
function showState(state) {
  const states = [loadingState, emptyState, completeState, reviewContainer];
  states.forEach(s => s.classList.add('hidden'));
  state.classList.remove('hidden');
}

/**
 * Update progress display
 */
function updateProgress() {
  progressText.textContent = `${reviewedCount} / ${cards.length}`;
}

/**
 * Display the current card
 */
function displayCard() {
  if (currentIndex >= cards.length) {
    showState(completeState);
    return;
  }

  const currentCard = cards[currentIndex];
  cardQuestion.textContent = currentCard.question;
  cardAnswer.textContent = currentCard.answer;

  // Reset card state
  isFlipped = false;
  card.classList.remove('flipped');
  hint.classList.remove('hidden');
  actions.classList.add('hidden');

  updateProgress();
}

/**
 * Flip the card to reveal answer
 */
function flipCard() {
  if (isFlipped) return;

  isFlipped = true;
  card.classList.add('flipped');
  hint.classList.add('hidden');
  actions.classList.remove('hidden');
}

/**
 * Handle answer (got it or forgot)
 */
function handleAnswer(remembered) {
  if (!isFlipped) return;

  // For now, just log the result (future: update SR data)
  console.log(`Card ${cards[currentIndex].id}: ${remembered ? 'remembered' : 'forgot'}`);

  reviewedCount++;
  currentIndex++;
  displayCard();
}

/**
 * Restart review session
 */
function restartReview() {
  currentIndex = 0;
  reviewedCount = 0;
  cards = shuffle(cards);
  showState(reviewContainer);
  displayCard();
}

/**
 * Handle keyboard input
 */
function handleKeydown(e) {
  // Ignore if typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    if (!isFlipped) {
      flipCard();
    } else {
      handleAnswer(true); // Got it
    }
  }

  if (e.code === 'KeyF' && isFlipped) {
    e.preventDefault();
    handleAnswer(false); // Forgot
  }
}

/**
 * Initialize the app
 */
async function init() {
  showState(loadingState);

  // Fetch cards using shared Supabase client
  const fetchedCards = await supabase.fetchCards();

  if (fetchedCards.length === 0) {
    showState(emptyState);
    return;
  }

  // Shuffle and start
  cards = shuffle(fetchedCards);
  showState(reviewContainer);
  displayCard();
}

// Event Listeners
card.addEventListener('click', () => {
  if (!isFlipped) {
    flipCard();
  }
});

forgotBtn.addEventListener('click', () => handleAnswer(false));
gotItBtn.addEventListener('click', () => handleAnswer(true));
restartBtn.addEventListener('click', restartReview);
document.addEventListener('keydown', handleKeydown);

// Start the app
init();
