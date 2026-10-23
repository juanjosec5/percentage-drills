# Percent Drills

Mental-math practice for percentages, built like a Kumon workbook: small steps, short timed
sessions every day, and you only move up once a step is both accurate and fast.

## How it works

The screens show progress instead of explaining it: a bar for the daily set, pips for the
current level, a 🔥 count for the streak.

- **Daily set:** 10 problems a day, shown as a 10-segment bar on the Start button.
- **Streak:** any 10 answers in a day (daily set or endless) keep it going. One missed day a week
  is forgiven automatically; two missed days in a row end it.
- **Endless:** a new problem every time you answer one, for as long as you like.
- **Timer:** every problem is timed from when it appears to when you submit. The ⏱ switch hides
  the running clock (the time still counts and shows after you answer). Leaving the page
  mid-problem drops that problem, so an interruption never records a very slow answer.
- **Feedback:** a right answer shows ✓ and Next. A wrong one shows the correct answer, what you
  typed (struck through) and a breakdown: a bar of the pieces of the calculation (for example
  10% + 5% for 15%) and the method for each.
- **Tips:** a level's one-line tip (e.g. `19% = 20% − 1%`) shows on its first problem only.
- **Levels:** 12 levels, from 10% of whole numbers to a mixed review. A level is done after
  **10 right answers within its target time**. Wrong or slow answers don't count, and nothing is
  ever taken back. About 30% of problems review earlier levels; they're tagged "↺ review" and
  don't count toward the current level.
- **Mastery meter:** 10 pips for the current level, one filled ✓ per counted answer, plus
  "N more" in the drill. The glass on the Start button fills the same way.
- Answers accept a decimal comma or a point (`10,5` or `10.5`).
- **Language:** English or Spanish, from the EN / ES switch (on home and in the drill). It starts
  in Spanish when the browser language is Spanish. Spanish shows decimals with a comma (`63,5`).

Progress and the language choice are saved in the browser's localStorage
(`percent-drills:v1` and `percent-drills:lang`). There is no backend. The save carries a format
`version` (a save without one is v1); `src/stores/save.ts` upgrades older saves step by step
and drops invalid entries before the app reads them. Export / Import on Home download the save
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
