import { useState, useEffect, type JSX } from 'react';
import { BACKEND_URL, MOCHI_API_URL } from '@pluckk/shared/constants';
import { getAccessToken } from '@pluckk/shared/supabase';
import { useTheme } from '../hooks/useTheme';
import type {
  SettingsPageProps,
  MochiDeck,
  StatusMessage,
  PrimaryCategory,
  StudentLevel,
  WorkField,
  YearsExperience,
  SpacedRepExperience,
  TechnicalityLevel,
  BreadthLevel,
  MochiImportResult,
} from '../types';
import {
  STUDENT_LEVELS,
  WORK_FIELDS,
  YEARS_EXPERIENCE,
  ADDITIONAL_INTERESTS,
  SPACED_REP_EXPERIENCE,
  TECHNICALITY_EXAMPLES,
  BREADTH_LEVELS,
} from '../types';

const DEFAULT_NEW_CARDS_PER_DAY = 10;
const NEW_CARDS_KEY = 'pluckk_new_cards_per_day';

export default function SettingsPage({
  user,
  billingInfo,
  onSignOut,
  onUpgrade,
  onManage,
}: SettingsPageProps): JSX.Element {
  const { toggleTheme, isDark } = useTheme();
  const [mochiApiKey, setMochiApiKey] = useState('');
  const [mochiDeckId, setMochiDeckId] = useState('');
  const [decks, setDecks] = useState<MochiDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingDecks, setFetchingDecks] = useState(false);
  const [status, setStatus] = useState<StatusMessage>({ type: '', message: '' });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [learningProfileOpen, setLearningProfileOpen] = useState(false);
  const [newCardsPerDay, setNewCardsPerDay] = useState<number | ''>(DEFAULT_NEW_CARDS_PER_DAY);

  // Learning profile state
  const [primaryCategory, setPrimaryCategory] = useState<PrimaryCategory | null>(null);
  const [studentLevel, setStudentLevel] = useState<StudentLevel | null>(null);
  const [studentField, setStudentField] = useState('');
  const [workFields, setWorkFields] = useState<WorkField[]>([]);
  const [workFieldOther, setWorkFieldOther] = useState('');
  const [workYearsExperience, setWorkYearsExperience] = useState<YearsExperience | null>(null);
  const [researchField, setResearchField] = useState('');
  const [researchYearsExperience, setResearchYearsExperience] = useState<YearsExperience | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [otherInterests, setOtherInterests] = useState('');
  const [spacedRepExperience, setSpacedRepExperience] = useState<SpacedRepExperience | null>(null);
  const [technicalityPreference, setTechnicalityPreference] = useState<TechnicalityLevel | null>(null);
  const [breadthPreference, setBreadthPreference] = useState<BreadthLevel | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<StatusMessage>({ type: '', message: '' });

  // Mochi Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importDecks, setImportDecks] = useState<MochiDeck[]>([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());
  const [fetchingImportDecks, setFetchingImportDecks] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<MochiImportResult | null>(null);
  const [importStatus, setImportStatus] = useState<StatusMessage>({ type: '', message: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async (): Promise<void> => {
    try {
      const savedNewCards = localStorage.getItem(NEW_CARDS_KEY);
      if (savedNewCards) {
        const parsed = parseInt(savedNewCards, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          setNewCardsPerDay(parsed);
        }
      }

      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMochiApiKey(data.settings?.mochiApiKey || '');
        setMochiDeckId(data.settings?.mochiDeckId || '');

        if (data.settings?.mochiApiKey) {
          fetchDecks(data.settings.mochiApiKey, data.settings.mochiDeckId);
        }

        // Load learning profile
        if (data.learningProfile) {
          setPrimaryCategory(data.learningProfile.primaryCategory || null);
          setStudentLevel(data.learningProfile.studentLevel || null);
          setStudentField(data.learningProfile.studentField || '');
          setWorkFields(data.learningProfile.workFields || []);
          setWorkFieldOther(data.learningProfile.workFieldOther || '');
          setWorkYearsExperience(data.learningProfile.workYearsExperience || null);
          setResearchField(data.learningProfile.researchField || '');
          setResearchYearsExperience(data.learningProfile.researchYearsExperience || null);
          setSelectedInterests(data.learningProfile.additionalInterests || []);
          setOtherInterests(data.learningProfile.additionalInterestsOther || '');
          setSpacedRepExperience(data.learningProfile.spacedRepExperience || null);
          setTechnicalityPreference(data.learningProfile.technicalityPreference || null);
          setBreadthPreference(data.learningProfile.breadthPreference || null);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDecks = async (
    apiKey: string = mochiApiKey,
    selectedDeckId: string = mochiDeckId
  ): Promise<void> => {
    if (!apiKey) {
      setStatus({ type: 'error', message: 'Enter your Mochi API key first' });
      return;
    }

    setFetchingDecks(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await fetch(`${MOCHI_API_URL}/decks`, {
        headers: {
          Authorization: `Basic ${btoa(apiKey + ':')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const deckList: MochiDeck[] = data.docs || [];
        setDecks(deckList);

        if (selectedDeckId && deckList.some((d) => d.id === selectedDeckId)) {
          setMochiDeckId(selectedDeckId);
        } else if (deckList.length > 0 && !selectedDeckId) {
          setMochiDeckId(deckList[0].id);
        }
      } else if (response.status === 401) {
        setStatus({ type: 'error', message: 'Invalid Mochi API key' });
        setDecks([]);
      } else {
        setStatus({ type: 'error', message: 'Failed to fetch decks' });
      }
    } catch (error) {
      console.error('Failed to fetch Mochi decks:', error);
      setStatus({ type: 'error', message: 'Failed to connect to Mochi' });
    } finally {
      setFetchingDecks(false);
    }
  };

  const handleNewCardsChange = (value: string): void => {
    if (value === '') {
      setNewCardsPerDay('');
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setNewCardsPerDay(num);
      localStorage.setItem(NEW_CARDS_KEY, num.toString());
    }
  };

  const handleNewCardsBlur = (): void => {
    if (newCardsPerDay === '' || newCardsPerDay === null) {
      setNewCardsPerDay(DEFAULT_NEW_CARDS_PER_DAY);
      localStorage.setItem(NEW_CARDS_KEY, DEFAULT_NEW_CARDS_PER_DAY.toString());
    }
  };

  const saveSettings = async (): Promise<void> => {
    setSaving(true);
    setStatus({ type: '', message: '' });

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setStatus({ type: 'error', message: 'Not authenticated' });
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mochiApiKey: mochiApiKey || null,
          mochiDeckId: mochiDeckId || null,
        }),
      });

      if (response.ok) {
        setStatus({ type: 'success', message: 'Settings saved' });
        setTimeout(() => setStatus({ type: '', message: '' }), 3000);
      } else {
        const data = await response.json();
        setStatus({ type: 'error', message: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setStatus({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (interest: string): void => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const needsStudentField = (): boolean => {
    return studentLevel === 'college' || studentLevel === 'graduate_school' || studentLevel === 'other';
  };

  const toggleWorkField = (field: WorkField): void => {
    setWorkFields((prev) => {
      if (prev.includes(field)) {
        return prev.filter((f) => f !== field);
      } else if (prev.length >= 5) {
        setProfileStatus({ type: 'error', message: 'Maximum 5 work fields allowed' });
        setTimeout(() => setProfileStatus({ type: '', message: '' }), 3000);
        return prev;
      }
      return [...prev, field];
    });
  };

  const handlePrimaryCategoryChange = (category: PrimaryCategory): void => {
    setPrimaryCategory(category);
    // Clear fields from other categories to avoid stale data
    if (category !== 'student') {
      setStudentLevel(null);
      setStudentField('');
    }
    if (category !== 'worker') {
      setWorkFields([]);
      setWorkFieldOther('');
      setWorkYearsExperience(null);
    }
    if (category !== 'researcher') {
      setResearchField('');
      setResearchYearsExperience(null);
    }
  };

  const saveLearningProfile = async (): Promise<void> => {
    setSavingProfile(true);
    setProfileStatus({ type: '', message: '' });

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setProfileStatus({ type: 'error', message: 'Not authenticated' });
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/user/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          primaryCategory: primaryCategory || null,
          studentLevel: primaryCategory === 'student' ? studentLevel : null,
          studentField: primaryCategory === 'student' && needsStudentField() ? studentField.trim() || null : null,
          workFields: primaryCategory === 'worker' && workFields.length > 0 ? workFields : null,
          workFieldOther: primaryCategory === 'worker' && workFields.includes('other') ? workFieldOther.trim() || null : null,
          workYearsExperience: primaryCategory === 'worker' ? workYearsExperience : null,
          researchField: primaryCategory === 'researcher' ? researchField.trim() || null : null,
          researchYearsExperience: primaryCategory === 'researcher' ? researchYearsExperience : null,
          additionalInterests: selectedInterests.length > 0 ? selectedInterests : null,
          additionalInterestsOther: otherInterests.trim() || null,
          spacedRepExperience: spacedRepExperience || null,
          technicalityPreference: technicalityPreference || null,
          breadthPreference: breadthPreference || null,
        }),
      });

      if (response.ok) {
        setProfileStatus({ type: 'success', message: 'Learning profile saved' });
        setTimeout(() => setProfileStatus({ type: '', message: '' }), 3000);
      } else {
        const data = await response.json();
        setProfileStatus({ type: 'error', message: data.error || 'Failed to save profile' });
      }
    } catch (error) {
      console.error('Failed to save learning profile:', error);
      setProfileStatus({ type: 'error', message: 'Failed to save profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Fetch decks for import selection
  const fetchImportDecks = async (): Promise<void> => {
    setFetchingImportDecks(true);
    setImportStatus({ type: '', message: '' });
    setImportResult(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setImportStatus({ type: 'error', message: 'Not authenticated' });
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/import-from-mochi`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setImportDecks(data.decks || []);
        setSelectedDeckIds(new Set());
      } else if (response.status === 401) {
        setImportStatus({ type: 'error', message: 'Invalid Mochi API key' });
      } else {
        const data = await response.json();
        setImportStatus({ type: 'error', message: data.error || 'Failed to fetch decks' });
      }
    } catch (error) {
      console.error('Failed to fetch import decks:', error);
      setImportStatus({ type: 'error', message: 'Failed to connect to server' });
    } finally {
      setFetchingImportDecks(false);
    }
  };

  // Toggle deck selection
  const toggleDeckSelection = (deckId: string): void => {
    setSelectedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) {
        next.delete(deckId);
      } else {
        next.add(deckId);
      }
      return next;
    });
  };

  // Run import
  const runImport = async (): Promise<void> => {
    if (selectedDeckIds.size === 0) {
      setImportStatus({ type: 'error', message: 'Select at least one deck to import' });
      return;
    }

    setImporting(true);
    setImportStatus({ type: '', message: '' });
    setImportResult(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setImportStatus({ type: 'error', message: 'Not authenticated' });
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/import-from-mochi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          deckIds: Array.from(selectedDeckIds),
          createFolders: true,
        }),
      });

      const data = await response.json() as MochiImportResult;
      setImportResult(data);

      if (data.success) {
        setImportStatus({ type: 'success', message: `Imported ${data.imported} cards` });
        setSelectedDeckIds(new Set());
      } else {
        setImportStatus({ type: 'error', message: data.errors?.[0] || 'Import failed' });
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportStatus({ type: 'error', message: 'Failed to import cards' });
    } finally {
      setImporting(false);
    }
  };

  // Build deck tree with indentation
  const buildDeckTree = (): Array<{ deck: MochiDeck; depth: number }> => {
    const children = new Map<string | null, MochiDeck[]>();

    importDecks.forEach((deck) => {
      const parentId = deck['parent-id'] || null;
      if (!children.has(parentId)) children.set(parentId, []);
      children.get(parentId)!.push(deck);
    });

    const result: Array<{ deck: MochiDeck; depth: number }> = [];

    const traverse = (parentId: string | null, depth: number): void => {
      const decks = children.get(parentId) || [];
      decks.sort((a, b) => a.name.localeCompare(b.name));
      decks.forEach((deck) => {
        result.push({ deck, depth });
        traverse(deck.id, depth + 1);
      });
    };

    traverse(null, 0);
    return result;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <div className="spinner w-8 h-8 border-3 border-gray-200 dark:border-gray-700 border-t-gray-800 dark:border-t-gray-200 rounded-full"></div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Settings</h2>

      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border divide-y divide-gray-100 dark:divide-dark-border">
        {/* Email */}
        <div className="px-5 py-4">
          <label className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">
            Email
          </label>
          <div className="text-gray-800 dark:text-gray-200">{user?.email}</div>
        </div>

        {/* Subscription */}
        <div className="px-5 py-4">
          <label className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">
            Subscription
          </label>
          {billingInfo?.isPro ? (
            <div className="flex items-center gap-3">
              <span className="pro-badge text-white text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide">
                Pro
              </span>
              <button
                onClick={onManage}
                className="text-sm text-gray-500 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
              >
                Manage subscription
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-800 dark:text-gray-200">Free</span>
                <span className="text-gray-400 dark:text-gray-500 text-sm ml-2">
                  {billingInfo?.cardsUsed || 0} / {billingInfo?.limit || 50} cards this month
                </span>
              </div>
              <button
                onClick={onUpgrade}
                className="btn-upgrade text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
              >
                Upgrade to Pro
              </button>
            </div>
          )}
        </div>

        {/* Study Settings */}
        <div className="px-5 py-4">
          <label className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">
            New Cards Per Day
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="100"
              value={newCardsPerDay}
              onChange={(e) => handleNewCardsChange(e.target.value)}
              onBlur={handleNewCardsBlur}
              className="w-20 px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-bg dark:text-gray-200"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">cards</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            Maximum number of new cards to study each day. Set to 0 for unlimited.
          </p>
        </div>

        {/* Appearance */}
        <div className="px-5 py-4">
          <label className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide block mb-1">
            Appearance
          </label>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-800 dark:text-gray-200">Dark Mode</span>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                isDark ? 'bg-gray-600' : 'bg-gray-200'
              }`}
              aria-label="Toggle dark mode"
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isDark ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Learning Profile Toggle */}
        <div className="px-5 py-4">
          <button
            onClick={() => setLearningProfileOpen(!learningProfileOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm text-gray-800 dark:text-gray-200">Learning Profile</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-gray-400 dark:text-gray-500 transition-transform ${
                learningProfileOpen ? 'rotate-180' : ''
              }`}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        {/* Learning Profile Content */}
        {learningProfileOpen && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/50">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Help us personalize your experience.
            </p>

            <div className="space-y-5">
              {/* Primary Category */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  What best describes you?
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'student', label: 'Student' },
                    { value: 'worker', label: 'Work in Industry' },
                    { value: 'researcher', label: 'Researcher' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handlePrimaryCategoryChange(option.value as PrimaryCategory)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        primaryCategory === option.value
                          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student-specific fields */}
              {primaryCategory === 'student' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Level of Study
                    </label>
                    <select
                      value={studentLevel || ''}
                      onChange={(e) => setStudentLevel(e.target.value as StudentLevel || null)}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-surface dark:text-gray-200"
                    >
                      <option value="">Select level</option>
                      {STUDENT_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {needsStudentField() && (
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        {studentLevel === 'college' ? 'Major' : 'Field of Study'}
                      </label>
                      <input
                        type="text"
                        value={studentField}
                        onChange={(e) => setStudentField(e.target.value)}
                        placeholder={studentLevel === 'college' ? 'e.g., Computer Science' : 'e.g., Neuroscience'}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-surface dark:text-gray-200 dark:placeholder-gray-500"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Worker-specific fields */}
              {primaryCategory === 'worker' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Fields (select all that apply)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {WORK_FIELDS.map((field) => (
                        <button
                          key={field.value}
                          type="button"
                          onClick={() => toggleWorkField(field.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            workFields.includes(field.value)
                              ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {field.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {workFields.includes('other') && (
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Please Specify
                      </label>
                      <input
                        type="text"
                        value={workFieldOther}
                        onChange={(e) => setWorkFieldOther(e.target.value)}
                        placeholder="e.g., Real Estate"
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-surface dark:text-gray-200 dark:placeholder-gray-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Years of Experience
                    </label>
                    <select
                      value={workYearsExperience || ''}
                      onChange={(e) => setWorkYearsExperience(e.target.value as YearsExperience || null)}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-surface dark:text-gray-200"
                    >
                      <option value="">Select experience</option>
                      {YEARS_EXPERIENCE.map((years) => (
                        <option key={years.value} value={years.value}>
                          {years.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Researcher-specific fields */}
              {primaryCategory === 'researcher' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Research Field
                    </label>
                    <input
                      type="text"
                      value={researchField}
                      onChange={(e) => setResearchField(e.target.value)}
                      placeholder="e.g., Computational Biology"
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-surface dark:text-gray-200 dark:placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Years of Experience
                    </label>
                    <select
                      value={researchYearsExperience || ''}
                      onChange={(e) => setResearchYearsExperience(e.target.value as YearsExperience || null)}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-surface dark:text-gray-200"
                    >
                      <option value="">Select experience</option>
                      {YEARS_EXPERIENCE.map((years) => (
                        <option key={years.value} value={years.value}>
                          {years.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Additional Interests */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Additional Interests
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {ADDITIONAL_INTERESTS.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedInterests.includes(interest)
                          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={otherInterests}
                  onChange={(e) => setOtherInterests(e.target.value)}
                  placeholder="Other interests (e.g., Philosophy, Music Theory)"
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-surface dark:text-gray-200 dark:placeholder-gray-500"
                />
              </div>

              {/* Learning Preferences Section */}
              <div className="pt-4 mt-4 border-t border-gray-200 dark:border-dark-border">
                <h4 className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                  Learning Preferences
                </h4>

                {/* Spaced Repetition Experience */}
                <div className="mb-5">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Experience with Spaced Repetition
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SPACED_REP_EXPERIENCE.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSpacedRepExperience(option.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          spacedRepExperience === option.value
                            ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Technicality Preference */}
                <div className="mb-5">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    How Technical Should Answers Be?
                  </label>
                  <div className="space-y-2">
                    {TECHNICALITY_EXAMPLES.map((option) => (
                      <button
                        key={option.level}
                        type="button"
                        onClick={() => setTechnicalityPreference(option.level)}
                        className={`w-full p-3 rounded-lg text-left text-sm transition-colors border ${
                          technicalityPreference === option.level
                            ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                            : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {option.label}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
                          "{option.example}"
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Breadth Preference */}
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    How Focused Should Questions Be?
                  </label>
                  <div className="space-y-2">
                    {BREADTH_LEVELS.map((option) => (
                      <button
                        key={option.level}
                        type="button"
                        onClick={() => setBreadthPreference(option.level)}
                        className={`w-full p-3 rounded-lg text-left text-sm transition-colors border ${
                          breadthPreference === option.level
                            ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                            : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {option.label}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
              <button
                onClick={saveLearningProfile}
                disabled={savingProfile}
                className="w-full py-2.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingProfile ? 'Saving...' : 'Save Learning Profile'}
              </button>

              {profileStatus.message && (
                <p
                  className={`text-sm text-center mt-3 ${
                    profileStatus.type === 'success'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {profileStatus.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Advanced Settings Toggle */}
        <div className="px-5 py-4">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm text-gray-800 dark:text-gray-200">Advanced Settings</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-gray-400 dark:text-gray-500 transition-transform ${
                advancedOpen ? 'rotate-180' : ''
              }`}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        {/* Advanced Settings Content */}
        {advancedOpen && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/50">
            <h4 className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Mochi Integration
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Connect your Mochi account to send flashcards directly from the extension.
            </p>

            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={mochiApiKey}
                  onChange={(e) => setMochiApiKey(e.target.value)}
                  placeholder="Enter your Mochi API key"
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-surface dark:text-gray-200 dark:placeholder-gray-500"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Get your API key from Mochi Settings - API
                </p>
              </div>

              {/* Deck Selection */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Default Deck
                </label>
                <div className="flex gap-2">
                  <select
                    value={mochiDeckId}
                    onChange={(e) => setMochiDeckId(e.target.value)}
                    disabled={decks.length === 0}
                    className="flex-1 px-3 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-dark-surface dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 disabled:bg-gray-50 dark:disabled:bg-dark-bg disabled:text-gray-400 dark:disabled:text-gray-500"
                  >
                    {decks.length === 0 ? (
                      <option value="">No decks loaded</option>
                    ) : (
                      decks.map((deck) => (
                        <option key={deck.id} value={deck.id}>
                          {deck.name}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    onClick={() => fetchDecks()}
                    disabled={fetchingDecks || !mochiApiKey}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {fetchingDecks ? 'Loading...' : 'Fetch'}
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full py-2.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Mochi Settings'}
              </button>

              {status.message && (
                <p
                  className={`text-sm text-center mt-3 ${
                    status.type === 'success'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {status.message}
                </p>
              )}
            </div>

            {/* Import from Mochi Section */}
            {mochiApiKey && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-border">
                <button
                  onClick={() => setImportOpen(!importOpen)}
                  className="flex items-center justify-between w-full text-left mb-3"
                >
                  <h4 className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Import from Mochi
                  </h4>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-gray-400 dark:text-gray-500 transition-transform ${
                      importOpen ? 'rotate-180' : ''
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {importOpen && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Import existing cards from your Mochi decks into Pluckk.
                    </p>

                    {/* Load Decks Button */}
                    {importDecks.length === 0 && (
                      <button
                        onClick={fetchImportDecks}
                        disabled={fetchingImportDecks}
                        className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {fetchingImportDecks ? 'Loading decks...' : 'Load Mochi Decks'}
                      </button>
                    )}

                    {/* Deck Selection List */}
                    {importDecks.length > 0 && (
                      <>
                        <div className="border border-gray-200 dark:border-dark-border rounded-lg max-h-64 overflow-y-auto">
                          {buildDeckTree().map(({ deck, depth }) => (
                            <label
                              key={deck.id}
                              className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-dark-border last:border-b-0"
                              style={{ paddingLeft: `${12 + depth * 16}px` }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedDeckIds.has(deck.id)}
                                onChange={() => toggleDeckSelection(deck.id)}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 focus:ring-gray-500 dark:focus:ring-gray-400"
                              />
                              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                                {deck.name}
                              </span>
                            </label>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={runImport}
                            disabled={importing || selectedDeckIds.size === 0}
                            className="flex-1 py-2.5 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {importing ? 'Importing...' : `Import ${selectedDeckIds.size} deck${selectedDeckIds.size !== 1 ? 's' : ''}`}
                          </button>
                          <button
                            onClick={() => {
                              setImportDecks([]);
                              setSelectedDeckIds(new Set());
                              setImportResult(null);
                              setImportStatus({ type: '', message: '' });
                            }}
                            className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-200"
                          >
                            Reset
                          </button>
                        </div>
                      </>
                    )}

                    {/* Import Result */}
                    {importResult && (
                      <div className={`p-3 rounded-lg text-sm ${
                        importResult.success
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      }`}>
                        <p className="font-medium">
                          {importResult.success ? 'Import complete' : 'Import had issues'}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          <li>Cards imported: {importResult.imported}</li>
                          <li>Duplicates skipped: {importResult.skipped}</li>
                          {importResult.foldersCreated.length > 0 && (
                            <li>Folders created: {importResult.foldersCreated.join(', ')}</li>
                          )}
                          {importResult.errors.length > 0 && (
                            <li className="text-red-600 dark:text-red-400">
                              Errors: {importResult.errors.join('; ')}
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Import Status */}
                    {importStatus.message && !importResult && (
                      <p
                        className={`text-sm text-center ${
                          importStatus.type === 'success'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {importStatus.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sign Out */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-dark-border">
          <button
            onClick={onSignOut}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
