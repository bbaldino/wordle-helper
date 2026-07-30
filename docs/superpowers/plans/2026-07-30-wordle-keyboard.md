# Derived Wordle Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only QWERTY keyboard to the right column that colors each letter from the guess grid — green, yellow, dark gray for eliminated — so you can see at a glance which letters are still available.

**Architecture:** A pure function `deriveLetterStates(grid)` folds the whole guess grid down to one state per letter using a green > yellow > gray precedence ranking. A stateless `WordleKeyboard` component renders that map as three QWERTY rows. `App` already owns `grid`, so the keyboard is a leaf that only reads — no new state, no new localStorage key. The redundant constraints summary inside the pattern generator is deleted to make room.

**Tech Stack:** React 19 + TypeScript 4.9, Create React App (`react-scripts` 5), Jest + `@testing-library/react`, plain CSS modules-by-convention (one `.css` file imported per component).

## Global Constraints

- Shell is **fish** — `VAR=value cmd` prefix syntax does NOT work. Use `npm test -- --watchAll=false` (never `CI=true npm test`).
- Acronyms: capitalize only the first letter of multi-letter acronyms (project convention from CLAUDE.md).
- No new npm dependencies. Everything here uses what is already installed.
- Existing convention: each component declares its own local `interface LetterBox` rather than importing one. Follow it — do not centralize `LetterBox`.
- Wordle color values already used throughout the app, reuse exactly: light gray `#d3d6da`, dark gray `#787c7e`, yellow `#c9b458`, green `#6aaa64`.
- The desktop layout pins `.App` to `100vh` with `overflow: hidden`. Vertical space in the right column is scarce; keep the keyboard compact.

---

### Task 1: Repair the broken test suite

`src/App.test.tsx` is the untouched Create React App stub. It asserts a "learn react" link that this app has never rendered, so `npm test` is red before any of this work starts. Fix it first so later tasks have a trustworthy signal.

**Files:**
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks. This task exists to make `npm test -- --watchAll=false` exit 0.

- [ ] **Step 1: Confirm the suite is currently red**

Run: `npm test -- --watchAll=false`

Expected: FAIL in `src/App.test.tsx` with `Unable to find an element with the text: /learn react/i`.

- [ ] **Step 2: Replace the stub with a real smoke test**

Replace the entire contents of `src/App.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the app heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /wordle helper/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the suite to verify it passes**

Run: `npm test -- --watchAll=false`

Expected: PASS, 1 test.

- [ ] **Step 4: Commit**

```bash
git add src/App.test.tsx
git commit -m "replace CRA stub test with an app smoke test"
```

---

### Task 2: Extract `LetterState` into its own module

`LetterState` currently lives in `WordleKeyboard.tsx`, so `WordGuessArea` — which owns the grid — imports its core type *from the keyboard*. That is backwards, and Task 3 rewrites the keyboard entirely. Move the type out first.

This task is a pure refactor: no behavior changes, no test changes.

**Files:**
- Create: `src/LetterState.ts`
- Modify: `src/WordleKeyboard.tsx:2-4`
- Modify: `src/WordGuessArea.tsx:2`
- Modify: `src/WordPatternGenerator.tsx:2`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type LetterState = 'not-guessed' | 'not-in-word' | 'in-word-wrong-position' | 'in-word-correct-position';` importable as `import { LetterState } from './LetterState';`. Tasks 3 and 5 rely on this path.

Note: `src/WordScratchPad.tsx` declares `state: string` in its own local `LetterBox` and does not import `LetterState`. Leave it alone — tightening that type is unrelated to this feature.

- [ ] **Step 1: Create the new module**

Create `src/LetterState.ts`:

```typescript
/**
 * The state of a single letter in a Wordle guess, as marked by the user.
 * Shared by the guess grid, the pattern generator, and the keyboard display.
 */
export type LetterState =
  | 'not-guessed'
  | 'not-in-word'
  | 'in-word-wrong-position'
  | 'in-word-correct-position';
```

- [ ] **Step 2: Remove the old declaration from the keyboard**

In `src/WordleKeyboard.tsx`, delete line 4 (the `export type LetterState = ...` declaration) and add an import at the top. Lines 1-4 become:

```tsx
import React, { useState } from 'react';
import { LetterState } from './LetterState';
import './WordleKeyboard.css';
```

- [ ] **Step 3: Repoint the two consumers**

