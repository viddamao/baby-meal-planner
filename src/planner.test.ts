import { describe, expect, it } from "vitest";
import { generateDay } from "./planner";
import { initialData } from "./data";

describe("meal planner", () => {
  it("generates two valid meals for a day", () => {
    const plan = generateDay(initialData, "2026-08-24");
    expect(plan.length).toBe(2);

    expect(plan[0].slot).toBe("lunch");
    expect(plan[1].slot).toBe("dinner");

    for (const meal of plan) {
      expect(meal.protein.length).toBeGreaterThanOrEqual(1);
      expect(meal.protein.length).toBeLessThanOrEqual(2);
      expect(meal.vegetables.length).toBeGreaterThanOrEqual(1);
      expect(meal.vegetables.length).toBeLessThanOrEqual(2);
      expect(meal.fruit.length).toBe(1);
      expect(Array.isArray(meal.protein)).toBe(true);
      expect(Array.isArray(meal.vegetables)).toBe(true);
      expect(Array.isArray(meal.fruit)).toBe(true);
    }
  });
});
