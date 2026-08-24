import { openDB } from "idb";
import type { AppData } from "./types";
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
  if (data && data.version === 1) return data as AppData;

  const seed = structuredClone(initialData);
  await db.put(STORE, seed, "data");
  return seed;
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
