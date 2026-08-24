import type { AppData, Food, Meal, MealSlot } from "./types";

type ScoreContext = {
  data: AppData;
  facts: ScoreFacts;
  selectedToday: Meal[];
  targetSlot: MealSlot;
  date: string;
};

type ScoreFacts = {
  inventory: Map<string, AppData["inventory"][number]>;
  recentUse: Map<string, Meal>;
  recentUseDays: Map<string, number>;
  ingredientCounts: Map<string, number>;
  familyCounts: Map<string, number>;
  exactComboDays: Map<string, number>;
  slotFamilyCounts: Map<MealSlot, Map<string, number>>;
  observedProteinVegetablePairs: Set<string>;
};

type RankedMeal = {
  meal: Meal;
  score: number;
};

const DAY_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

const USE_SOON_SCORE = 10;
const COOKED_USE_SOON_SCORE = 2;
const SAME_SLOT_HISTORY_WEIGHT = 1;
const OTHER_SLOT_HISTORY_WEIGHT = 0.35;
const INGREDIENT_FREQUENCY_ALLOWED_COUNT = 2;
const INGREDIENT_FREQUENCY_PENALTY = 0.8;
const FAMILY_FREQUENCY_ALLOWED_COUNT = 3;
const FAMILY_FREQUENCY_PENALTY = 0.7;
const RECENT_EXACT_COMBO_PENALTY = 30;
const OLDER_EXACT_COMBO_PENALTY = 15;
const EXACT_COMBO_RECENT_DAYS = 7;
const EXACT_COMBO_WINDOW_DAYS = 21;
const DAILY_SAME_PROTEIN_FAMILY_PENALTY = 12;
const DAILY_SAME_EXACT_PROTEIN_PENALTY = 16;
const DAILY_REPEATED_VEGETABLE_PENALTY = 4;
const DAILY_SAME_VEGETABLE_PAIR_PENALTY = 10;
const DAILY_SAME_FRUIT_PENALTY = 2;
const DIFFERENT_PREVIOUS_FAMILY_BONUS = 2;
const SLOT_FAMILY_AFFINITY_BONUS = 3;
const SLOT_FAMILY_AFFINITY_MIN_COUNT = 2;
const OBSERVED_PAIR_BONUS = 2;
const OBSERVED_PAIR_BONUS_CAP = 4;
const NOT_EATEN_THREE_DAYS_BONUS = 3;
const NOT_EATEN_SEVEN_DAYS_EXTRA_BONUS = 1;
const TOFU_ONLY_PENALTY = 3;
const OPTION_SAME_FAMILY_PENALTY = 14;
const OPTION_SAME_EXACT_PROTEIN_PENALTY = 16;
const OPTION_SAME_VEGETABLE_PENALTY = 3;
const OPTION_SAME_FRUIT_PENALTY = 1;
const OPTION_SAME_FAMILY_VEGETABLE_PENALTY = 8;
const SUGGESTION_POOL_SIZE = 100;

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
};

function normalizeMeal(raw: Partial<Meal>): Meal | null {
  const protein = toArray(raw.protein);
  const vegetables = toArray(raw.vegetables);
  const fruit = toArray(raw.fruit);
  if (!raw.date || !raw.slot) return null;

  return {
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    date: raw.date,
    slot: raw.slot,
    protein,
    vegetables,
    fruit,
    extras: toArray(raw.extras),
    notes: raw.notes,
    source: raw.source,
    eaten: raw.eaten
  };
}

function validHistory(data: AppData): Meal[] {
  return data.history.map(normalizeMeal).filter((m): m is Meal => m !== null);
}

const comboKey = (m: Pick<Meal, "protein" | "vegetables" | "fruit">) =>
  [
    ...m.protein.map(id => `p:${id}`),
    ...m.vegetables.map(id => `v:${id}`),
    ...m.fruit.map(id => `f:${id}`)
  ].sort().join("|");

const vegetablePairKey = (m: Pick<Meal, "vegetables">) => m.vegetables.length >= 2 ? m.vegetables.slice().sort().join("|") : "";

function combinations<T>(items: T[], max = 2): T[][] {
  const out: T[][] = items.map(x => [x]);
  if (max > 1) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        out.push([items[i], items[j]]);
      }
    }
  }
  return out;
}

function ingredientIds(meal: Pick<Meal, "protein" | "vegetables" | "fruit">) {
  return [...meal.protein, ...meal.vegetables, ...meal.fruit];
}

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function historyWeight(historySlot: MealSlot, targetSlot: MealSlot) {
  return historySlot === targetSlot ? SAME_SLOT_HISTORY_WEIGHT : OTHER_SLOT_HISTORY_WEIGHT;
}

