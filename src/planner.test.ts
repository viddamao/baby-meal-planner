import { describe, expect, it } from "vitest";
import { generateDayOptions, proteinFamily, scoreMealForTest } from "./planner";
import type { AppData, Food, Meal } from "./types";

const foods: Food[] = [
  { id: "egg", name: "Egg", category: "protein" },
  { id: "chicken", name: "Chicken", category: "protein" },
  { id: "beef-short-rib", name: "Beef short rib", category: "protein" },
  { id: "beef-shank", name: "Beef shank", category: "protein" },
  { id: "king-salmon", name: "King salmon", category: "protein" },
  { id: "tofu", name: "Tofu", category: "protein" },
  { id: "spinach", name: "Spinach", category: "vegetable" },
  { id: "tomato", name: "Tomato", category: "vegetable" },
  { id: "broccoli", name: "Broccoli", category: "vegetable" },
  { id: "bell-pepper", name: "Bell pepper", category: "vegetable" },
  { id: "blueberry", name: "Blueberry", category: "fruit" },
  { id: "apple", name: "Apple", category: "fruit" },
  { id: "pear", name: "Pear", category: "fruit" }
];

const meal = (
  id: string,
  date: string,
  slot: Meal["slot"],
  protein: string[],
  vegetables: string[],
  fruit: string[]
): Meal => ({ id, date, slot, protein, vegetables, fruit, eaten: true });

function appData(history: Meal[] = [], inventoryFoodIds?: string[], useSoonFoodIds: string[] = []): AppData {
  const inventoryIds = inventoryFoodIds ?? foods.map(food => food.id);
  return {
    version: 1,
    foods,
    inventory: foods.filter(food => inventoryIds.includes(food.id)).map((food, index) => ({
      id: `i-${index}`,
      foodId: food.id,
      location: food.category === "fruit" || food.id === "egg" || food.id === "tofu" ? "fridge" : "freezer",
      availability: useSoonFoodIds.includes(food.id) ? "use-soon" : undefined
    })),
    history,
    plans: []
  };
}

const history = [
  meal("h1", "2026-08-10", "breakfast", ["egg"], ["spinach"], ["blueberry"]),
  meal("h2", "2026-08-11", "breakfast", ["egg"], ["tomato"], ["blueberry"]),
  meal("h3", "2026-08-12", "lunch", ["chicken"], ["broccoli"], ["apple"]),
  meal("h4", "2026-08-13", "dinner", ["beef-short-rib"], ["bell-pepper"], ["pear"]),
  meal("h5", "2026-08-14", "lunch", ["king-salmon"], ["tomato"], ["apple"]),
  meal("h6", "2026-08-15", "dinner", ["beef-shank"], ["broccoli"], ["pear"])
];

