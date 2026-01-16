# Card Quality Feedback Loop

A systematic process for documenting problematic cards, analyzing their deficiencies, and using that analysis to iteratively improve the generation prompt.

## The Problem

Generated cards often have subtle quality issues that aren't obvious until review time—list-recall questions with unclear success criteria, surface-level prompts that test facts over understanding, buried key insights, decorative graphics, examples disconnected from principles.

## Proposed Approach

1. **Document problem cards** in `cardProblems.md` with the original card, categorized deficiencies, and reconstructed alternatives
2. **Extract principles** from each analysis (e.g., "test understanding not recall," "one concept per card," "connect examples to principles")
3. **Feed principles back** into the generation prompt as explicit instructions
4. **Track improvement** by comparing new generations against documented failure modes

## Problem Categories Identified So Far

- List-recall questions (unclear success criteria, no discriminative value)
- Surface-level prompts (facts over understanding)
- Atomicity violations (too many concepts per card)
- Buried insights (key principle tacked on as afterthought)
- Disconnected examples (applications listed without explaining *why*)
- Missing contrast (no boundaries on when NOT to use something)
- Decorative graphics (add cognitive load without aiding understanding)

## Better Card Archetypes to Guide Generation

- Core insight cards (establish the problem being solved)
- Mental model cards (sticky analogies)
- Discriminating questions (test when/why, not just what)
- Concrete mechanism cards (one deep example over five shallow)
- Boundary condition cards (limitations and alternatives)
- Generative principle cards (transferable reasoning to novel situations)

---
**Category:** Card Quality & AI