function recencyPenalty(days: number) {
  if (days <= 1) return -8;
  if (days === 2) return -5;
  if (days === 3) return -3;
  if (days <= 5) return -1;
  return 0;
}

export function proteinFamily(id: string) {
  if (id.startsWith("beef")) return "beef";
  if (id.startsWith("pork")) return "pork";
  if (id === "king-salmon" || id === "salmon") return "salmon";
  if (id === "shrimp" || id === "spot-shrimp") return "shrimp";
  if (id === "crab" || id === "dungeness-crab") return "crab";
  if (id === "lobster") return "lobster";
  if (["pompano", "tilapia", "sea-bass", "rockfish", "trout"].includes(id)) return "fish";
  if (id === "chicken") return "chicken";
  if (id === "egg") return "egg";
  if (id === "tofu") return "tofu";
  return id;
}

function pairKey(proteinId: string, vegetableId: string) {
  return `${proteinFamily(proteinId)}|${vegetableId}`;
}

function prepareScoreFacts(data: AppData, date: string): ScoreFacts {
  const history = validHistory(data).filter(m => m.date < date);
  const recentUse = new Map<string, Meal>();
  const recentUseDays = new Map<string, number>();
  const ingredientCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  const exactComboDays = new Map<string, number>();
  const slotFamilyCounts = new Map<MealSlot, Map<string, number>>();
  const observedProteinVegetablePairs = new Set<string>();

  for (const slot of DAY_SLOTS) {
    slotFamilyCounts.set(slot, new Map());
  }

  for (const historyMeal of history) {
    const days = daysBetween(historyMeal.date, date);
    const ids = ingredientIds(historyMeal);

    for (const id of ids) {
      if (!recentUseDays.has(id) || days < recentUseDays.get(id)!) {
        recentUse.set(id, historyMeal);
        recentUseDays.set(id, days);
      }
      if (days <= EXACT_COMBO_WINDOW_DAYS) ingredientCounts.set(id, (ingredientCounts.get(id) ?? 0) + 1);
    }

    for (const protein of historyMeal.protein) {
      const family = proteinFamily(protein);
      const slotCounts = slotFamilyCounts.get(historyMeal.slot);
      slotCounts?.set(family, (slotCounts.get(family) ?? 0) + 1);

      for (const vegetable of historyMeal.vegetables) {
        observedProteinVegetablePairs.add(pairKey(protein, vegetable));
      }

      if (days <= EXACT_COMBO_WINDOW_DAYS) {
        familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
      }
    }

    const key = comboKey(historyMeal);
    if (!exactComboDays.has(key) || days < exactComboDays.get(key)!) {
      exactComboDays.set(key, days);
    }
  }

  return {
    inventory: new Map(data.inventory.map(item => [item.foodId, item])),
    recentUse,
    recentUseDays,
    ingredientCounts,
    familyCounts,
    exactComboDays,
    slotFamilyCounts,
    observedProteinVegetablePairs
  };
}

