/**
 * The state of a single letter in a Wordle guess, as marked by the user.
 * Shared by the guess grid, the pattern generator, and the keyboard display.
 */
export type LetterState =
  | 'not-guessed'
  | 'not-in-word'
  | 'in-word-wrong-position'
  | 'in-word-correct-position';
