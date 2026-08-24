import historyFile from "../data/history.json";
import type { AppData, Category, Food, Meal } from "./types";

type HistoryMeal = Omit<Meal, "notes" | "eaten"> & {
  extras?: string[];
  source?: string;
};

type HistoryFile = {
  meals: HistoryMeal[];
};

const seedFoods: Food[] = [
  { id: "chicken", name: "Chicken", category: "protein" },
  { id: "beef", name: "Beef", category: "protein" },
  { id: "pork", name: "Pork", category: "protein" },
  { id: "lamb", name: "Lamb", category: "protein" },
  { id: "king-salmon", name: "King salmon", category: "protein" },
  { id: "shrimp", name: "Shrimp", category: "protein" },
  { id: "egg", name: "Egg", category: "protein" },
  { id: "tofu", name: "Tofu", category: "protein" },
  { id: "broccoli", name: "Broccoli", category: "vegetable" },
  { id: "celery", name: "Celery", category: "vegetable" },
  { id: "carrot", name: "Carrot", category: "vegetable" },
  { id: "spinach", name: "Spinach", category: "vegetable" },
  { id: "bell-pepper", name: "Bell pepper", category: "vegetable" },
  { id: "sweet-potato", name: "Sweet potato", category: "vegetable" },
  { id: "blueberry", name: "Blueberry", category: "fruit" },
  { id: "strawberry", name: "Strawberry", category: "fruit" },
  { id: "pear", name: "Pear", category: "fruit" },
  { id: "apple", name: "Apple", category: "fruit" },
  { id: "banana", name: "Banana", category: "fruit" }
];

const categoryFields: Array<[Category, keyof Pick<Meal, "protein" | "vegetables" | "fruit">]> = [
  ["protein", "protein"],
  ["vegetable", "vegetables"],
  ["fruit", "fruit"]
];

const history = (historyFile as HistoryFile).meals.map((meal): Meal => ({
  ...meal,
  notes: meal.source,
  eaten: true
}));

export const foods: Food[] = mergeFoods(seedFoods, foodsFromHistory(history));

export const dummyInventory = [
  { id: "i1", foodId: "chicken", location: "freezer" as const, state: "raw" as const, availability: "plenty" as const },
  { id: "i2", foodId: "beef", location: "freezer" as const, state: "raw" as const, availability: "some" as const },
  { id: "i3", foodId: "king-salmon", location: "freezer" as const, state: "raw" as const, availability: "some" as const },
  { id: "i4", foodId: "pork", location: "freezer" as const, state: "cooked" as const, availability: "use-soon" as const },
  { id: "i5", foodId: "shrimp", location: "freezer" as const, state: "raw" as const, availability: "some" as const },
  { id: "i6", foodId: "egg", location: "fridge" as const, availability: "plenty" as const },
  { id: "i7", foodId: "tofu", location: "fridge" as const, availability: "some" as const },
  { id: "i8", foodId: "broccoli", location: "fridge" as const, availability: "some" as const },
  { id: "i9", foodId: "celery", location: "fridge" as const, availability: "some" as const },
  { id: "i10", foodId: "spinach", location: "fridge" as const, availability: "some" as const },
  { id: "i11", foodId: "bell-pepper", location: "fridge" as const, availability: "plenty" as const },
  { id: "i12", foodId: "carrot", location: "fridge" as const, availability: "some" as const },
  { id: "i13", foodId: "blueberry", location: "fridge" as const, availability: "some" as const },
  { id: "i14", foodId: "strawberry", location: "fridge" as const, availability: "some" as const },
  { id: "i15", foodId: "pear", location: "fridge" as const, availability: "plenty" as const },
  { id: "i16", foodId: "apple", location: "fridge" as const, availability: "some" as const }
];

export const initialData: AppData = {
  version: 1,
  foods,
  inventory: dummyInventory,
  history,
  plans: []
};

function foodsFromHistory(meals: Meal[]): Food[] {
  const byId = new Map<string, Food>();

  for (const meal of meals) {
    for (const [category, field] of categoryFields) {
      for (const id of meal[field]) {
        if (!byId.has(id)) byId.set(id, { id, name: labelFromId(id), category });
      }
    }
  }

  return [...byId.values()];
}

function mergeFoods(...groups: Food[][]): Food[] {
  const byId = new Map<string, Food>();
  for (const group of groups) {
    for (const food of group) {
      byId.set(food.id, byId.get(food.id) ?? food);
    }
  }
  return [...byId.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function labelFromId(id: string) {
  return id.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}