function scoreMeal(meal: Meal, context: ScoreContext) {
  const { facts, selectedToday, targetSlot, date } = context;
  const ids = ingredientIds(meal);
  let score = 0;

  for (const id of ids) {
    const item = facts.inventory.get(id);
    if (!item) continue;
    if (item.availability === "use-soon") score += USE_SOON_SCORE;
    if (item.availability === "use-soon" && item.state === "cooked") score += COOKED_USE_SOON_SCORE;
  }

  for (const id of ids) {
    const recentUse = facts.recentUse.get(id);
    if (!recentUse) {
      score += NOT_EATEN_THREE_DAYS_BONUS + NOT_EATEN_SEVEN_DAYS_EXTRA_BONUS;
      continue;
    }

    const days = facts.recentUseDays.get(id) ?? daysBetween(recentUse.date, date);
    score += recencyPenalty(days) * historyWeight(recentUse.slot, targetSlot);
    if (days >= 3) score += NOT_EATEN_THREE_DAYS_BONUS;
    if (days >= 7) score += NOT_EATEN_SEVEN_DAYS_EXTRA_BONUS;
  }

  for (const id of ids) {
    score -= Math.max(0, (facts.ingredientCounts.get(id) ?? 0) - INGREDIENT_FREQUENCY_ALLOWED_COUNT) * INGREDIENT_FREQUENCY_PENALTY;
  }

  for (const id of meal.protein) {
    score -= Math.max(0, (facts.familyCounts.get(proteinFamily(id)) ?? 0) - FAMILY_FREQUENCY_ALLOWED_COUNT) * FAMILY_FREQUENCY_PENALTY;
  }

  const exactMatchDays = facts.exactComboDays.get(comboKey(meal));
  if (exactMatchDays !== undefined) {
    if (exactMatchDays <= EXACT_COMBO_RECENT_DAYS) score -= RECENT_EXACT_COMBO_PENALTY;
    else if (exactMatchDays <= EXACT_COMBO_WINDOW_DAYS) score -= OLDER_EXACT_COMBO_PENALTY;
  }

  for (const selected of selectedToday) {
    if (comboKey(meal) === comboKey(selected)) return Number.NEGATIVE_INFINITY;

    for (const id of meal.protein) {
      if (selected.protein.includes(id)) score -= DAILY_SAME_EXACT_PROTEIN_PENALTY;
      if (selected.protein.some(selectedId => proteinFamily(selectedId) === proteinFamily(id))) score -= DAILY_SAME_PROTEIN_FAMILY_PENALTY;
    }
    for (const id of meal.vegetables) {
      if (selected.vegetables.includes(id)) score -= DAILY_REPEATED_VEGETABLE_PENALTY;
    }
    if (vegetablePairKey(meal) && vegetablePairKey(meal) === vegetablePairKey(selected)) score -= DAILY_SAME_VEGETABLE_PAIR_PENALTY;
    for (const id of meal.fruit) {
      if (selected.fruit.includes(id)) score -= DAILY_SAME_FRUIT_PENALTY;
    }
  }

  const previousMeal = selectedToday.at(-1);
  if (previousMeal && !meal.protein.some(id => previousMeal.protein.some(prev => proteinFamily(prev) === proteinFamily(id)))) {
    score += DIFFERENT_PREVIOUS_FAMILY_BONUS;
  }

  for (const id of meal.protein) {
    const slotCount = facts.slotFamilyCounts.get(targetSlot)?.get(proteinFamily(id)) ?? 0;
    if (slotCount >= SLOT_FAMILY_AFFINITY_MIN_COUNT) score += SLOT_FAMILY_AFFINITY_BONUS;
  }

  let pairBonus = 0;
  for (const protein of meal.protein) {
    for (const vegetable of meal.vegetables) {
      if (facts.observedProteinVegetablePairs.has(pairKey(protein, vegetable))) {
        pairBonus += OBSERVED_PAIR_BONUS;
      }
    }
  }
  score += Math.min(OBSERVED_PAIR_BONUS_CAP, pairBonus);

  if (meal.protein.length === 1 && meal.protein[0] === "tofu") {
    score -= TOFU_ONLY_PENALTY;
  }

  return score;
}

function candidates(data: AppData): Meal[] {
  const inventoryIds = new Set(data.inventory.map(item => item.foodId));
  const available = (category: Food["category"]) =>
    data.foods
      .filter(food =>
        food.category === category &&
        inventoryIds.has(food.id)
      )
      .map(food => food.id);

  const proteins = available("protein");
  const vegetables = available("vegetable");
  const fruits = available("fruit");

  if (proteins.length === 0 || vegetables.length === 0 || fruits.length === 0) {
    return [];
  }

  const out: Meal[] = [];

  for (const protein of combinations(proteins)) {
    for (const vegetable of combinations(vegetables)) {
      for (const fruit of fruits) {
        out.push({
          id: "candidate",
          date: "",
          slot: "lunch",
          protein,
          vegetables: vegetable,
          fruit: [fruit]
        });
      }
    }
  }

  return out;
}

function rankedCandidates(data: AppData, date: string, targetSlot: MealSlot, selectedToday: Meal[]) {
  return rankedScoredCandidates(data, date, targetSlot, selectedToday).map(item => item.meal);
}

function rankedScoredCandidates(data: AppData, date: string, targetSlot: MealSlot, selectedToday: Meal[]): RankedMeal[] {
  const context = { data, facts: prepareScoreFacts(data, date), selectedToday, targetSlot, date };

  const ranked = candidates(data)
    .filter(candidate => !selectedToday.some(c => comboKey(c) === comboKey(candidate)))
    .map((candidate): Meal => ({
      ...candidate,
      date,
      slot: targetSlot,
      id: `${date}-${targetSlot}`
    }))
    .map(meal => ({ meal, score: scoreMeal(meal, context) }))
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)
    .map(item => item);

  return preferDistinctProteinFamilies(ranked, selectedToday);
}

export function generateDay(data: AppData, date: string): Meal[] {
  return generateDayOptions(data, date, 1).map(options => options[0]).filter((meal): meal is Meal => Boolean(meal));
}

