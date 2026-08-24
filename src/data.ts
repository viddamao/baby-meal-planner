import type { AppData, Food, Meal } from "./types";

export const foods: Food[] = [
  { id: "chicken", name: "Chicken", category: "protein" },
  { id: "beef", name: "Beef", category: "protein" },
  { id: "pork", name: "Pork", category: "protein" },
  { id: "lamb", name: "Lamb", category: "protein" },
  { id: "salmon", name: "Salmon", category: "protein" },
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

const meal = (id: string, date: string, slot: "lunch"|"dinner", protein: string[], vegetables: string[], fruit: string[]): Meal =>
  { return { id, date, slot, protein, vegetables, fruit, eaten: true }; };

export const dummyHistory: Meal[] = [
  meal("h1","2026-08-17","lunch",["chicken"],["broccoli"],["strawberry"]),
  meal("h2","2026-08-17","dinner",["beef"],["celery"],["blueberry"]),
  meal("h3","2026-08-18","lunch",["salmon"],["bell-pepper"],["pear"]),
  meal("h4","2026-08-18","dinner",["egg","tofu"],["spinach"],["strawberry"]),
  meal("h5","2026-08-19","lunch",["pork"],["carrot"],["apple"]),
  meal("h6","2026-08-19","dinner",["chicken"],["sweet-potato","broccoli"],["blueberry"]),
  meal("h7","2026-08-20","lunch",["beef"],["spinach"],["pear"]),
  meal("h8","2026-08-20","dinner",["salmon"],["broccoli"],["strawberry"]),
  meal("h9","2026-08-21","lunch",["egg"],["carrot","celery"],["banana"]),
  meal("h10","2026-08-21","dinner",["lamb"],["bell-pepper"],["blueberry"]),
  meal("h11","2026-08-22","lunch",["chicken"],["spinach"],["pear"]),
  meal("h12","2026-08-22","dinner",["shrimp"],["broccoli"],["strawberry"])
];

export const dummyInventory = [
  { id:"i1", foodId:"chicken", location:"freezer" as const, state:"raw" as const, availability:"plenty" as const },
  { id:"i2", foodId:"beef", location:"freezer" as const, state:"raw" as const, availability:"some" as const },
  { id:"i3", foodId:"salmon", location:"freezer" as const, state:"raw" as const, availability:"some" as const },
  { id:"i4", foodId:"pork", location:"freezer" as const, state:"cooked" as const, availability:"use-soon" as const },
  { id:"i5", foodId:"shrimp", location:"freezer" as const, state:"raw" as const, availability:"some" as const },
  { id:"i6", foodId:"egg", location:"fridge" as const, availability:"plenty" as const },
  { id:"i7", foodId:"tofu", location:"fridge" as const, availability:"some" as const },
  { id:"i8", foodId:"broccoli", location:"fridge" as const, availability:"some" as const },
  { id:"i9", foodId:"celery", location:"fridge" as const, availability:"some" as const },
  { id:"i10", foodId:"spinach", location:"fridge" as const, availability:"some" as const },
  { id:"i11", foodId:"bell-pepper", location:"fridge" as const, availability:"plenty" as const },
  { id:"i12", foodId:"carrot", location:"fridge" as const, availability:"some" as const },
  { id:"i13", foodId:"blueberry", location:"fridge" as const, availability:"some" as const },
  { id:"i14", foodId:"strawberry", location:"fridge" as const, availability:"some" as const },
  { id:"i15", foodId:"pear", location:"fridge" as const, availability:"plenty" as const },
  { id:"i16", foodId:"apple", location:"fridge" as const, availability:"some" as const }
];

export const initialData: AppData = {
  version: 1,
  foods,
  inventory: dummyInventory,
  history: dummyHistory,
  plans: []
};