# Layla Meal Planner

A backend-free prototype for planning Layla's meals from rough household inventory and historical meals.

## V1

- React + TypeScript + Vite
- IndexedDB local persistence
- Rough fridge/freezer inventory
- Simple / Detailed inventory toggle
- Historical meal list
- Deterministic weekly planner
- Per-meal substitutions
- JSON export/import
- No AI API, no backend

## Run locally

```bash
npm install
npm run dev
```

For GitHub Pages, build with `npm run build` and publish `dist/`.

## 0.1.2

Fixed candidate generation so fruit is always represented as a one-item array, matching the Meal type.

## Validation

```bash
npm run typecheck
npm run build
npm test
```
