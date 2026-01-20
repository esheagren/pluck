import { useState, type JSX } from 'react';
import type {
  PrimaryCategory,
  StudentLevel,
  WorkField,
  YearsExperience,
} from '../types';
import {
  STUDENT_LEVELS,
  WORK_FIELDS,
  YEARS_EXPERIENCE,
  ADDITIONAL_INTERESTS,
} from '../types';

interface OnboardingWizardProps {
  onComplete: (profile: OnboardingData) => Promise<void>;
  onSkip: () => void;
}

export interface OnboardingData {
  primaryCategory: PrimaryCategory;
  studentLevel: StudentLevel | null;
  studentField: string | null;
  workField: WorkField | null;
  workFieldOther: string | null;
  workYearsExperience: YearsExperience | null;
  researchField: string | null;
  researchYearsExperience: YearsExperience | null;
  additionalInterests: string[];
  additionalInterestsOther: string | null;
}

const STEPS = ['What do you do?', 'Tell us more', 'Other interests'];

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
  const [workField, setWorkField] = useState<WorkField | null>(null);
  const [workFieldOther, setWorkFieldOther] = useState('');
  const [workYearsExperience, setWorkYearsExperience] = useState<YearsExperience | null>(null);
  // Researcher
  const [researchField, setResearchField] = useState('');
  const [researchYearsExperience, setResearchYearsExperience] = useState<YearsExperience | null>(null);
  // Additional interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [otherInterests, setOtherInterests] = useState('');

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
        workField: primaryCategory === 'worker' ? workField : null,
        workFieldOther: primaryCategory === 'worker' && workField === 'other' ? workFieldOther.trim() || null : null,
        workYearsExperience: primaryCategory === 'worker' ? workYearsExperience : null,
        researchField: primaryCategory === 'researcher' ? researchField.trim() || null : null,
        researchYearsExperience: primaryCategory === 'researcher' ? researchYearsExperience : null,
        additionalInterests: selectedInterests,
        additionalInterestsOther: otherInterests.trim() || null,
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
        return workField !== null && workYearsExperience !== null;
      }
      if (primaryCategory === 'researcher') {
        return researchYearsExperience !== null;
      }
    }
    return true;
  };

  const getStudentLevelLabel = (level: StudentLevel): string => {
    return STUDENT_LEVELS.find((l) => l.value === level)?.label || level;
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
        <div className="px-6 py-5 min-h-[320px]">
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
                  What field do you work in?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {WORK_FIELDS.map((field) => (
                    <button
                      key={field.value}
                      onClick={() => setWorkField(field.value)}
                      className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        workField === field.value
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

              {workField === 'other' && (
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

          {/* Step 3: Additional Interests */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  What other fields are you interested in?
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Other interests
                </label>
                <input
                  type="text"
                  value={otherInterests}
                  onChange={(e) => setOtherInterests(e.target.value)}
                  placeholder="e.g., Philosophy, Music Theory"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 bg-white dark:bg-dark-bg dark:text-gray-200 dark:placeholder-gray-500"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Optional - add any other topics not listed above
                </p>
              </div>

              {/* Summary */}
              <div className="pt-3 border-t border-gray-100 dark:border-dark-border">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Your profile:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {primaryCategory === 'student' && studentLevel && (
                    <>
                      {getStudentLevelLabel(studentLevel)} student
                      {studentField && ` studying ${studentField}`}
                    </>
                  )}
                  {primaryCategory === 'worker' && workField && (
                    <>
                      {workField === 'other' ? workFieldOther || 'Professional' : WORK_FIELDS.find(f => f.value === workField)?.label}
                      {workYearsExperience && ` with ${workYearsExperience} years experience`}
                    </>
                  )}
                  {primaryCategory === 'researcher' && (
                    <>
                      Researcher{researchField && ` in ${researchField}`}
                      {researchYearsExperience && ` with ${researchYearsExperience} years experience`}
                    </>
                  )}
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
