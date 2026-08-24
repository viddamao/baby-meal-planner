# Layla Meal Planner — V1 Scoring

Use the historical meal data as a **soft preference signal**, not a hard rule.

The goal is not maximum novelty. The goal is: **reasonable meals using what we have, with sensible variety and less annoying repetition.**

## 1. Hard constraints

A candidate meal is eligible only if:

- It has 1–2 proteins.
- It has 1–2 vegetables.
- It has 1 fruit.
- Every selected ingredient is currently in inventory.

Do not reject a meal because the same ingredient appeared in history. History only changes its score.

## 2. Base score

Start every candidate at `0`.

### Inventory

- ingredient available: `+6` each
- ingredient marked `use-soon`: additional `+10`
- cooked food marked `use-soon`: additional `+2`

This should make the planner naturally use food that is about to become inconvenient to keep, without forcing it.

## 3. Recency penalty

For each ingredient, find the most recent historical meal containing it.

Use the number of **calendar days** since that meal, rather than number of meals.

For each occurrence:

| Days since last use | Penalty |
|---:|---:|
| 0–1 | -8 |
| 2 | -5 |
| 3 | -3 |
| 4–5 | -1 |
| 6+ | 0 |

Apply a lower-weight version to breakfast history when generating lunch/dinner:

```ts
historyWeight = meal.slot === targetSlot ? 1.0 : 0.35
```

This prevents something like egg-heavy breakfasts from making egg impossible for dinner.

## 4. Frequency penalty

Recency alone is not enough. Egg appears very frequently in the real logs, for example, so the planner should gently favor less-used proteins even when egg was not eaten yesterday.

For the last 21 calendar days:

### Ingredient-level

```ts
penalty = max(0, count - 2) * 0.8
```

### Protein-family level

Use broad families such as:

- beef
- pork
- chicken
- seafood
- egg
- tofu

```ts
familyPenalty = max(0, familyCount - 3) * 0.7
```

Apply `-familyPenalty` to protein ingredients.

This means beef short rib and beef shank are different ingredients, but still contribute to the broader beef repetition signal.

## 5. Variety bonus

If an ingredient has not appeared for at least 7 days:

```ts
+2
```

Cap the total variety bonus at `+6` per meal so novelty doesn't overwhelm practicality.

## 6. Exact combination penalty

If the exact combination of protein + vegetables + fruit appeared recently:

- last 7 days: `-30`
- 8–21 days: `-15`

After 21 days, no exact-combination penalty.

Normalize the combination by sorting each component before comparison so ordering does not matter.

## 7. Within-day diversity

Lunch and dinner should not feel like the same meal.

For the already-selected meal today:

- same protein: `-6` per overlap
- same vegetable: `-2` per overlap
- same fruit: `-1.5` per overlap

Do not prohibit overlap completely. If inventory is limited, repetition is fine.

## 8. Protein diversity

When two candidates are otherwise similar, prefer a different protein family from the previous meal.

Optional small bonus:

```ts
if (differentProteinFamily) +2
```

Do not use a large bonus here; inventory and freshness should matter more.

## 9. Substitution scoring

Use the same base scoring function, but add a penalty for being too similar to the original meal:

- exact same protein: `-7`
- same protein family: `-3`
- same vegetable: `-1.5`
- same fruit: `-1`

Return the top 2 distinct candidates.

A substitution should feel like a genuinely useful alternative, not merely the same meal with one ingredient shuffled.

## 10. Important behavior from the real history

The July/August notes show that the family already has a fairly broad recurring vocabulary: beef, pork, chicken, salmon, shrimp, crab, lobster, egg and tofu, plus recurring vegetables such as tomato, carrot, bell pepper, zucchini, corn, bok choy, broccoli, spinach and cauliflower.

Do **not** optimize for novelty at the expense of meals that resemble what the family actually eats.

The history is evidence of preference, not a list of meals to avoid.

## 11. Avoid these mistakes

Do not:

- randomly choose meals
- penalize an ingredient just because it appeared once several weeks ago
- treat breakfast and dinner as equally important for repetition
- prohibit repeated ingredients
- require exact inventory quantities
- use an LLM/API for scoring
- add complicated optimization/constraint-solving infrastructure

## 12. Suggested implementation shape

Keep scoring pure and testable:

```ts
scoreMeal(candidate, {
  inventory,
  history,
  selectedToday,
  targetSlot,
  date,
})
```

Then:

```ts
const ranked = candidates
  .map(candidate => ({
    candidate,
    score: scoreMeal(candidate, context),
  }))
  .sort((a, b) => b.score - a.score);
```

Keep candidate generation and scoring separate.

That will make it easy to tune weights after we try the planner against the real history.
