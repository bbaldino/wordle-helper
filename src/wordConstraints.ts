import { LetterState } from './LetterState';

export interface LetterBox {
  letter: string;
  state: LetterState;
}

export interface Constraints {
  confirmedPositions: { [position: number]: string }; // Green letters in confirmed positions
  mustIncludeLetters: Set<string>; // Letters that still need additional placements beyond greens
  excludedLetters: Set<string>; // Gray letters that must be excluded
  wrongPositions: { [letter: string]: Set<number> }; // Letters that can't be in certain positions
  requiredCounts: Record<string, number>; // Minimum required count per letter (from greens/yellows)
}

export interface ValidationResult {
  valid: boolean;
  error: string;
}

/**
 * Reduce the guess grid to the set of constraints the answer must satisfy.
 *
 * This is the single source of truth for Wordle semantics. Both the pattern
 * generator and the word scratch pad read from it — they used to carry their
 * own copies, which drifted: one counted repeated letters and the other only
 * checked presence, so a word with too few copies of a required letter was
 * eliminated from the patterns but still shown as a valid idea.
 */
export const analyzeConstraints = (grid: LetterBox[][]): Constraints => {
  const constraints: Constraints = {
    confirmedPositions: {},
    mustIncludeLetters: new Set(),
    excludedLetters: new Set(),
    wrongPositions: {},
    requiredCounts: {}
  };

  // Track global evidence per letter to resolve conflicts properly
  const letterHasGreen = new Set<string>();
  const letterHasYellow = new Set<string>();
  const letterHasGray = new Set<string>();

  grid.forEach((row) => {
    row.forEach((letterBox, colIndex) => {
      if (!letterBox.letter) return; // Skip empty boxes

      const letter = letterBox.letter.toUpperCase();

      switch (letterBox.state) {
        case 'in-word-correct-position': {
          // Green: Letter is confirmed in this position
          constraints.confirmedPositions[colIndex] = letter;
          letterHasGreen.add(letter);
          break;
        }
        case 'in-word-wrong-position': {
          // Yellow: Letter is in the word but not in this position
          letterHasYellow.add(letter);
          if (!constraints.wrongPositions[letter]) {
            constraints.wrongPositions[letter] = new Set();
          }
          constraints.wrongPositions[letter].add(colIndex);
          break;
        }
        case 'not-in-word': {
          // Gray: Track, but only exclude if we never saw yellow/green
          letterHasGray.add(letter);
          // Also track this position as a wrong position, in case the letter
          // appears as yellow/green elsewhere (e.g. guessed in two spots,
          // yellow in one and gray in the other).
          if (!constraints.wrongPositions[letter]) {
            constraints.wrongPositions[letter] = new Set();
          }
          constraints.wrongPositions[letter].add(colIndex);
          break;
        }
        // 'not-guessed' state is ignored
      }
    });
  });

  // Build requiredCounts by taking, for each row, the number of present (yellow/green)
  // occurrences per letter, and keeping the maximum across rows. Counts are not summed
  // across rows because different guesses describe the same answer, not more of it.
  grid.forEach((row) => {
    const rowPresent: Record<string, number> = {};
    row.forEach((letterBox) => {
      if (!letterBox.letter) return;
      const letter = letterBox.letter.toUpperCase();
      if (letterBox.state === 'in-word-correct-position' || letterBox.state === 'in-word-wrong-position') {
        rowPresent[letter] = (rowPresent[letter] || 0) + 1;
      }
    });
    Object.entries(rowPresent).forEach(([letter, count]) => {
      constraints.requiredCounts[letter] = Math.max(constraints.requiredCounts[letter] || 0, count);
    });
  });

  // Build must-include letters: only letters whose required count exceeds
  // the number already satisfied by confirmed (green) positions.
  const placedByGreens: Record<string, number> = {};
  Object.values(constraints.confirmedPositions).forEach((letter) => {
    placedByGreens[letter] = (placedByGreens[letter] || 0) + 1;
  });
  Object.entries(constraints.requiredCounts).forEach(([letter, req]) => {
    const placed = placedByGreens[letter] || 0;
    if (req > placed) {
      constraints.mustIncludeLetters.add(letter);
    }
  });

  // Build excluded set: letters seen as gray AND never seen as yellow nor green
  letterHasGray.forEach((letter) => {
    if (!letterHasGreen.has(letter) && !letterHasYellow.has(letter)) {
      constraints.excludedLetters.add(letter);
    }
  });

  return constraints;
};

/**
 * Check a candidate word against the constraints, returning why it fails.
 * Callers that only need a boolean can read `.valid`.
 */
export const validateWord = (word: string, constraints: Constraints): ValidationResult => {
  const upperWord = word.toUpperCase();

  // Check for excluded letters
  for (let i = 0; i < upperWord.length; i++) {
    const letter = upperWord[i];
    if (constraints.excludedLetters.has(letter)) {
      return {
        valid: false,
        error: `Letter '${letter}' is marked as not in the word`
      };
    }
  }

  // Check confirmed positions (greens)
  for (const [pos, letter] of Object.entries(constraints.confirmedPositions)) {
    const position = parseInt(pos);
    if (upperWord[position] !== letter) {
      return {
        valid: false,
        error: `Position ${position + 1} must be '${letter}'`
      };
    }
  }

  // Check wrong positions (yellows can't be in these spots)
  for (const [letter, positions] of Object.entries(constraints.wrongPositions)) {
    for (const pos of Array.from(positions)) {
      if (upperWord[pos] === letter) {
        return {
          valid: false,
          error: `Letter '${letter}' cannot be at position ${pos + 1}`
        };
      }
    }
  }

  // Check required letter counts. Presence is not enough: a guess that marks a
  // letter green and yellow in the same row proves the answer holds two of them.
  for (const [letter, requiredCount] of Object.entries(constraints.requiredCounts)) {
    const countInWord = upperWord.split('').filter(c => c === letter).length;
    if (countInWord < requiredCount) {
      return {
        valid: false,
        error: requiredCount === 1
          ? `Word must contain letter '${letter}'`
          : `Word must contain ${requiredCount} '${letter}'s`
      };
    }
  }

  return { valid: true, error: '' };
};
