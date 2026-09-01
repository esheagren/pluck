# Spaced Repetition Data Model

**Purpose**: This document describes the data model for Pluckk's spaced repetition system, designed for discussion with a learning scientist.

## Quick Links

- **SQL Migration**: `packages/api/migrations/002_spaced_repetition.sql`
- **DBML Diagram**: `docs/spaced-repetition-schema.dbml` (paste into [dbdiagram.io](https://dbdiagram.io))

---

## Design Principles

1. **Algorithm Transparency**: Every parameter is explicit and auditable
2. **Complete Audit Trail**: Every review is logged with before/after state
3. **User Control**: Configurable rating systems, retention targets, and limits
4. **Numeric Calibration**: First-class support for interval estimation training
5. **Multi-Algorithm**: Support for SM-2, FSRS, and custom algorithms

---

## Table Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA MODEL                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌──────────────────────┐     ┌────────────────────┐   │
│  │   users     │────▶│  user_study_settings │────▶│ algorithm_configs  │   │
│  └─────────────┘     │  (preferences)       │     │ (algorithm params) │   │
│        │             └──────────────────────┘     └────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────┐     ┌──────────────────────┐     ┌────────────────────┐   │
│  │   cards     │────▶│  card_review_state   │────▶│   review_logs      │   │
│  │ (content)   │     │  (per-user progress) │     │ (audit trail)      │   │
│  └─────────────┘     └──────────────────────┘     └────────────────────┘   │
│                                                                             │
│                      ┌──────────────────────┐     ┌────────────────────┐   │
│                      │   study_sessions     │     │ user_calibration_  │   │
│                      │   (analytics)        │     │ stats (numeric)    │   │
│                      └──────────────────────┘     └────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Tables

### 1. `cards` (Content)

Stores the flashcard content. Extended to support numeric answers.

| Field | Type | Description |
|-------|------|-------------|
| `question` | text | Card front |
| `answer` | text | Card back (display) |
| `answer_type` | enum | `text`, `numeric`, `numeric_range` |
| `numeric_answer` | decimal | Exact answer (for `numeric` type) |
| `numeric_lower/upper` | decimal | Bounds (for `numeric_range` type) |
| `numeric_unit` | text | Display unit (kg, years, $, etc.) |
| `tags` | text[] | For topic-based interleaving |

**Key Design Decision**: Content is separate from review state, allowing multiple users to share cards while maintaining independent progress.

---

### 2. `card_review_state` (Per-User Progress)

Tracks where each user is in the learning process for each card.

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `new`, `learning`, `review`, `relearning`, `suspended` |
| `due_at` | timestamp | When card becomes reviewable |
| `interval_days` | decimal | Current interval (fractional for minutes) |
| `ease_factor` | decimal | SM-2 ease (typically 1.3 - 3.0) |
| `stability` | decimal | FSRS stability parameter |
| `step_index` | integer | Position in learning steps |
| `lapse_count` | integer | Times forgotten after graduating |
| `calibration_score` | decimal | Hit rate for numeric reviews |

**Interval Representation**: Days as decimal allows unified handling:
- `0.000694` = 1 minute
- `0.00694` = 10 minutes
- `0.0417` = 1 hour
- `1.0` = 1 day

---

### 3. `review_logs` (Audit Trail)

Every review is logged with complete state transitions.

| Field | Type | Description |
|-------|------|-------------|
| `review_mode` | enum | `standard` or `numeric_interval` |
| `rating` | enum | `again`, `hard`, `good`, `easy` |
| `response_time_ms` | integer | Time to respond |
| **Numeric Fields** | | |
| `response_lower/upper` | decimal | User's confidence interval |
| `contained_answer` | boolean | Was answer in interval? |
| `relative_width` | decimal | Width relative to answer magnitude |
| `derived_rating` | enum | How numeric result mapped to rating |
| **State Snapshots** | | |
| `previous_*` | various | State before review |
| `new_*` | various | State after review |
| `algorithm_params` | jsonb | Parameters used for this review |
| `scoring_details` | jsonb | Intermediate calculations |

**Why Log Everything?**: This enables:
- Retroactive algorithm analysis
- A/B testing different parameters
- Training personalized models
- Debugging unexpected behavior

---

### 4. `user_study_settings` (User Preferences)

Per-user configuration for the study experience.

| Field | Default | Options |
|-------|---------|---------|
| `rating_system` | `4-button` | `4-button`, `3-button`, `2-button` |
| `target_retention` | `0.90` | 0.70 - 0.99 |
| `new_cards_per_day` | `20` | Any integer, null = unlimited |
| `interleave_topics` | `true` | Mix cards from different topics |
| `algorithm_type` | `sm2` | `sm2`, `fsrs`, `custom` |
| `confidence_level` | `0.95` | For numeric cards: 0.50, 0.80, 0.90, 0.95, 0.99 |
| `numeric_scoring_mode` | `width_adjusted` | See below |

**Numeric Scoring Modes**:
- `binary`: Just right/wrong (answer in interval or not)
- `width_adjusted`: Reward tighter correct intervals
- `log_score`: Proper scoring rule for calibration training

---

### 5. `algorithm_configs` (Algorithm Parameters)

Fully exposed algorithm parameters. Can be system defaults or user-customized.

#### SM-2 Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `initial_ease` | 2.5 | Starting ease factor |
| `minimum_ease` | 1.3 | Floor for ease |
| `ease_bonus_easy` | 0.15 | Added to ease on "easy" |
| `ease_penalty_again` | 0.20 | Subtracted on "again" |
| `learning_steps` | [1m, 10m, 90m] | Steps before graduating |
| `graduating_interval` | 1 day | First review interval |
| `lapse_interval_percentage` | 0% | % of interval kept on lapse |
| `leech_threshold` | 8 | Lapses before flagging |
| `max_interval_days` | 365 | Hard cap |

#### FSRS Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fsrs_weights` | [17 floats] | Optimized model weights |
| `fsrs_desired_retention` | 0.90 | Target retention rate |

#### Numeric Conversion Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `numeric_wide_interval_threshold` | 2.0 | Relative width for "hard" |
| `numeric_tight_interval_threshold` | 0.3 | Relative width for "easy" |
| `numeric_miss_rating` | `again` | Rating when missing interval |

---

### 6. `user_calibration_stats` (Numeric Analytics)

Aggregated calibration statistics for numeric card performance.

```json
{
  "total_numeric_reviews": 150,
  "total_hits": 140,
  "overall_hit_rate": 0.93,
  "stats_by_confidence": {
    "0.95": { "reviews": 100, "hits": 92, "rate": 0.92 },
    "0.90": { "reviews": 50, "hits": 48, "rate": 0.96 }
  },
  "stats_by_magnitude": {
    "0-10": { "reviews": 30, "hits": 28 },
    "10-100": { "reviews": 50, "hits": 47 },
    "100-1000": { "reviews": 70, "hits": 65 }
  }
}
```

**Purpose**: Detect if user is well-calibrated (hit rate should match confidence level), and identify patterns (e.g., overconfident on large numbers).

---

## Rating Systems

### 4-Button (Default)
| Button | Meaning | Effect |
|--------|---------|--------|
| Again | Complete failure | Reset to learning, ease penalty |
| Hard | Difficult recall | Short interval, small ease penalty |
| Good | Successful recall | Normal interval increase |
| Easy | Effortless recall | Large interval increase, ease bonus |

### 3-Button (Simpler)
| Button | Maps To |
|--------|---------|
| Forgot | Again |
| Hard | Hard |
| Easy | Good (with slight easy bonus) |

### 2-Button (Simplest)
| Button | Maps To |
|--------|---------|
| Forgot | Again |
| Remembered | Good |

---

## Numeric → Rating Conversion

When a user provides a confidence interval for a numeric answer:

```
Let:
  answer = correct numeric answer
  lower, upper = user's interval bounds
  width = upper - lower
  relative_width = width / |answer|

If answer NOT IN [lower, upper]:
    rating = numeric_miss_rating (default: 'again')

Else if relative_width > wide_threshold (2.0):
    rating = 'hard'    # Got it but with huge uncertainty

Else if relative_width > tight_threshold (0.3):
    rating = 'good'    # Reasonable interval

Else:
    rating = 'easy'    # Tight interval, confident knowledge
```

This derived rating then feeds into the normal SR algorithm.

---

## Open Questions for Discussion

1. **Calibration vs. Memorization**: Should numeric cards ever "graduate" to standard reveal-and-rate mode once well-memorized?

2. **Adaptive Confidence Levels**: Should the system suggest different confidence levels based on observed calibration?

3. **Response Time Signal**: Should slow-but-correct responses be treated differently than fast-correct?

4. **Personalized FSRS**: Should we train per-user FSRS weights after enough data accumulates?

5. **Interleaving Strategy**: Random shuffle vs. spaced by topic vs. difficulty-based ordering?

6. **Leech Handling**: What should happen when a card is flagged as a leech? Options:
   - Suspend and notify user
   - Automatically simplify/break down
   - Increase learning steps

---

## Sample Queries

### Get due cards for review
```sql
SELECT * FROM get_due_cards(
  p_user_id := 'user-uuid',
  p_limit := 50,
  p_include_new := true,
  p_new_limit := 10
);
```

### User's recent performance
```sql
SELECT * FROM user_daily_review_summary
WHERE user_id = 'user-uuid'
ORDER BY review_date DESC
LIMIT 7;
```

### Hardest cards (leeches)
```sql
SELECT * FROM card_difficulty_ranking
WHERE user_id = 'user-uuid'
  AND lapse_rate > 0.3
ORDER BY lapse_count DESC;
```

---

## Next Steps

1. Review data model with learning scientist
2. Decide on algorithm choice (SM-2 vs FSRS vs hybrid)
3. Define numeric scoring rules
4. Design UX for numeric confidence intervals
5. Plan analytics dashboard
