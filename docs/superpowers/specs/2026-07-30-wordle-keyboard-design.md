# Derived Wordle Keyboard

## Goal

Show a QWERTY keyboard diagram, colored the way the real Wordle app colors its
keyboard, so a glance at the UI reveals which letters remain available for the
next guess.

## Behavior

The keyboard is read-only. It derives every key's color from the guess grid;
clicking a key does nothing. For each letter A-Z, scan every filled cell in the
grid and apply this precedence:

| Condition (any cell containing that letter) | Key color        |
| ------------------------------------------- | ---------------- |
| marked `in-word-correct-position`           | green            |
| else marked `in-word-wrong-position`        | yellow           |
| else marked `not-in-word`                   | dark gray        |
| otherwise                                   | light gray       |

Cells in the `not-guessed` state (a letter typed but not yet marked) contribute
nothing, so those letters stay light gray.

Green and yellow outrank dark gray. That ordering is what makes double letters
read correctly: guess `EERIE` with one E green and another E gray, and the key
must show green. The same precedence already governs pattern generation in
`WordPatternGenerator.analyzeConstraints` and was the subject of commit
`ba9d761`.

## Placement

The keyboard is its own card, the first child of `.right-column` in `App.tsx`,
above the Possible Word Patterns card and well above Word Ideas.

It takes over the slot vacated by the `constraints-summary` block, which is
deleted. That block listed three things, all now redundant:

- **Confirmed positions** — the patterns list already renders known letters in
  place.
- **Excluded letters** — these are exactly the dark keys.
- **Must include letters** — these are the yellow keys. One narrow signal is
  lost: `mustIncludeLetters` means "needs a placement beyond the greens," so a
  word known to hold two E's with one already green drops out of the list while
  the keyboard just shows E as green. The generated patterns still encode that
  requirement, so nothing is lost overall.

## Components

### `src/LetterState.ts` (new)

Holds the `LetterState` union type, moved out of `WordleKeyboard.tsx`.

Today `WordGuessArea` imports its core type from the keyboard component, a
backwards dependency that only exists because the type happened to be declared
there. Since the keyboard is being rewritten anyway, the type moves to its own
module. Consumers: `WordGuessArea`, `WordPatternGenerator`, `WordScratchPad`,
`WordleKeyboard`.

### `src/WordleKeyboard.tsx` (rewritten in place)

The existing file is dead code: an interactive click-to-cycle keyboard with its
own `useState`, rendered by nothing. Nothing imports it except for the
`LetterState` type. It is replaced by:

- `export function deriveLetterStates(grid: LetterBox[][]): Record<string, LetterState>`
  — a pure function implementing the precedence table above, exported so it can
  be unit-tested without rendering.
- `const WordleKeyboard: React.FC<{ grid: LetterBox[][] }>` — stateless and
  props-only. No `useState`, no click handlers, no `onLetterStateChange`, no
  `externalLetterStates`. Renders three QWERTY rows plus the color legend.

### `src/WordleKeyboard.css`

Drop `cursor: pointer`, `:hover`, `:active`, and the per-state hover variants;
none apply to a read-only display. Shrink keys from their current 43x58px: the
keyboard now sits in a card in the right column, and the desktop layout pins
`.App` to `100vh` with `overflow: hidden`, so vertical space is scarce.

### `src/App.tsx`

Render `<WordleKeyboard grid={grid} />` as the first child of `.right-column`.
The `grid` state already lives in `App`.

### `src/WordPatternGenerator.tsx`

Delete the `constraints-summary` JSX block and the `displayMustInclude`
computation, whose only consumer is that block. The `constraints` object itself
stays — pattern generation depends on it.

### `src/WordPatternGenerator.css`

Remove the orphaned rules: `.constraints-summary`, `.constraint-group`,
`.confirmed-letters`, `.confirmed-letter`, `.must-include-letters`,
`.must-include-letter`, `.excluded-letters`, `.excluded-letter`.

## Data flow

Unchanged and one-directional. `WordGuessArea` owns the grid and lifts it to
`App` through `onGridChange`; `App` passes it down. The keyboard is a leaf that
only reads. No new state, no new localStorage key, no second source of truth.

## Testing

`src/WordleKeyboard.test.tsx` exercises `deriveLetterStates`:

- an empty grid leaves every letter light gray
- each of the three marked states maps to its color in isolation
- a letter typed but left `not-guessed` stays light gray
- a letter gray in one row and green in another resolves to green
- a letter gray in one cell and yellow in another cell of the same row resolves
  to yellow (the `ba9d761` scenario)

`src/App.test.tsx` is the untouched Create React App stub asserting a "learn
react" link this app has never rendered, so the suite is red before any of this
work begins. Replace it with a smoke test that `App` renders.

## Out of scope

- Making the keyboard interactive in any form (setting states, typing into Word
  Ideas). The grid stays the sole input surface.
- Extracting the constraint-analysis logic duplicated between
  `WordPatternGenerator` and `WordScratchPad`. Real, but unrelated to this
  feature.
