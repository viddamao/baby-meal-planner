import { openDB } from "idb";
import type { AppData, Food, Meal } from "./types";
import { initialData } from "./data";

const DB_NAME = "layla-meal-planner";
const STORE = "app";

export async function loadData(): Promise<AppData> {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    }
  });

  const data = await db.get(STORE, "data");
  if (data && data.version === 1) {
    const merged = mergeSeedData(data as AppData);
    await db.put(STORE, merged, "data");
    return merged;
  }

  const seed = structuredClone(initialData);
  await db.put(STORE, seed, "data");
  return seed;
}

function mergeSeedData(data: AppData): AppData {
  return {
    ...data,
    foods: mergeById(data.foods, initialData.foods),
    history: mergeById(data.history.filter(meal => !/^h\d+$/.test(meal.id)), initialData.history)
  };
}

function mergeById<T extends Food | Meal>(current: T[], seed: T[]): T[] {
  const byId = new Map(current.map(item => [item.id, item]));
  for (const item of seed) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

export async function saveData(data: AppData) {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    }
  });
  await db.put(STORE, data, "data");
}

export function downloadJson(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "layla-meal-planner.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
