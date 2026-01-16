# User Preference Model

Learn user preferences from selection behavior to generate better-fit cards. Users have different preferences—some want technical depth, others prefer conceptual over factual, procedural vs. declarative, etc. Build a user model that predicts preferred question types and uses that to influence generation.

## Core Loop

```
User selections → Preference signal → User model → Prompt modification → Better-fit cards
```

## Signal Sources

| Signal | Strength | When Captured |
|--------|----------|---------------|
| Which card selected (1 of 3) | Strong | Every generation |
| Which cards edited before sending | Medium | Reveals what's "almost right" |
| *What* was edited (Q vs A, length, wording) | Strong | Reveals specific friction |
| Cards deleted later during review | Delayed but strong | Reveals regret |
| Cards rated easy/hard during review | Delayed | Reveals difficulty calibration |
| Regenerate button usage | Medium | Current options missed the mark |

The richest signal is probably **selection + edit patterns**—you see both what they chose AND how they modified it.

## Preference Dimensions

Candidate axes to model:

- **Technical depth**: jargon-heavy ↔ plain language
- **Abstraction level**: conceptual principles ↔ concrete facts
- **Question type**: what/list ↔ why/how ↔ when/contrast
- **Card style**: Q&A ↔ cloze ↔ conceptual
- **Answer verbosity**: terse ↔ detailed
- **Example inclusion**: with concrete examples ↔ definition-only
- **Difficulty**: foundational ↔ assumes background knowledge
- **Standalone-ness**: needs source context ↔ fully independent

Note: Preferences might vary **by domain**. A user might want technical cards for programming topics but conceptual cards for history.

## Model Architecture Options

### Option A: Feature Extraction → Classifier

- Tag each generated card with features (technical_level, question_type, etc.)
- Track which features appear in selected vs. rejected cards
- Build a preference vector per user
- Convert to prompt instructions: "User prefers: technical language, why-questions, terse answers"

*Pro:* Interpretable, easy to convert to prompt
*Con:* Requires good feature taxonomy upfront

### Option B: Embedding-based

- Embed all cards user has selected
- Find clusters/patterns in embedding space
- Use selected cards as few-shot examples in prompt: "Generate cards similar to these examples the user has liked"

*Pro:* No manual feature engineering
*Con:* Harder to interpret, token-expensive to include examples

### Option C: LLM-as-Preference-Extractor

- Periodically feed selection history to an LLM
- Ask: "Based on these selections, describe this user's card preferences in 2-3 sentences"
- Cache that natural-language description
- Inject into generation prompt

*Pro:* Flexible, captures nuances you didn't anticipate
*Con:* Adds latency/cost, could be unstable

### Option D: Collaborative Filtering

- Find users with similar selection patterns
- "Users like you also preferred..."
- Use aggregate preferences to bootstrap new users

*Pro:* Solves cold-start
*Con:* Needs scale, might homogenize

## Prompt Integration

Whatever model you build, the interface to the generation LLM is one of:

```
# Option 1: Natural language preference description
"This user prefers cards that test understanding over recall,
uses technical terminology, and includes concrete examples.
They tend to reject list-based questions."

# Option 2: Parameter settings
user_preferences:
  technical_level: high
  question_type: [why, contrast, mechanism]
  verbosity: medium
  include_examples: true

# Option 3: Few-shot examples
"Here are 5 cards this user has selected in the past.
Generate new cards in a similar style: [examples]"
```

## Open Questions

- **Domain-specificity**: Should preferences be global or per-topic/deck?
- **Cold start**: What's the default experience before you have signal?
- **Explicit vs. implicit**: Should users also be able to *state* preferences directly? ("I prefer conceptual cards")
- **Feedback latency**: Selection is immediate, but review-time feedback (did this card actually help?) is delayed by days/weeks
- **Preference drift**: Do preferences change over time? Per subject?

---
**Category:** Card Quality & AI
