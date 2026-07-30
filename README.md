# Wordle Helper

A companion app for solving [Wordle](https://www.nytimes.com/games/wordle). You type in the
guesses you have already made and mark how Wordle colored them; the app works out what the
answer can still be and shows you where to go next.

It does not play Wordle for you and it has no dictionary — it never suggests a specific word.
It tracks the constraints so you don't have to hold them in your head.

## Using it

1. Type a guess you have already played into a row of the grid.
2. Click each letter to cycle its color until it matches what Wordle showed you:
   gray (not in the word) → yellow (in the word, wrong spot) → green (correct spot).
3. Read the three panels on the right, and add candidate words as you think of them.

Everything is saved to `localStorage`, so closing the tab won't lose your puzzle.
**Reset All** in the header clears it.

## The panels

**Enter Your Wordle Guesses** — six rows of five boxes, mirroring the real game. Typing
advances to the next box automatically; the `✕` clears a row.

**Letters Remaining** — a QWERTY keyboard colored the way Wordle colors its own: letters you
have ruled out go dark, letters known to be in the word go green or yellow, and untried
letters stay light. It is the fastest way to see what you still have to work with when
composing the next guess.

**Possible Word Patterns** — every arrangement of the known letters that is still consistent
with your clues, shown as `A A I _ _` style shapes. A pattern is highlighted when one of your
word ideas matches it. If you know a pattern is wrong for a reason the app can't see, click
its `✕` to strike it out; click again to bring it back.

**Word Ideas** — a scratch pad for candidate words. A word is rejected outright if it already
contradicts your clues, with the reason why. Ideas that were valid when you added them get
flagged as invalid once a later guess rules them out, so the list stays honest as you play.
Below it, **Unknown Letter Frequency** ranks the letters that appear across your still-valid
ideas but that you haven't tested yet — high-frequency letters are the ones worth spending a
guess on, since they split the remaining possibilities fastest.

## Wordle rules it gets right

Repeated letters are where Wordle's feedback gets genuinely subtle, and where this app earns
its keep. All of it lives in `src/wordConstraints.ts`:

- **The strongest clue for a letter wins.** Guess a letter twice when the answer holds it
  once and Wordle marks one copy green or yellow and the other gray. The letter is still in
  the word, so it is never treated as eliminated.
- **A letter can be required more than once.** If a single guess marks a letter green *and*
  yellow, the answer contains at least two of it. Words with only one copy are ruled out —
  presence is not enough.
- **Counts are taken per guess, not summed.** Two guesses each showing one `E` mean the
  answer has one `E`, not two. The requirement is the largest count any single guess proves.
- **A gray copy still rules out its position.** When a letter is gray in one spot but present
  elsewhere, that spot is recorded as somewhere the letter cannot go.

## Development

```bash
npm install
npm start                        # dev server on http://localhost:3000
npm test -- --watchAll=false     # run the suite once (plain `npm test` watches)
npm run build                    # production build into build/
```

Built with React 19, TypeScript, and Create React App. Tests use Jest and
React Testing Library.

## Deployment

Hosted on Cloudflare Pages:

```bash
npm run deploy                   # builds, then `wrangler pages deploy`
```

## Project structure

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | Layout, shared grid and word-idea state, `localStorage` persistence |
| `src/WordGuessArea.tsx` | The guess grid — the only place clues are entered |
| `src/wordConstraints.ts` | Turns the grid into constraints and validates words against them |
| `src/WordleKeyboard.tsx` | Read-only keyboard derived from the grid |
| `src/WordPatternGenerator.tsx` | Generates and filters the possible letter patterns |
| `src/WordScratchPad.tsx` | Word ideas, their validity, and letter-frequency analysis |
| `src/LetterState.ts` | The four states a marked letter can be in |

The guess grid is the single source of input. Everything else derives from it, so the panels
can never disagree with each other about what the clues mean.
