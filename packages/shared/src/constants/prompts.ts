// Default system prompt for card generation
// This should match the base prompt in generate-cards.ts buildSystemPrompt()
// (without persona and Pro-only diagram style which are added dynamically)

export const DEFAULT_SYSTEM_PROMPT: string = `You are a spaced repetition card generator. Create cards that produce durable understanding through retrieval practice.

**Card Styles (choose the most appropriate for each piece of knowledge):**

1. **qa** - Direct factual question for single facts
   Example:
   {"style":"qa","question":"What type of chicken parts are used in stock?","answer":"Bones","tags":{"content_type":"fact","domain":"cooking","technicality":1}}

2. **qa_bidirectional** - For DEFINITIONS where both directions are useful. Generates forward (term→definition) and reverse (definition→term). Counts as ONE card toward the 4-8 target.
   ALWAYS use this style when the text defines a term, concept, or introduces vocabulary.
   Example:
   {"style":"qa_bidirectional","forward":{"question":"What is photosynthesis?","answer":"The process by which plants convert light energy into chemical energy"},"reverse":{"question":"What biological process describes plants converting light energy into chemical energy?","answer":"Photosynthesis"},"tags":{"content_type":"definition","domain":"biology","technicality":2}}

3. **cloze** - Single fill-in-the-blank for key terms or relationships
   Example:
   {"style":"cloze","question":"The mitochondria is the ___ of the cell","answer":"powerhouse","tags":{"content_type":"fact","domain":"biology","technicality":1}}

4. **cloze_list** - For CLOSED LISTS with fixed, known members. Creates N+1 clozes: one per item PLUS a final "recall all" card. Counts as ONE card in UI but expands to N+1 on save.
   For N items: first N prompts each occlude ONE item, final prompt occludes ALL items.
   Example (3 items → 4 prompts):
   {"style":"cloze_list","list_name":"Primary colors","items":["red","blue","yellow"],"prompts":[{"question":"Primary colors: ___, blue, yellow","answer":"red"},{"question":"Primary colors: red, ___, yellow","answer":"blue"},{"question":"Primary colors: red, blue, ___","answer":"yellow"},{"question":"Primary colors: ___, ___, ___","answer":"red, blue, yellow"}],"tags":{"content_type":"list","domain":"art","technicality":1}}

5. **explanation** - "Why" or "How" questions connecting facts to deeper meaning
   Example:
   {"style":"explanation","question":"Why are bones used instead of meat for making stock?","answer":"Bones contain collagen which converts to gelatin, giving the stock body and richness","tags":{"content_type":"concept","domain":"cooking","technicality":2}}

6. **application** - Connect knowledge to real-world situations or decision-making
   Example:
   {"style":"application","question":"When cooking a savory dish with water, what should you consider using instead?","answer":"Stock, as it adds depth and flavor","tags":{"content_type":"procedure","domain":"cooking","technicality":1}}

**Tags (always include all three):**
- content_type: "definition" | "fact" | "concept" | "procedure" | "list"
- domain: infer from context (e.g., "biology", "cooking", "programming", "machine_learning", "history")
- technicality: 1 | 2 | 3 | 4
  - 1 = Intuitive (early high school or before): simple analogies, everyday language, no jargon
  - 2 = Foundational (high school): basic terminology, concepts explained accessibly
  - 3 = College: technical terminology, specific details, assumes foundational knowledge
  - 4 = Graduate: expert precision, formulas, quantitative details, assumes deep background

**Critical Rules:**
- Generate 4-8 cards total depending on the complexity and richness of the source material (qa_bidirectional and cloze_list each count as ONE card)
- ALWAYS use qa_bidirectional when text contains a definition (X is Y, X means Y, X refers to Y)
- Use cloze_list for enumerated lists with fixed membership
- Cover the key concepts thoroughly - aim for comprehensive extraction of learnable facts
- Tags help organization - always include content_type, domain, and technicality

**Output Format:**
Return ONLY valid JSON, no markdown code blocks:
{"cards":[...]}`;

/**
 * Learning profile fields for persona prompt generation
 */
export type PrimaryCategory = 'student' | 'worker' | 'researcher';
export type StudentLevel = 'high_school' | 'college' | 'medical_school' | 'law_school' | 'graduate_school' | 'other';
export type WorkField = 'consulting' | 'engineering' | 'product' | 'finance' | 'marketing' | 'design' | 'sales' | 'operations' | 'legal' | 'healthcare' | 'education' | 'other';
export type YearsExperience = '1-2' | '3-5' | '6-10' | '10+';
export type SpacedRepExperience = 'none' | 'tried' | 'regular' | 'power_user';
export type TechnicalityLevel = 1 | 2 | 3 | 4;
export type BreadthLevel = 1 | 2 | 3 | 4;

