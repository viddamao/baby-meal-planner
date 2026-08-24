export type Category = "protein" | "vegetable" | "fruit";
export type Location = "fridge" | "freezer";
export type FoodState = "raw" | "cooked";
export type Availability = "plenty" | "some" | "use-soon";
export type MealSlot = "breakfast" | "lunch" | "dinner";

export type Food = {
  id: string;
  name: string;
  category: Category;
};

export type InventoryItem = {
  id: string;
  foodId: string;
  location: Location;
  state?: FoodState;
  availability?: Availability;
};

export type Meal = {
  id: string;
  date: string;
  slot: MealSlot;
  protein: string[];
  vegetables: string[];
  fruit: string[];
  extras?: string[];
  notes?: string;
  source?: string;
  eaten?: boolean;
};

export type MealPlan = {
  weekStart: string;
  meals: Meal[];
};

export type AppData = {
  version: 1;
  foods: Food[];
  inventory: InventoryItem[];
  history: Meal[];
  plans: MealPlan[];
};
