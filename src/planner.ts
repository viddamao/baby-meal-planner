import type { AppData, Food, Meal } from "./types";

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
};

function normalizeMeal(raw: Partial<Meal>): Meal | null {
  const protein = toArray(raw.protein);
  const vegetables = toArray(raw.vegetables);
  const fruit = toArray(raw.fruit);
  if (!raw.date || !raw.slot || protein.length < 1 || vegetables.length < 1 || fruit.length < 1) {
    return null;
  }
  return {
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    date: raw.date,
    slot: raw.slot,
    protein: protein.slice(0, 2),
    vegetables: vegetables.slice(0, 2),
    fruit: fruit.slice(0, 1),
    eaten: raw.eaten
  };
}

function validHistory(data: AppData): Meal[] {
  return data.history.map(normalizeMeal).filter((m): m is Meal => m !== null);
}

const comboKey = (m: Pick<Meal, "protein" | "vegetables" | "fruit">) =>
  [...m.protein, ...m.vegetables, ...m.fruit].sort().join("|");

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateString: string, offset: number) {
  const d = new Date(`${dateString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

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

function overlaps(a: string[], b: string[]) {
  return a.some(x => b.includes(x));
}

function score(meal: Meal, data: AppData, selected: Meal[]) {
  const recent = validHistory(data).slice(-20);
  let s = 0;
  const inv = new Set(data.inventory.map(i => i.foodId));

  [...meal.protein, ...meal.vegetables, ...meal.fruit].forEach(id => {
    if (inv.has(id)) s += 8;
  });

  if (meal.protein.some(p =>
    data.inventory.some(i => i.foodId === p && i.availability === "use-soon")
  )) {
    s += 10;
  }

  if (recent.some(m => comboKey(m) === comboKey(meal))) s -= 35;

  const recentIds = recent.slice(-7).flatMap(m => [
    ...m.protein, ...m.vegetables, ...m.fruit
  ]);

  [...meal.protein, ...meal.vegetables, ...meal.fruit].forEach(id => {
    if (recentIds.includes(id)) s -= 1.5;
  });

  selected.forEach(m => {
    if (overlaps(m.protein, meal.protein)) s -= 3;
    if (overlaps(m.vegetables, meal.vegetables)) s -= 1;
    if (overlaps(m.fruit, meal.fruit)) s -= 1;
  });

  return s;
}

function candidates(data: AppData): Meal[] {
  const available = (category: Food["category"]) =>
    data.foods
      .filter(food =>
        food.category === category &&
        data.inventory.some(item => item.foodId === food.id)
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

export function generateDay(data: AppData, date: string): Meal[] {
  const pool = candidates(data);
  const chosen: Meal[] = [];

  for (let i = 0; i < 2 && pool.length > 0; i++) {
    const slot = i === 0 ? "lunch" : "dinner";

    const ranked = pool
      .filter(candidate => !chosen.some(c => comboKey(c) === comboKey(candidate)))
      .map((candidate): Meal => ({
        ...candidate,
        date,
        slot,
        id: `${date}-${slot}`
      }))
      .sort((a, b) => score(b, data, chosen) - score(a, data, chosen));

    if (ranked.length === 0) break;
    chosen.push(ranked[0]);
  }

  return chosen;
}

export function generateWeek(data: AppData, weekStart = startOfWeek()): Meal[] {
  const chosen: Meal[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dayMeals = generateDay(
      { ...data, history: [...data.history, ...chosen] },
      date
    );
    chosen.push(...dayMeals);
  }

  return chosen;
}

export function substitutions(meal: Meal, data: AppData, plan: Meal[]): Meal[] {
  const pool = candidates(data).filter(c => comboKey(c) !== comboKey(meal));

  return pool
    .map((c): Meal => ({
      id: meal.id,
      date: meal.date,
      slot: meal.slot as "lunch" | "dinner",
      protein: c.protein,
      vegetables: c.vegetables,
      fruit: c.fruit
    }))
    .sort((a: Meal, b: Meal) => score(b, data, plan) - score(a, data, plan))
    .slice(0, 2);
}
