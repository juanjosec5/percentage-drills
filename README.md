# Percent Drills

Mental-math practice for percentages, built like a Kumon workbook: small steps, short timed
sessions every day, and you only move up once a step is both accurate and fast.

## How it works

The screens show progress instead of explaining it: a glass that fills on the current level,
pips in the drill, a 🔥 ring for the day.

- **The path:** 11 levels in three worlds (Beginner, Intermediate, Advanced) down one rail. The
  current level is the glass button; finished worlds fold to one line; a locked level shows a
  sample problem when tapped. Plip, the drop on the rail, hops to the next stop after each one.
- **Levels:** a level is done after **10 right answers within its time limit** (shown beside
  the clock). Wrong or slow answers don't count, and nothing is ever taken back. About 30% of
  problems review earlier levels, tagged "↺ review, not counted"; levels with recent misses come
  up in review more often.
- **World challenges:** Beginner and Intermediate end in a checkpoint flag. Finishing a world's
  last level opens its challenge: 10 problems from the whole world, all right and within twice
  the time, in a row. The first miss ends the run; the best score is kept and a retry costs
  nothing. Passing opens the next world. Advanced ends in Mixed instead.
- **Find my level:** an optional 3-question check per world. Passing one starts you in the next
  world and counts as passing that world's challenge.
- **Streak:** any 10 answers in a day keep it going (the ring on the 🔥 chip). One missed day a
  week is forgiven automatically; two missed days in a row end it.
- **Timer:** every problem is timed from when it appears to when you submit. The ⏱ switch hides
  the running clock. Leaving the page mid-problem drops that problem.
- **Feedback:** a wrong answer shows the right one, what you typed (struck through) and, for
  multi-step problems, a breakdown of the pieces (for example 10% + 5% for 15%).
- Answers accept a decimal comma or a point (`10,5` or `10.5`). Numbers show no thousands
  separator, so what's shown matches what's typed.
- **Language:** English or Spanish, from the EN / ES switch. It starts in Spanish when the
  browser language is Spanish.

Progress and the language choice are saved in the browser's localStorage
(`percent-drills:v1` and `percent-drills:lang`). There is no backend. The save carries a format
`version` (a save without one is v1); `src/stores/save.ts` upgrades older saves step by step
and drops invalid entries before the app reads them. Since v5 the save names levels by id, not
position, so adding levels doesn't move anyone's place. Export / Import on Home download the save
as a JSON file and load one back through the same checks.

## Setup

```sh
npm install
npm run dev
```

| Script             | What it does                                 |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Start the dev server                         |
| `npm run build`    | Type-check and build for production          |
| `npm run preview`  | Serve the production build locally           |
| `npm test`         | Run the unit tests (Vitest)                  |
| `npm run test:e2e` | Run the browser tests (Playwright, headless) |
| `npm run lint`     | Lint with ESLint                             |
| `npm run format`   | Format with Prettier                         |

The browser tests start their own Vite server on a free port. Install the browsers once with
`npx playwright install chromium webkit`. Each spec seeds `percent-drills:v1` and fixes the clock,
which also fixes the problem sequence, so runs are repeatable. GitHub Actions
(`.github/workflows/ci.yml`) runs the type-check, lint, unit tests, build and browser tests on
every pull request and on pushes to `main`; a failed run uploads the Playwright report.

`npm install` also points git at `.githooks/`, whose pre-commit hook runs the type-check, lint
and unit tests before each commit (`git commit --no-verify` skips it once).

## Project layout

```
src/
  engine/       Pure TypeScript, no Vue: level generators, math, grading, mastery rule
  i18n/         Pure TypeScript: the English and Spanish dictionaries and the translator
  stores/       Pinia store for progress (localStorage)
  composables/  Stopwatch, current language
  components/   HomeView, DrillView, LiquidCta, BreakdownBar, MasteryMeter, …
tests/          Vitest tests for the engine, the dictionaries and the copy limits
e2e/            Playwright tests for the flows in a real browser (Chromium and WebKit)
```

To add or tune a level, edit `src/engine/levels.ts`. Each level has a generator that returns the
prompt, the answer and its breakdown, plus a target time per problem. The level tests re-derive
every answer from the prompt text, in both languages, so a wrong generator fails `npm test`.

The engine never builds display text. It returns messages (a dictionary key plus raw numbers),
and the UI renders them in the current language. To add or change copy, edit `src/i18n/en.ts`
and `src/i18n/es.ts`; a key missing from Spanish fails the type-check. `tests/copy.test.ts`
caps level titles and tips, and bans timing jargon ("typical", "target"), so text can't creep
back.

Stack: Vue 3, TypeScript, Vite, Pinia, Tailwind CSS v4, Vitest, Playwright.