In `src/WordGuessArea.tsx`, change line 2 from `import { LetterState } from './WordleKeyboard';` to:

```tsx
import { LetterState } from './LetterState';
```

In `src/WordPatternGenerator.tsx`, change line 2 from `import { LetterState } from './WordleKeyboard';` to:

```tsx
import { LetterState } from './LetterState';
```

- [ ] **Step 4: Verify nothing still imports the type from the keyboard**

Run: `grep -rn "LetterState.*from './WordleKeyboard'" src/`

Expected: no output.

- [ ] **Step 5: Verify the app still compiles and tests pass**

Run: `npm run build`

Expected: `Compiled successfully.` (Warnings about the unused `WordleKeyboard` component are pre-existing and fine — nothing renders it yet.)

Run: `npm test -- --watchAll=false`

Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add src/LetterState.ts src/WordleKeyboard.tsx src/WordGuessArea.tsx src/WordPatternGenerator.tsx
git commit -m "move LetterState into its own module"
```

---

### Task 3: Rewrite `WordleKeyboard` as a read-only derived display

The existing `WordleKeyboard.tsx` is dead code — an interactive click-to-cycle keyboard with its own `useState`, rendered by nothing. Replace it wholesale with a stateless display driven by the guess grid.

**Files:**
- Create: `src/WordleKeyboard.test.tsx`
- Modify: `src/WordleKeyboard.tsx` (full rewrite)
- Modify: `src/WordleKeyboard.css` (full rewrite)

**Interfaces:**
- Consumes: `LetterState` from `./LetterState` (Task 2).
- Produces:
  - `export function deriveLetterStates(grid: LetterBox[][]): Record<string, LetterState>` — keys are the 26 uppercase letters, always all present.
  - `export const KEYBOARD_ROWS: string[][]` — three rows of uppercase letters.
  - `export default WordleKeyboard` — `React.FC<{ grid: LetterBox[][] }>`. Task 4 renders this.

**The precedence rule under test:** for each letter, the strongest signal anywhere in the grid wins — `in-word-correct-position` (green) beats `in-word-wrong-position` (yellow) beats `not-in-word` (gray) beats `not-guessed`. This is what makes double letters read correctly when one copy is marked green and another gray. The same precedence already governs `analyzeConstraints` in `WordPatternGenerator.tsx:123-128` and was the subject of commit `ba9d761`.

- [ ] **Step 1: Write the failing tests**

Create `src/WordleKeyboard.test.tsx`:

```tsx
import { LetterState } from './LetterState';
import { deriveLetterStates } from './WordleKeyboard';

interface LetterBox {
  letter: string;
  state: LetterState;
}

/** Build a single grid row from pairs like ['C', 'not-in-word']. */
const row = (...cells: Array<[string, LetterState]>): LetterBox[] =>
  cells.map(([letter, state]) => ({ letter, state }));

/** An untouched 5-wide row, the way WordGuessArea initializes one. */
const emptyRow = (): LetterBox[] =>
  Array(5)
    .fill(null)
    .map(() => ({ letter: '', state: 'not-guessed' as LetterState }));

test('every letter starts as not-guessed on an empty grid', () => {
  const states = deriveLetterStates([emptyRow(), emptyRow()]);

  expect(Object.keys(states)).toHaveLength(26);
  Object.values(states).forEach((state) => {
    expect(state).toBe('not-guessed');
  });
});

test('handles a grid with no rows at all', () => {
  const states = deriveLetterStates([]);

  expect(states['A']).toBe('not-guessed');
  expect(Object.keys(states)).toHaveLength(26);
});

test('maps each marked state onto its letter', () => {
  const states = deriveLetterStates([
    row(
      ['C', 'not-in-word'],
      ['R', 'in-word-wrong-position'],
      ['A', 'in-word-correct-position'],
      ['', 'not-guessed'],
      ['', 'not-guessed'],
    ),
  ]);

  expect(states['C']).toBe('not-in-word');
  expect(states['R']).toBe('in-word-wrong-position');
  expect(states['A']).toBe('in-word-correct-position');
});

test('leaves a typed but unmarked letter as not-guessed', () => {
  const states = deriveLetterStates([row(['C', 'not-guessed'])]);

  expect(states['C']).toBe('not-guessed');
});

test('lowercase letters in the grid map onto uppercase keys', () => {
  const states = deriveLetterStates([row(['c', 'not-in-word'])]);

  expect(states['C']).toBe('not-in-word');
});