export function generateDayOptions(data: AppData, date: string, count = 3): Meal[][] {
  const recommended: Meal[] = [];

  for (const slot of DAY_SLOTS) {
    const ranked = rankedCandidates(data, date, slot, recommended);
    if (ranked.length === 0) break;
    recommended.push(ranked[0]);
  }

  return recommended.map((recommendedMeal, slotIndex) => {
    const otherRecommended = recommended.filter((_, index) => index !== slotIndex);
    const alternatives = diversityRerank(
      rankedScoredCandidates(data, date, recommendedMeal.slot, otherRecommended).filter(candidate => comboKey(candidate.meal) !== comboKey(recommendedMeal)),
      Math.max(0, count - 1),
      recommendedMeal
    );

    return [recommendedMeal, ...alternatives].slice(0, count).map((meal, index) => ({
      ...meal,
      id: `${date}-${recommendedMeal.slot}-option-${index + 1}`
    }));
  });
}

export function mealSuggestions(meal: Meal, data: AppData, plan: Meal[], count = 3): Meal[] {
  const selectedWithoutMeal = plan.filter(m => m.id !== meal.id);
  return diversityRerank(
    rankedScoredCandidates(data, meal.date, meal.slot, selectedWithoutMeal).filter(c => comboKey(c.meal) !== comboKey(meal)),
    count,
    meal
  ).map((c, i) => ({
    ...c,
    id: `${meal.id}-suggestion-${i + 1}`
  }));
}

export function scoreMealForTest(meal: Meal, data: AppData, date: string, targetSlot: MealSlot, selectedToday: Meal[] = []) {
  return scoreMeal(meal, {
    data,
    facts: prepareScoreFacts(data, date),
    selectedToday,
    targetSlot,
    date
  });
}

function diversityRerank(ranked: RankedMeal[], count: number, reference?: Meal) {
  const selected: Meal[] = [];
  const pool = ranked.slice(0, SUGGESTION_POOL_SIZE);

  for (let i = 0; i < count && pool.length > 0; i++) {
    const comparisonMeals = [...selected, ...(reference ? [reference] : [])];
    const scored = pool
      .filter(candidate => !selected.some(chosen => comboKey(chosen) === comboKey(candidate.meal)))
      .map(candidate => ({
        candidate: candidate.meal,
        ranked: candidate,
        score: candidate.score - optionDiversityPenalty(candidate.meal, comparisonMeals)
      }))
      .sort((a, b) => b.score - a.score);

    const next = i === 0 && !reference ? pool[0]?.meal : scored[0]?.candidate;
    if (!next) break;
    selected.push(next);
    pool.splice(pool.findIndex(item => comboKey(item.meal) === comboKey(next)), 1);
  }

  return selected;
}

function optionDiversityPenalty(candidate: Meal, selected: Meal[]) {
  let penalty = 0;
  const candidateFamilies = candidate.protein.map(proteinFamily);

  for (const selectedMeal of selected) {
    if (comboKey(candidate) === comboKey(selectedMeal)) return Number.POSITIVE_INFINITY;

    const selectedFamilies = selectedMeal.protein.map(proteinFamily);
    const sharedFamily = candidateFamilies.some(family => selectedFamilies.includes(family));
    const sharedVegetables = candidate.vegetables.filter(id => selectedMeal.vegetables.includes(id));

    if (sharedFamily) penalty += OPTION_SAME_FAMILY_PENALTY;
    for (const id of candidate.protein) {
      if (selectedMeal.protein.includes(id)) penalty += OPTION_SAME_EXACT_PROTEIN_PENALTY;
    }
    penalty += sharedVegetables.length * OPTION_SAME_VEGETABLE_PENALTY;
    if (candidate.fruit.some(id => selectedMeal.fruit.includes(id))) penalty += OPTION_SAME_FRUIT_PENALTY;
    if (sharedFamily && sharedVegetables.length > 0) {
      penalty += OPTION_SAME_FAMILY_VEGETABLE_PENALTY;
    }
  }

  return penalty;
}

function preferDistinctProteinFamilies(ranked: RankedMeal[], selectedToday: Meal[]) {
  if (selectedToday.length === 0) return ranked;
  const firstDistinctIndex = ranked.findIndex(candidate => !sharesProteinFamily(candidate.meal, selectedToday));
  if (firstDistinctIndex <= 0) return ranked;

  const next = [...ranked];
  const [distinct] = next.splice(firstDistinctIndex, 1);
  return [distinct, ...next];
}

function sharesProteinFamily(candidate: Meal, meals: Meal[]) {
  const usedFamilies = new Set(meals.flatMap(meal => meal.protein.map(proteinFamily)));
  return candidate.protein.some(id => usedFamilies.has(proteinFamily(id)));
}
