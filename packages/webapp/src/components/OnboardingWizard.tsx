import { useState, type JSX } from 'react';
import type { ExpertiseLevel, CardStylePreference } from '../types';
import { PREDEFINED_DOMAINS } from '../types';

interface OnboardingWizardProps {
  onComplete: (profile: OnboardingData) => Promise<void>;
  onSkip: () => void;
}

export interface OnboardingData {
  role: string;
  learningGoals: string;
  expertiseLevel: ExpertiseLevel;
  cardStyle: CardStylePreference;
  domains: string[];
}

const STEPS = ['Role & Goals', 'Experience', 'Domains'];

export default function OnboardingWizard({
  onComplete,
  onSkip,
}: OnboardingWizardProps): JSX.Element {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [role, setRole] = useState('');
  const [learningGoals, setLearningGoals] = useState('');
  const [expertiseLevel, setExpertiseLevel] = useState<ExpertiseLevel>('intermediate');
  const [cardStyle, setCardStyle] = useState<CardStylePreference>('balanced');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [customDomain, setCustomDomain] = useState('');

  const handleNext = (): void => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = (): void => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = async (): Promise<void> => {
    setSaving(true);
    try {
      const domains = [...selectedDomains];
      if (customDomain.trim()) {
        domains.push(customDomain.trim());
      }

      await onComplete({
        role: role.trim(),
        learningGoals: learningGoals.trim(),
        expertiseLevel,
        cardStyle,
        domains,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleDomain = (domain: string): void => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const canProceed = (): boolean => {
    if (step === 0) return role.trim().length > 0;
    return true;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-dark-border">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Welcome to Pluckk
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tell us about yourself so we can personalize your flashcards
          </p>

          {/* Progress indicator */}
          <div className="flex gap-2 mt-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-gray-800 dark:bg-gray-200' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-5 min-h-[280px]">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What&apos;s your role?
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Medical student, Software engineer, Language learner"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-bg dark:text-gray-200 dark:placeholder-gray-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What are you trying to learn?
                </label>
                <textarea
                  value={learningGoals}
                  onChange={(e) => setLearningGoals(e.target.value)}
                  placeholder="e.g., Preparing for USMLE Step 1, Learning Spanish for travel, Studying for AWS certification"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-bg dark:text-gray-200 dark:placeholder-gray-500 resize-none"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Optional - helps us tailor cards to your specific goals
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Your expertise level
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'beginner', label: 'Beginner', desc: 'New to the subject, need foundational concepts explained' },
                    { value: 'intermediate', label: 'Intermediate', desc: 'Have some background, comfortable with technical terms' },
                    { value: 'expert', label: 'Expert', desc: 'Deep knowledge, prefer advanced and nuanced content' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setExpertiseLevel(option.value as ExpertiseLevel)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        expertiseLevel === option.value
                          ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {option.label}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {option.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Card style preference
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'concise', label: 'Concise', desc: 'Brief, to-the-point answers' },
                    { value: 'balanced', label: 'Balanced', desc: 'Moderate detail with context' },
                    { value: 'detailed', label: 'Detailed', desc: 'Comprehensive explanations' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setCardStyle(option.value as CardStylePreference)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        cardStyle === option.value
                          ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {option.label}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        {option.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  What subjects are you studying?
                </label>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_DOMAINS.map((domain) => (
                    <button
                      key={domain}
                      onClick={() => toggleDomain(domain)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedDomains.includes(domain)
                          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {domain}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Other topics
                </label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="e.g., Neuroscience, Machine Learning, Japanese"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-bg dark:text-gray-200 dark:placeholder-gray-500"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Add any specific topics or fields not listed above
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/50 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Skip for now
          </button>

          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Back
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="px-5 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={saving}
                className="px-5 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Get Started'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
