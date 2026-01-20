import { useState, type JSX } from 'react';
import type {
  PrimaryCategory,
  StudentLevel,
  WorkField,
  YearsExperience,
  SpacedRepExperience,
  TechnicalityLevel,
  BreadthLevel,
} from '../types';
import {
  STUDENT_LEVELS,
  WORK_FIELDS,
  YEARS_EXPERIENCE,
  ADDITIONAL_INTERESTS,
  SPACED_REP_EXPERIENCE,
  TECHNICALITY_EXAMPLES,
  BREADTH_EXAMPLES,
} from '../types';

interface OnboardingWizardProps {
  onComplete: (profile: OnboardingData) => Promise<void>;
  onSkip: () => void;
}

export interface OnboardingData {
  primaryCategory: PrimaryCategory;
  studentLevel: StudentLevel | null;
  studentField: string | null;
  workFields: WorkField[];
  workFieldOther: string | null;
  workYearsExperience: YearsExperience | null;
  researchField: string | null;
  researchYearsExperience: YearsExperience | null;
  additionalInterests: string[];
  additionalInterestsOther: string | null;
  spacedRepExperience: SpacedRepExperience | null;
  technicalityPreference: TechnicalityLevel | null;
  breadthPreference: BreadthLevel | null;
}

const STEPS = ['About you', 'Details', 'Experience', 'Preferences'];

