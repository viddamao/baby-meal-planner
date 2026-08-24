# Layla Meal Planner — V1 Plan

## Goal

Build a small, low-maintenance web app for planning meals for Layla.

The user should be able to:

1. Maintain a rough inventory of food available in the fridge/freezer.
2. Import/maintain historical meals.
3. Generate lunch + dinner for the current day.
4. See 1–2 reasonable substitutions for each meal.
5. Mark meals as eaten so history accumulates automatically.

The app should minimize bookkeeping. Exact quantities are intentionally NOT required.

---

# Product Principles

## 1. Low maintenance

The user should never need to maintain exact quantities.

Inventory should answer:

> "Do we have this food available?"

rather than:

> "How many grams/servings remain?"

Optional additional information:

- Plenty
- Some
- Use soon
- Raw
- Cooked

These should improve recommendations but never be required.

## 2. History is important

Historical meals should influence future recommendations.

The planner should avoid:

- Repeating the exact same meal combination too soon.
- Overusing the same protein.
- Overusing the same vegetable.
- Overusing the same fruit.

History will initially come from manually parsed notes provided by the user.

Do NOT build an AI/API parser in V1.

The user will provide Kaidi's historical notes in this chat and the structured data will be imported into the app.

## 3. Daily-first

Do NOT build weekly planning in V1.

The primary planner primitive is:

`generateDay(date)`

It should generate:

- Lunch
- Dinner

Weekly planning can be added later if useful.

---

# Meal Structure

Every meal should contain:

### Protein

1–2 items from:

- Beef
- Lamb
- Pork
- Chicken
- Salmon
- Shrimp
- Lobster
- Egg
- Tofu

The food database should be extensible.

### Vegetables

1–2 vegetables.

### Fruit

Exactly 1 fruit, initially a small amount after the main meal.

The V1 planner does NOT need to model serving sizes.

---

# Inventory

Inventory is divided into:

- Fridge
- Freezer

Each inventory item:

```ts
type InventoryItem = {
  id: string;
  foodId: string;
  location: "fridge" | "freezer";
  state?: "raw" | "cooked";
  availability?: "plenty" | "some" | "use-soon";
};
```
