# Percent Drills

Mental-math practice for percentages, built like a Kumon workbook: small steps, short timed
sessions every day, and you only move up once a step is both accurate and fast.

## How it works

- **Daily set:** 10 problems a day. Finishing it keeps your streak going.
- **Endless:** a new problem every time you answer one, for as long as you like.
- **Timer:** every problem is timed from when it appears to when you submit.
- **Breakdown:** after each answer, a bar shows the whole (100%) with each piece of the
  calculation laid on it (for example 10% + 5% for 15%), followed by the steps written out.
- **Levels:** 12 levels, from "10% of round numbers" to a mixed review. You move up when your
  last 10 answers at your current level are at least 90% right and the median time is under that
  level's target. About 30% of problems review earlier levels.
- Answers accept a decimal comma or a point (`10,5` or `10.5`).

Progress is saved in the browser's localStorage. There is no backend.

## Setup

```sh
npm install
npm run dev
```

| Script            | What it does                        |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start the dev server                |
| `npm run build`   | Type-check and build for production |
| `npm run preview` | Serve the production build locally  |
| `npm test`        | Run the unit tests (Vitest)         |
| `npm run lint`    | Lint with ESLint                    |
| `npm run format`  | Format with Prettier                |

## Project layout

```
src/
  engine/       Pure TypeScript, no Vue: level generators, math, grading, mastery rule
  stores/       Pinia store for progress (localStorage)
  composables/  Stopwatch
  components/   HomeView, DrillView, BreakdownBar
tests/          Vitest tests for the engine
```

To add or tune a level, edit `src/engine/levels.ts`. Each level has a generator that returns the
prompt, the answer and its breakdown, plus a target time per problem. The level tests re-derive
every answer from the prompt text, so a wrong generator fails `npm test`.

Stack: Vue 3, TypeScript, Vite, Pinia, Tailwind CSS v4, Vitest.