test('green in a later row overrides gray in an earlier row', () => {
  const states = deriveLetterStates([
    row(['E', 'not-in-word']),
    row(['E', 'in-word-correct-position']),
  ]);

  expect(states['E']).toBe('in-word-correct-position');
});

test('green in an earlier row is not downgraded by gray in a later row', () => {
  const states = deriveLetterStates([
    row(['E', 'in-word-correct-position']),
    row(['E', 'not-in-word']),
  ]);

  expect(states['E']).toBe('in-word-correct-position');
});

test('a double letter marked yellow and gray in one row resolves to yellow', () => {
  // The commit ba9d761 scenario: guessing a letter twice, present once.
  const states = deriveLetterStates([
    row(
      ['E', 'in-word-wrong-position'],
      ['E', 'not-in-word'],
      ['R', 'not-in-word'],
      ['I', 'not-in-word'],
      ['E', 'not-in-word'],
    ),
  ]);

  expect(states['E']).toBe('in-word-wrong-position');
  expect(states['R']).toBe('not-in-word');
});

test('yellow does not override green for the same letter', () => {
  const states = deriveLetterStates([
    row(['S', 'in-word-correct-position'], ['S', 'in-word-wrong-position']),
  ]);

  expect(states['S']).toBe('in-word-correct-position');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --watchAll=false --testPathPattern=WordleKeyboard`

Expected: FAIL. TypeScript reports that `deriveLetterStates` is not exported from `./WordleKeyboard`.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/WordleKeyboard.tsx`:

```tsx
import React from 'react';
import { LetterState } from './LetterState';
import './WordleKeyboard.css';

interface LetterBox {
  letter: string;
  state: LetterState;
}

interface WordleKeyboardProps {
  grid: LetterBox[][];
}

export const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

// Strength of each signal. The strongest mark anywhere in the grid wins, so a
// letter marked green in one guess stays green even if another copy of it was
// marked gray — the double-letter case from commit ba9d761.
const STATE_RANK: Record<LetterState, number> = {
  'not-guessed': 0,
  'not-in-word': 1,
  'in-word-wrong-position': 2,
  'in-word-correct-position': 3,
};

export function deriveLetterStates(grid: LetterBox[][]): Record<string, LetterState> {
  const states: Record<string, LetterState> = {};
  KEYBOARD_ROWS.flat().forEach((letter) => {
    states[letter] = 'not-guessed';
  });

  grid.forEach((row) => {
    row.forEach((letterBox) => {
      if (!letterBox.letter) return;
      const letter = letterBox.letter.toUpperCase();
      if (!(letter in states)) return;
      if (STATE_RANK[letterBox.state] > STATE_RANK[states[letter]]) {
        states[letter] = letterBox.state;
      }
    });
  });

  return states;
}

const WordleKeyboard: React.FC<WordleKeyboardProps> = ({ grid }) => {
  const letterStates = deriveLetterStates(grid);

  return (
    <div className="wordle-keyboard">
      <div className="keyboard-header">
        <h3>Letters Remaining</h3>
        <p>Dark letters have been ruled out by your guesses</p>
      </div>

      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {row.map((letter) => (
            <div key={letter} className={`keyboard-key keyboard-key--${letterStates[letter]}`}>
              {letter}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default WordleKeyboard;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --watchAll=false --testPathPattern=WordleKeyboard`

Expected: PASS, 9 tests.

- [ ] **Step 5: Rewrite the stylesheet**

The old file styles an interactive keyboard: pointer cursors, hover scaling, per-state hover colors, 43x58px keys. None of that applies now, and the keys must fit a card in the height-constrained right column.

Replace the entire contents of `src/WordleKeyboard.css`:

```css
.wordle-keyboard {
  width: 100%;
  max-width: 600px;
  margin: 0 auto 30px auto;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
}

/* Match the other cards when the layout goes side-by-side */
@media (min-width: 1024px) {
  .wordle-keyboard {
    margin: 0;
    max-width: none;
  }
}

.keyboard-header {
  margin-bottom: 16px;
  text-align: center;
}

.keyboard-header h3 {
  margin: 0 0 8px 0;
  font-size: 1.4rem;
  color: #1a1a1b;
  font-weight: 600;
}

.keyboard-header p {
  margin: 0;
  font-size: 14px;
  color: #787c7e;
}

.keyboard-row {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 6px;
}

.keyboard-row:last-child {
  margin-bottom: 0;
}

.keyboard-key {
  flex: 0 1 34px;
  min-width: 0;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  user-select: none;
  transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;
}

/* Letter state styles */
.keyboard-key--not-guessed {
  background-color: #d3d6da; /* Light gray */
  color: #1a1a1b;
}

.keyboard-key--not-in-word {
  background-color: #787c7e; /* Dark gray */
  color: white;
}

.keyboard-key--in-word-wrong-position {
  background-color: #c9b458; /* Yellow */
  color: white;
}

.keyboard-key--in-word-correct-position {
  background-color: #6aaa64; /* Green */
  color: white;
}

@media (max-width: 480px) {
  .wordle-keyboard {
    padding: 16px 10px;
  }

  .keyboard-row {
    gap: 4px;
  }

  .keyboard-key {
    height: 38px;
    font-size: 13px;
  }
}
```

Note: the old file also defined `.state-legend`, `.legend-item`, `.legend-color`, and `.legend-color--*`. Those same class names are defined identically in `WordGuessArea.css`, which still renders a legend, and CRA loads all CSS globally — so removing them here changes nothing on screen. Verify in Step 6.

- [ ] **Step 6: Verify the guess area legend still renders correctly**

Run: `npm start`, open http://localhost:3000, and confirm the four colored legend swatches under the guess grid still show light gray / dark gray / yellow / green. Stop the server when done.

Expected: legend unchanged. Its styles come from `WordGuessArea.css:174-211`, which defines `.state-legend`, `.legend-item`, `.legend-color`, and all four `.legend-color--*` rules independently.

- [ ] **Step 7: Verify the build**

Run: `npm run build`

Expected: `Compiled successfully.`

- [ ] **Step 8: Commit**

```bash
git add src/WordleKeyboard.tsx src/WordleKeyboard.test.tsx src/WordleKeyboard.css
git commit -m "rewrite WordleKeyboard as a read-only display derived from the guess grid"
```

---

### Task 4: Render the keyboard in the right column

**Files:**
- Modify: `src/App.tsx:1-5` (imports), `src/App.tsx:98-101` (right column)

**Interfaces:**
- Consumes: `WordleKeyboard` default export from Task 3, taking `grid: LetterBox[][]`.
- Produces: nothing consumed by later tasks.

`App` already holds `grid` in state and already passes it to `WordPatternGenerator` and `WordScratchPad`, so this is purely wiring.

- [ ] **Step 1: Import the component**

In `src/App.tsx`, add the import after the `WordScratchPad` import so lines 1-6 read:

```tsx
import React, { useState, useEffect } from 'react';
import './App.css';
import WordGuessArea, { LetterBox } from './WordGuessArea';
import WordPatternGenerator from './WordPatternGenerator';
import WordScratchPad from './WordScratchPad';
import WordleKeyboard from './WordleKeyboard';
```

- [ ] **Step 2: Render it as the first card in the right column**

In `src/App.tsx`, replace the `right-column` div:

```tsx
        <div className="right-column">
          <WordleKeyboard grid={grid} />
          <WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />
          <WordScratchPad grid={grid} wordIdeas={wordIdeas} onWordIdeasChange={handleWordIdeasChange} />
        </div>
```

- [ ] **Step 3: Verify tests and build**

Run: `npm test -- --watchAll=false`

Expected: PASS, 10 tests (1 app smoke test + 9 keyboard tests).

Run: `npm run build`

Expected: `Compiled successfully.`

- [ ] **Step 4: Verify it works in the browser**

Run `npm start` and open http://localhost:3000. Then:

1. Type `CRANE` into row 1 of the guess grid.
2. Click the `C` box until it is dark gray (not-in-word). The `C` key on the keyboard should turn dark gray.
3. Click the `R` box until it is yellow. The `R` key should turn yellow.
4. Click the `A` box until it is green. The `A` key should turn green.
5. Confirm `N` and `E` stay light gray (typed but unmarked).
6. Reload the page — the grid persists via localStorage, and the keyboard colors should come back with it.
7. Narrow the window below 1024px and confirm the keyboard stacks above the pattern generator without overflowing horizontally.

Stop the server when done.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "show the letters-remaining keyboard at the top of the right column"
```

---

### Task 5: Delete the redundant constraints summary

Everything the constraints summary displays is now shown better by the keyboard or by the patterns list itself:

- **Confirmed positions** — the patterns list already renders known letters in place.
- **Excluded letters** — exactly the dark keys.
- **Must include letters** — the yellow keys.

**Files:**
- Modify: `src/WordPatternGenerator.tsx:318-325` (delete), `src/WordPatternGenerator.tsx:334-373` (delete)
- Modify: `src/WordPatternGenerator.css:42-99` (delete)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

Keep the `constraints` object and `analyzeConstraints`. Pattern generation still depends on them; only the display code goes.

- [ ] **Step 1: Delete the display-only must-include computation**

In `src/WordPatternGenerator.tsx`, delete lines 318-325 in full — the comment, `greensDisplayCount`, and `displayMustInclude`. Their only consumer is the JSX removed in the next step:

```tsx
  // Derive display-only must-include list: letters still needed beyond confirmed greens
  const greensDisplayCount: Record<string, number> = {};
  Object.values(constraints.confirmedPositions).forEach((letter) => {
    greensDisplayCount[letter] = (greensDisplayCount[letter] || 0) + 1;
  });
  const displayMustInclude: string[] = Object.entries(constraints.requiredCounts)
    .filter(([letter, req]) => req > (greensDisplayCount[letter] || 0))
    .map(([letter]) => letter);
```

- [ ] **Step 2: Delete the constraints summary JSX**

In `src/WordPatternGenerator.tsx`, delete the whole `<div className="constraints-summary">` element (originally lines 334-373, including its three `constraint-group` children and the blank line after it). The `return` should go straight from the `pattern-header` div to the `patterns-container` div:

```tsx
  return (
    <div className="word-pattern-generator">
      <div className="pattern-header">
        <h3>Possible Word Patterns</h3>
        <p>Based on your guesses, here are the possible letter combinations:</p>
      </div>

      <div className="patterns-container">
```

- [ ] **Step 3: Delete the orphaned CSS**

In `src/WordPatternGenerator.css`, delete lines 42-99: from `.constraints-summary {` through the closing `}` of `.excluded-letter` plus the blank line after it. The file should go straight from the `.pattern-header p` rule's blank line to `.patterns-container {`.

The rules to remove are `.constraints-summary`, `.constraint-group`, `.constraint-group:last-child`, `.constraint-group strong`, the combined `.confirmed-letters, .must-include-letters, .excluded-letters`, `.confirmed-letter`, `.must-include-letter`, and `.excluded-letter`.

- [ ] **Step 4: Verify no references remain**

Run: `grep -rn "constraints-summary\|constraint-group\|confirmed-letter\|must-include-letter\|excluded-letter\|displayMustInclude\|greensDisplayCount" src/`

Expected: no output.

- [ ] **Step 5: Verify tests and build**

Run: `npm test -- --watchAll=false`

Expected: PASS, 10 tests.

Run: `npm run build`

Expected: `Compiled successfully.` with no unused-variable warnings for `WordPatternGenerator`.

- [ ] **Step 6: Verify in the browser**

Run `npm start` and open http://localhost:3000. With guesses marked in the grid, confirm:

1. The gray summary box between the "Possible Word Patterns" heading and the patterns list is gone.
2. The patterns list itself still generates correctly and the per-pattern `×` eliminate buttons still work.
3. The keyboard above still shows the same information the summary used to.

Stop the server when done.

- [ ] **Step 7: Commit**

```bash
git add src/WordPatternGenerator.tsx src/WordPatternGenerator.css
git commit -m "remove constraints summary now that the keyboard shows the same information"
```

---

## Verification

After all five tasks:

- [ ] `npm test -- --watchAll=false` — PASS, 10 tests
- [ ] `npm run build` — `Compiled successfully.`
- [ ] `grep -rn "from './WordleKeyboard'" src/` shows only `App.tsx` and `WordleKeyboard.test.tsx`
- [ ] The keyboard sits above Possible Word Patterns, colors update live as grid states change, and eliminated letters read as dark gray

## Out of scope

- Making the keyboard interactive in any way. The grid stays the sole input surface.
- Extracting the constraint-analysis logic duplicated between `WordPatternGenerator` and `WordScratchPad`. Real, but unrelated.
- Tightening `WordScratchPad`'s local `LetterBox.state` from `string` to `LetterState`.