describe("meal planner scoring", () => {
  it("recommended breakfast/lunch/dinner avoid repeating the same vegetable pair when inventory permits", () => {
    const options = generateDayOptions(appData(history), "2026-08-24", 3);
    expect(options).toHaveLength(3);

    const vegetablePairs = options.map(slotOptions => slotOptions[0].vegetables.slice().sort().join("|"));
    expect(new Set(vegetablePairs).size).toBe(vegetablePairs.length);
  });

  it("keeps recommended protein-family diversity when inventory permits", () => {
    const options = generateDayOptions(appData(history), "2026-08-24", 3);
    const recommendedFamilies = options.map(slotOptions => proteinFamily(slotOptions[0].protein[0]));
    expect(new Set(recommendedFamilies).size).toBe(recommendedFamilies.length);
  });

  it("normalizes beef cuts into the same family", () => {
    expect(proteinFamily("beef-short-rib")).toBe("beef");
    expect(proteinFamily("beef-shank")).toBe("beef");
    expect(proteinFamily("beef-brisket")).toBe("beef");
    expect(proteinFamily("beef-shaved-roll")).toBe("beef");
    expect(proteinFamily("pork-belly")).toBe("pork");
    expect(proteinFamily("king-salmon")).toBe("salmon");
    expect(proteinFamily("spot-shrimp")).toBe("shrimp");
    expect(proteinFamily("dungeness-crab")).toBe("crab");
  });

  it("prefers distinct protein families across three options within a slot", () => {
    const [breakfastOptions] = generateDayOptions(appData(history), "2026-08-24", 3);
    const families = breakfastOptions.map(option => proteinFamily(option.protein[0]));
    expect(new Set(families).size).toBeGreaterThanOrEqual(2);
  });

  it("allows vegetable repetition when inventory is limited", () => {
    const data = appData(history, ["egg", "chicken", "beef-short-rib", "spinach", "blueberry", "apple", "pear"]);
    const options = generateDayOptions(data, "2026-08-24", 3);
    expect(options).toHaveLength(3);
    expect(options.every(slotOptions => slotOptions[0].vegetables.includes("spinach"))).toBe(true);
  });

  it("does not generate exact duplicate recommended meals", () => {
    const options = generateDayOptions(appData(history), "2026-08-24", 3);
    const signatures = options.map(slotOptions => [
      ...slotOptions[0].protein.map(id => `p:${id}`),
      ...slotOptions[0].vegetables.map(id => `v:${id}`),
      ...slotOptions[0].fruit.map(id => `f:${id}`)
    ].sort().join("|"));

    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("does not let fruit repetition alone overpower a substantially better meal", () => {
    const data = appData([
      meal("recent-fruit", "2026-08-23", "breakfast", ["tofu"], ["tomato"], ["blueberry"]),
      meal("pair-1", "2026-08-10", "breakfast", ["egg"], ["spinach"], ["apple"]),
      meal("pair-2", "2026-08-11", "breakfast", ["egg"], ["spinach"], ["pear"])
    ]);
    const strong = meal("strong", "2026-08-24", "breakfast", ["egg"], ["spinach"], ["blueberry"]);
    const weak = meal("weak", "2026-08-24", "breakfast", ["tofu"], ["bell-pepper"], ["pear"]);

    expect(scoreMealForTest(strong, data, "2026-08-24", "breakfast")).toBeGreaterThan(
      scoreMealForTest(weak, data, "2026-08-24", "breakfast")
    );
  });

  it("lets a historically plausible protein and vegetable pairing beat an otherwise equal unseen pairing", () => {
    const data = appData([
      meal("pair-1", "2026-08-10", "lunch", ["chicken"], ["broccoli"], ["apple"]),
      meal("pair-2", "2026-08-11", "lunch", ["chicken"], ["broccoli"], ["pear"])
    ]);
    const seenPair = meal("seen", "2026-08-24", "lunch", ["chicken"], ["broccoli"], ["blueberry"]);
    const unseenPair = meal("unseen", "2026-08-24", "lunch", ["chicken"], ["bell-pepper"], ["blueberry"]);

    expect(scoreMealForTest(seenPair, data, "2026-08-24", "lunch")).toBeGreaterThan(
      scoreMealForTest(unseenPair, data, "2026-08-24", "lunch")
    );
  });

  it("ignores same-date imported history when scoring a generated day", () => {
    const withSameDateHistory = appData([
      meal("same-date", "2026-08-24", "breakfast", ["egg"], ["spinach"], ["blueberry"])
    ]);
    const withoutHistory = appData([]);
    const candidate = meal("candidate", "2026-08-24", "breakfast", ["egg"], ["spinach"], ["blueberry"]);

    expect(scoreMealForTest(candidate, withSameDateHistory, "2026-08-24", "breakfast")).toBe(
      scoreMealForTest(candidate, withoutHistory, "2026-08-24", "breakfast")
    );
  });

  it("uses the most recent matching history date even when history is out of order", () => {
    const candidate = meal("candidate", "2026-08-24", "breakfast", ["egg"], ["spinach"], ["blueberry"]);
    const ordered = appData([
      meal("old", "2026-08-10", "breakfast", ["egg"], ["spinach"], ["blueberry"]),
      meal("recent", "2026-08-23", "breakfast", ["egg"], ["spinach"], ["blueberry"])
    ]);
    const reversed = appData([
      meal("recent", "2026-08-23", "breakfast", ["egg"], ["spinach"], ["blueberry"]),
      meal("old", "2026-08-10", "breakfast", ["egg"], ["spinach"], ["blueberry"])
    ]);

    expect(scoreMealForTest(candidate, ordered, "2026-08-24", "breakfast")).toBe(
      scoreMealForTest(candidate, reversed, "2026-08-24", "breakfast")
    );
  });

  it("keeps tofu from dominating multiple recommended slots just because it is underrepresented", () => {
    const options = generateDayOptions(appData(history), "2026-08-24", 3);
    const tofuOnlyCount = options.filter(slotOptions => slotOptions[0].protein.length === 1 && slotOptions[0].protein[0] === "tofu").length;
    expect(tofuOnlyCount).toBeLessThanOrEqual(1);
  });

  it("lets use-soon override a modest daily diversity penalty", () => {
    const data = appData([], undefined, ["beef-shank"]);
    const selectedBreakfast = meal("breakfast", "2026-08-24", "breakfast", ["egg"], ["spinach"], ["blueberry"]);
    const useSoonBeef = meal("use-soon-beef", "2026-08-24", "lunch", ["beef-shank"], ["spinach"], ["blueberry"]);
    const ordinaryChicken = meal("ordinary-chicken", "2026-08-24", "lunch", ["chicken"], ["broccoli"], ["apple"]);

    expect(scoreMealForTest(useSoonBeef, data, "2026-08-24", "lunch", [selectedBreakfast])).toBeGreaterThan(
      scoreMealForTest(ordinaryChicken, data, "2026-08-24", "lunch", [selectedBreakfast])
    );
  });
});