export default function OnboardingWizard({
  onComplete,
  onSkip,
}: OnboardingWizardProps): JSX.Element {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [primaryCategory, setPrimaryCategory] = useState<PrimaryCategory | null>(null);
  // Student
  const [studentLevel, setStudentLevel] = useState<StudentLevel | null>(null);
  const [studentField, setStudentField] = useState('');
  // Worker
  const [workFields, setWorkFields] = useState<WorkField[]>([]);
  const [workFieldOther, setWorkFieldOther] = useState('');
  const [workYearsExperience, setWorkYearsExperience] = useState<YearsExperience | null>(null);
  // Researcher
  const [researchField, setResearchField] = useState('');
  const [researchYearsExperience, setResearchYearsExperience] = useState<YearsExperience | null>(null);
  // Additional interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [otherInterests, setOtherInterests] = useState('');
  // Learning preferences
  const [spacedRepExperience, setSpacedRepExperience] = useState<SpacedRepExperience | null>(null);
  const [technicalityPreference, setTechnicalityPreference] = useState<TechnicalityLevel | null>(null);
  const [breadthPreference, setBreadthPreference] = useState<BreadthLevel | null>(null);

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
    if (!primaryCategory) return;
    setSaving(true);
    try {
      await onComplete({
        primaryCategory,
        studentLevel: primaryCategory === 'student' ? studentLevel : null,
        studentField: primaryCategory === 'student' && needsStudentField() ? studentField.trim() || null : null,
        workFields: primaryCategory === 'worker' ? workFields : [],
        workFieldOther: primaryCategory === 'worker' && workFields.includes('other') ? workFieldOther.trim() || null : null,
        workYearsExperience: primaryCategory === 'worker' ? workYearsExperience : null,
        researchField: primaryCategory === 'researcher' ? researchField.trim() || null : null,
        researchYearsExperience: primaryCategory === 'researcher' ? researchYearsExperience : null,
        additionalInterests: selectedInterests,
        additionalInterestsOther: otherInterests.trim() || null,
        spacedRepExperience,
        technicalityPreference,
        breadthPreference,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (interest: string): void => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const toggleWorkField = (field: WorkField): void => {
    setWorkFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const needsStudentField = (): boolean => {
    return studentLevel === 'college' || studentLevel === 'graduate_school' || studentLevel === 'other';
  };

  const canProceed = (): boolean => {
    if (step === 0) return primaryCategory !== null;
    if (step === 1) {
      if (primaryCategory === 'student') {
        return studentLevel !== null;
      }
      if (primaryCategory === 'worker') {
        return workFields.length > 0 && workYearsExperience !== null;
      }
      if (primaryCategory === 'researcher') {
        return researchYearsExperience !== null;
      }
    }
    return true;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-surface rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-dark-border flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Personalize your experience
          </h2>

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
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {/* Step 1: Primary Category */}
          {step === 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                What best describes you?
              </label>
              {[
                { value: 'student', label: "I'm a student", desc: 'Currently studying or in school' },
                { value: 'worker', label: 'I work in industry', desc: 'Professional or career-focused' },
                { value: 'researcher', label: "I'm a researcher", desc: 'Academic or independent research' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setPrimaryCategory(option.value as PrimaryCategory)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    primaryCategory === option.value
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
          )}

          {/* Step 2: Category-specific drill-down */}
          {step === 1 && primaryCategory === 'student' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  What level are you studying at?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STUDENT_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setStudentLevel(level.value)}
                      className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                        studentLevel === level.value
                          ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {level.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {needsStudentField() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {studentLevel === 'college' ? "What's your major?" : "What's your field of study?"}
                  </label>
                  <input
                    type="text"
                    value={studentField}
                    onChange={(e) => setStudentField(e.target.value)}
                    placeholder={studentLevel === 'college' ? 'e.g., Computer Science, Biology' : 'e.g., Neuroscience, Economics'}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-bg dark:text-gray-200 dark:placeholder-gray-500"
                  />
                </div>
              )}
            </div>
          )}

          {step === 1 && primaryCategory === 'worker' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  What fields do you work in? <span className="font-normal text-gray-400">(select all that apply)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {WORK_FIELDS.map((field) => (
                    <button
                      key={field.value}
                      onClick={() => toggleWorkField(field.value)}
                      className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        workFields.includes(field.value)
                          ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {field.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {workFields.includes('other') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Please specify
                  </label>
                  <input
                    type="text"
                    value={workFieldOther}
                    onChange={(e) => setWorkFieldOther(e.target.value)}
                    placeholder="e.g., Real Estate, Non-profit"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-bg dark:text-gray-200 dark:placeholder-gray-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  How many years of experience?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {YEARS_EXPERIENCE.map((years) => (
                    <button
                      key={years.value}
                      onClick={() => setWorkYearsExperience(years.value)}
                      className={`text-center px-3 py-2.5 rounded-lg border transition-colors ${
                        workYearsExperience === years.value
                          ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {years.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && primaryCategory === 'researcher' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What&apos;s your research field?
                </label>
                <input
                  type="text"
                  value={researchField}
                  onChange={(e) => setResearchField(e.target.value)}
                  placeholder="e.g., Computational Biology, Climate Science"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-bg dark:text-gray-200 dark:placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  How many years have you been researching?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {YEARS_EXPERIENCE.map((years) => (
                    <button
                      key={years.value}
                      onClick={() => setResearchYearsExperience(years.value)}
                      className={`text-center px-3 py-2.5 rounded-lg border transition-colors ${
                        researchYearsExperience === years.value
                          ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {years.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Spaced Rep Experience & Additional Interests */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Have you used spaced repetition before?
                </label>
                <div className="space-y-2">
                  {SPACED_REP_EXPERIENCE.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSpacedRepExperience(option.value)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        spacedRepExperience === option.value
                          ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {option.label}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  What other fields interest you?
                </label>
                <div className="flex flex-wrap gap-2">
                  {ADDITIONAL_INTERESTS.map((interest) => (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedInterests.includes(interest)
                          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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
                  className="w-full mt-3 px-4 py-3 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-bg dark:text-gray-200 dark:placeholder-gray-500"
                />
              </div>
            </div>
          )}

          {/* Step 4: Card Preferences */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Technicality Preference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  How technical should explanations be?
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Example: &quot;What is ATP?&quot;
                </p>
                <div className="space-y-2">
                  {TECHNICALITY_EXAMPLES.map((item) => (
                    <button
                      key={item.level}
                      onClick={() => setTechnicalityPreference(item.level)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        technicalityPreference === item.level
                          ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-6">{item.level}</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {item.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 ml-8 italic">
                        &quot;{item.example}&quot;
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Breadth Preference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  How many related questions should we generate?
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  When you highlight text about ATP, we could ask:
                </p>
                <div className="space-y-2">
                  {BREADTH_EXAMPLES.map((item) => (
                    <button
                      key={item.level}
                      onClick={() => setBreadthPreference(item.level)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        breadthPreference === item.level
                          ? 'border-gray-800 dark:border-gray-200 bg-gray-50 dark:bg-gray-800'
                          : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-6">{item.level}</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {item.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 ml-8">
                        {item.questions.map((q, i) => (
                          <span key={q}>
                            {i > 0 && ' · '}
                            <span className="italic">&quot;{q}&quot;</span>
                          </span>
                        ))}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/50 flex items-center justify-between flex-shrink-0">
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
                disabled={saving || !canProceed()}
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
