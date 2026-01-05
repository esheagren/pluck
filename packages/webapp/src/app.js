// Pluckk Review - App Logic
// Simple spaced repetition review interface with authentication

import {
  getSupabaseClient,
  signInWithGoogle,
  signOut,
  getSession,
  getAccessToken,
  onAuthStateChange
} from '@pluckk/shared/supabase';
import { shuffle } from '@pluckk/shared/utils';
import { BACKEND_URL, FREE_TIER_LIMIT } from '@pluckk/shared/constants';

// Get Supabase client for data queries
const supabase = getSupabaseClient();

// DOM Elements
const loginState = document.getElementById('login-state');
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
const googleSignInBtn = document.getElementById('google-sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const userProfile = document.getElementById('user-profile');
const userEmail = document.getElementById('user-email');
const billingInfo = document.getElementById('billing-info');
const proInfo = document.getElementById('pro-info');
const usageDisplay = document.getElementById('usage-display');
const upgradeBtn = document.getElementById('upgrade-btn');
const manageBtn = document.getElementById('manage-btn');

// State
let cards = [];
let currentIndex = 0;
let isFlipped = false;
let reviewedCount = 0;
let currentUser = null;

/**
 * Show a specific state, hide all others
 */
function showState(state) {
  const states = [loginState, loadingState, emptyState, completeState, reviewContainer];
  states.forEach(s => s.classList.add('hidden'));
  state.classList.remove('hidden');
}

/**
 * Update user profile display
 */
async function updateUserDisplay(user) {
  if (user) {
    userEmail.textContent = user.email;
    userProfile.classList.remove('hidden');

    // Fetch user profile for billing info
    try {
      const accessToken = await getAccessToken();
      if (accessToken) {
        const response = await fetch(`${BACKEND_URL}/api/user/me`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (response.ok) {
          const profile = await response.json();
          const isPro = profile.subscription_status === 'active';
          const used = profile.cards_generated_this_month || 0;

          if (isPro) {
            billingInfo.classList.add('hidden');
            proInfo.classList.remove('hidden');
          } else {
            usageDisplay.textContent = `${used} / ${FREE_TIER_LIMIT} cards`;
            billingInfo.classList.remove('hidden');
            proInfo.classList.add('hidden');
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  } else {
    userProfile.classList.add('hidden');
  }
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
 * Fetch cards for the current user
 */
async function fetchUserCards() {
  try {
    // With RLS enabled, this will automatically filter to user's cards + public cards
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cards:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching cards:', error);
    return [];
  }
}

/**
 * Load and start the review session
 */
async function loadReview() {
  showState(loadingState);

  const fetchedCards = await fetchUserCards();

  if (fetchedCards.length === 0) {
    showState(emptyState);
    return;
  }

  // Shuffle and start
  cards = shuffle(fetchedCards);
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
 * Handle sign in button click
 */
async function handleSignIn() {
  const { error } = await signInWithGoogle();
  if (error) {
    console.error('Sign in error:', error);
  }
  // The page will redirect to Google, then back
}

/**
 * Handle sign out button click
 */
async function handleSignOut() {
  const { error } = await signOut();
  if (error) {
    console.error('Sign out error:', error);
  }
  currentUser = null;
  updateUserDisplay(null);
  showState(loginState);
}

/**
 * Handle upgrade button click
 */
async function handleUpgrade() {
  upgradeBtn.disabled = true;
  upgradeBtn.textContent = '...';

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch(`${BACKEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        successUrl: window.location.href,
        cancelUrl: window.location.href
      })
    });

    if (response.ok) {
      const { url } = await response.json();
      window.location.href = url;
    }
  } catch (error) {
    console.error('Checkout error:', error);
  } finally {
    upgradeBtn.disabled = false;
    upgradeBtn.textContent = 'Upgrade';
  }
}

/**
 * Handle manage subscription button click
 */
async function handleManageSubscription() {
  manageBtn.disabled = true;
  manageBtn.textContent = '...';

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch(`${BACKEND_URL}/api/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        returnUrl: window.location.href
      })
    });

    if (response.ok) {
      const { url } = await response.json();
      window.location.href = url;
    }
  } catch (error) {
    console.error('Portal error:', error);
  } finally {
    manageBtn.disabled = false;
    manageBtn.textContent = 'Manage';
  }
}

/**
 * Initialize the app
 */
async function init() {
  // Check for existing session
  const { session } = await getSession();

  if (session?.user) {
    currentUser = session.user;
    updateUserDisplay(currentUser);
    loadReview();
  } else {
    showState(loginState);
  }

  // Listen for auth changes (handles OAuth redirect)
  onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);

    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      updateUserDisplay(currentUser);
      loadReview();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      updateUserDisplay(null);
      showState(loginState);
    }
  });
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
googleSignInBtn.addEventListener('click', handleSignIn);
signOutBtn.addEventListener('click', handleSignOut);
upgradeBtn.addEventListener('click', handleUpgrade);
manageBtn.addEventListener('click', handleManageSubscription);
document.addEventListener('keydown', handleKeydown);

// Start the app
init();