export interface LearningProfileForPrompt {
  primaryCategory?: PrimaryCategory | null;
  // Student
  studentLevel?: StudentLevel | null;
  studentField?: string | null;
  // Worker
  workFields?: WorkField[] | null;
  workFieldOther?: string | null;
  workYearsExperience?: YearsExperience | null;
  // Researcher
  researchField?: string | null;
  researchYearsExperience?: YearsExperience | null;
  // Additional interests
  additionalInterests?: string[] | null;
  additionalInterestsOther?: string | null;
  // Learning preferences
  spacedRepExperience?: SpacedRepExperience | null;
  technicalityPreference?: TechnicalityLevel | null;
  breadthPreference?: BreadthLevel | null;
}

const STUDENT_LEVEL_LABELS: Record<StudentLevel, string> = {
  high_school: 'high school student',
  college: 'college student',
  medical_school: 'medical student',
  law_school: 'law student',
  graduate_school: 'graduate student',
  other: 'student',
};

const WORK_FIELD_LABELS: Record<WorkField, string> = {
  consulting: 'consultant',
  engineering: 'engineer',
  product: 'product manager',
  finance: 'finance professional',
  marketing: 'marketing professional',
  design: 'designer',
  sales: 'sales professional',
  operations: 'operations professional',
  legal: 'legal professional',
  healthcare: 'healthcare professional',
  education: 'educator',
  other: 'professional',
};

const TECHNICALITY_GUIDANCE: Record<TechnicalityLevel, string> = {
  1: 'Use intuitive language with analogies and everyday comparisons. Avoid jargon and technical terms.',
  2: 'Use conceptual explanations that explain mechanisms without heavy math or jargon. Define technical terms when used.',
  3: 'Include specific details, measurements, and technical terminology. Assume familiarity with the domain.',
  4: 'Use precise technical language, formulas, and quantitative details. Assume expert-level background.',
};

const BREADTH_GUIDANCE: Record<BreadthLevel, string> = {
  1: 'LASER focus: Generate cards only about exactly what was highlighted. Stick to the specific facts presented, nothing more.',
  2: 'NARROW focus: Generate cards about the highlighted content plus direct implications that follow logically.',
  3: 'MEDIUM focus: Generate cards that connect the highlighted content to related concepts, causes, and effects.',
  4: 'SYNTHESIZER mode: Generate exploratory cards including broader connections, applications, and questions the user might not have thought to ask.',
};

/**
 * Builds a persona prompt section from user's learning profile.
 * Returns empty string if profile is empty or has no meaningful data.
 */
export function buildPersonaPrompt(profile: LearningProfileForPrompt | null | undefined): string {
  if (!profile) return '';

  // If no category and no preferences, return empty
  const hasPreferences = profile.technicalityPreference || profile.breadthPreference;
  if (!profile.primaryCategory && !hasPreferences) return '';

  const parts: string[] = [];

  // Build the main persona description
  if (profile.primaryCategory) {
    let persona = 'The user is ';

    if (profile.primaryCategory === 'student') {
      const level = profile.studentLevel || 'other';
      persona += `a ${STUDENT_LEVEL_LABELS[level]}`;
      if (profile.studentField) {
        persona += ` studying ${profile.studentField}`;
      }
    } else if (profile.primaryCategory === 'worker') {
      const fields = profile.workFields || [];
      if (fields.length === 0 && profile.workFieldOther) {
        persona += `a ${profile.workFieldOther} professional`;
      } else if (fields.length === 1) {
        const field = fields[0];
        if (field === 'other' && profile.workFieldOther) {
          persona += `a ${profile.workFieldOther} professional`;
        } else {
          persona += `a ${WORK_FIELD_LABELS[field]}`;
        }
      } else if (fields.length > 1) {
        const labels = fields.map(f => f === 'other' && profile.workFieldOther ? profile.workFieldOther : WORK_FIELD_LABELS[f]);
        persona += `a professional working in ${labels.join(', ')}`;
      } else {
        persona += 'a working professional';
      }
      if (profile.workYearsExperience) {
        persona += ` with ${profile.workYearsExperience} years of experience`;
      }
    } else if (profile.primaryCategory === 'researcher') {
      persona += 'a researcher';
      if (profile.researchField) {
        persona += ` in ${profile.researchField}`;
      }
      if (profile.researchYearsExperience) {
        persona += ` with ${profile.researchYearsExperience} years of experience`;
      }
    }

    persona += '.';
    parts.push(persona);
  }

  // Additional interests
  const interests: string[] = [];
  if (profile.additionalInterests && profile.additionalInterests.length > 0) {
    interests.push(...profile.additionalInterests);
  }
  if (profile.additionalInterestsOther) {
    interests.push(profile.additionalInterestsOther);
  }
  if (interests.length > 0) {
    parts.push(`They are also interested in: ${interests.join(', ')}.`);
  }

  // Technicality preference
  if (profile.technicalityPreference) {
    parts.push(`**Technicality preference:** ${TECHNICALITY_GUIDANCE[profile.technicalityPreference]}`);
  }

  // Breadth preference
  if (profile.breadthPreference) {
    parts.push(`**Breadth preference:** ${BREADTH_GUIDANCE[profile.breadthPreference]}`);
  }

  if (parts.length === 0) return '';

  return `
## User Context
${parts.join('\n\n')}

Tailor cards to this user's background, expertise level, and stated preferences.
`;
}
