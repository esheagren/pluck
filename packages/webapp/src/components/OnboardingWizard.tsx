import { useState, type JSX } from 'react';
import type {
  PrimaryCategory,
  StudentLevel,
  WorkField,
  YearsExperience,
  BreadthLevel,
} from '../types';
import {
  STUDENT_LEVELS,
  WORK_FIELDS,
  YEARS_EXPERIENCE,
  BREADTH_LEVELS,
  BREADTH_EXAMPLE_QUESTIONS,
} from '../types';

// Chrome Web Store URL (update when extension is published)
const EXTENSION_URL = 'https://pluckk.app/extension';

// Sample content for the first card step
const SAMPLE_TEXT = `Spaced repetition is a learning technique that schedules reviews at increasing intervals based on how well you remember each item. Items you struggle with appear more frequently, while well-remembered items appear less often.`;

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
  technicalityPreference: null; // Always null - technicality is inferred from card selections, not set during onboarding
  breadthPreference: BreadthLevel | null;
}

const STEPS = ['About you', 'Details', 'Breadth', 'Extension', 'First Card'];

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
  // Learning preferences
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
        additionalInterests: [], // Can be set later in Settings
        additionalInterestsOther: null,
        spacedRepExperience: null,
        technicalityPreference: null,
        breadthPreference,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExtensionClick = (): void => {
    window.open(EXTENSION_URL, '_blank');
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
            Let's get started
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

          {/* Step 3: Breadth Preference */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  How focused should your questions be?
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose how broadly we explore topics beyond your highlight
                </p>
              </div>

              {/* Horizontal scale */}
              <div className="relative px-2">
                {/* Track line */}
                <div className="absolute top-3 left-8 right-8 h-0.5 bg-gray-200 dark:bg-gray-700" />

                {/* Scale points */}
                <div className="relative flex justify-between">
                  {BREADTH_LEVELS.map((item) => (
                    <button
                      key={item.level}
                      onClick={() => setBreadthPreference(item.level)}
                      className="flex flex-col items-center flex-1 max-w-[100px] group"
                    >
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors mb-2 ${
                          breadthPreference === item.level
                            ? 'border-gray-700 dark:border-gray-300 bg-white dark:bg-dark-surface'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface group-hover:border-gray-400 dark:group-hover:border-gray-500'
                        }`}
                      >
                        {breadthPreference === item.level && (
                          <div className="w-2.5 h-2.5 rounded-full bg-gray-700 dark:bg-gray-300" />
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium transition-colors ${
                          breadthPreference === item.level
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-0.5 leading-tight">
                        {item.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Example section */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-100 dark:border-dark-border">
                {/* Source text */}
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium mb-2">
                    Source text
                  </p>
                  <div className="bg-white dark:bg-dark-surface rounded-lg p-4 border-l-2 border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      <span className="bg-yellow-100 dark:bg-yellow-900/30 px-0.5">
                        Caffeine blocks adenosine receptors in the brain, which is why it makes you feel alert.
                      </span>
                    </p>
                  </div>
                </div>

                {/* Questions */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">
                      Questions we&apos;d generate
                    </p>
                    <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                      {breadthPreference ? BREADTH_EXAMPLE_QUESTIONS[breadthPreference].length : 1} question{(breadthPreference ? BREADTH_EXAMPLE_QUESTIONS[breadthPreference].length : 1) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {(breadthPreference ? BREADTH_EXAMPLE_QUESTIONS[breadthPreference] : BREADTH_EXAMPLE_QUESTIONS[1]).map((q, i) => (
                      <li
                        key={q.text}
                        className="flex items-start gap-2"
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${
                            q.extended
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span
                          className={`text-sm leading-relaxed ${
                            q.extended
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {q.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Extension Download */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  You'll need the Chrome extension
                </label>
              </div>

              {/* Browser mockup */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                {/* Browser toolbar */}
                <div className="bg-gray-200 dark:bg-gray-700 px-3 py-2 flex items-center gap-2">
                  {/* Window controls */}
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                  </div>
                  {/* URL bar */}
                  <div className="flex-1 bg-white dark:bg-gray-600 rounded px-2 py-1 mx-2">
                    <span className="text-[10px] text-gray-400 dark:text-gray-400">example.com/article</span>
                  </div>
                  {/* Extension icon */}
                  <div className="w-5 h-5 bg-gray-800 dark:bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white dark:text-gray-800">P</span>
                  </div>
                </div>

                {/* Browser content area */}
                <div className="flex h-36">
                  {/* Webpage content (left) */}
                  <div className="flex-1 bg-white dark:bg-gray-900 p-3 overflow-hidden">
                    <div className="space-y-2">
                      <div className="h-2 w-24 bg-gray-300 dark:bg-gray-600 rounded" />
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded" />
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded" />
                      {/* Highlighted text */}
                      <div className="h-1.5 w-3/4 bg-yellow-200 dark:bg-yellow-700/50 rounded" />
                      <div className="h-1.5 w-1/2 bg-yellow-200 dark:bg-yellow-700/50 rounded" />
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded" />
                      <div className="h-1.5 w-5/6 bg-gray-100 dark:bg-gray-700 rounded" />
                    </div>
                  </div>

                  {/* Sidebar (right) */}
                  <div className="w-28 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-2">
                    <div className="text-[8px] font-medium text-gray-500 dark:text-gray-400 mb-2">Generated cards</div>
                    {/* Mini card 1 */}
                    <div className="bg-white dark:bg-gray-700 rounded p-1.5 mb-1.5 border border-gray-200 dark:border-gray-600 shadow-sm">
                      <div className="h-1 w-full bg-gray-200 dark:bg-gray-500 rounded mb-1" />
                      <div className="h-1 w-3/4 bg-gray-100 dark:bg-gray-600 rounded" />
                    </div>
                    {/* Mini card 2 */}
                    <div className="bg-white dark:bg-gray-700 rounded p-1.5 border border-gray-200 dark:border-gray-600 shadow-sm">
                      <div className="h-1 w-full bg-gray-200 dark:bg-gray-500 rounded mb-1" />
                      <div className="h-1 w-2/3 bg-gray-100 dark:bg-gray-600 rounded" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Brief description */}
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Highlight text on any page, click the extension, and save flashcards
              </p>

              {/* Add to Chrome button */}
              <button
                onClick={handleExtensionClick}
                className="w-full px-5 py-3 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.171-5.977A11.943 11.943 0 0 0 24 12c0-.71-.062-1.41-.181-2.091h-7.907a5.443 5.443 0 0 1 .361 2.277 5.46 5.46 0 0 1-.64 2.5z" />
                </svg>
                Add to Chrome
              </button>
            </div>
          )}

          {/* Step 5: First Card */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Try it out
                </label>
              </div>

              {/* Sample text */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-dark-border">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {SAMPLE_TEXT}
                </p>
              </div>

              {/* Instruction */}
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Click on your extension to highlight this text and create a flashcard.
              </p>
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
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  step === 3
                    ? 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    : 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 hover:bg-gray-900 dark:hover:bg-white'
                }`}
              >
                {step === 3 ? "I'll do this later" : 'Continue'}
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
