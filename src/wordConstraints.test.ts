import { LetterState } from './LetterState';
import { LetterBox, analyzeConstraints, validateWord } from './wordConstraints';

const G: LetterState = 'in-word-correct-position';
const Y: LetterState = 'in-word-wrong-position';
const X: LetterState = 'not-in-word';
const U: LetterState = 'not-guessed';

/** Build a guess row from "LETTERS" and a matching array of states. */
const row = (letters: string, states: LetterState[]): LetterBox[] =>
  letters.split('').map((letter, i) => ({ letter, state: states[i] }));

const emptyRow = (): LetterBox[] =>
  Array(5)
    .fill(null)
    .map(() => ({ letter: '', state: U }));

/**
 * The reported scenario:
 *   guess 1  TIARA  — I and the first A yellow, everything else gray
 *   guess 2  LANAI  — first A green, second A yellow, I yellow, rest gray
 *
 * LANAI alone proves the answer holds at least two A's: one green and one
 * yellow in the same guess.
 */
const twoAGrid = (): LetterBox[][] => [
  row('TIARA', [X, Y, Y, X, X]),
  row('LANAI', [X, G, X, Y, Y]),
  emptyRow(),
  emptyRow(),
  emptyRow(),
  emptyRow(),
];

describe('analyzeConstraints', () => {
  test('counts a letter twice when one guess marks it green and yellow', () => {
    const constraints = analyzeConstraints(twoAGrid());

    expect(constraints.requiredCounts['A']).toBe(2);
    expect(constraints.requiredCounts['I']).toBe(1);
  });

  test('does not double-count a letter guessed twice but present once', () => {
    // The ba9d761 case: guessed twice in one row, yellow once and gray once.
    const grid = [row('EERIE', [Y, X, X, X, X]), emptyRow()];
    const constraints = analyzeConstraints(grid);

    expect(constraints.requiredCounts['E']).toBe(1);
    expect(constraints.excludedLetters.has('E')).toBe(false);
  });

  test('excludes a letter only when it is never green or yellow anywhere', () => {
    const constraints = analyzeConstraints(twoAGrid());

    expect(Array.from(constraints.excludedLetters).sort()).toEqual(['L', 'N', 'R', 'T']);
    expect(constraints.excludedLetters.has('A')).toBe(false);
    expect(constraints.excludedLetters.has('I')).toBe(false);
  });

  test('records green letters as confirmed positions', () => {
    const constraints = analyzeConstraints(twoAGrid());

    expect(constraints.confirmedPositions).toEqual({ 1: 'A' });
  });

  test('treats a gray cell as a wrong position when the letter lives elsewhere', () => {
    const constraints = analyzeConstraints(twoAGrid());

    // A: yellow at 2, gray at 4 (guess 1), yellow at 3 (guess 2)
    expect(Array.from(constraints.wrongPositions['A']).sort()).toEqual([2, 3, 4]);
  });
});

describe('validateWord', () => {
  test('rejects a word with too few copies of a required letter', () => {
    // The reported bug: MAGIC satisfies every other constraint but holds one A.
    const constraints = analyzeConstraints(twoAGrid());
    const result = validateWord('MAGIC', constraints);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/2.*A/);
  });

  test('accepts a word that carries both required As', () => {
    // Second A can only sit at index 0: index 1 is the green A, and 2-4 are
    // ruled out as wrong positions.
    const constraints = analyzeConstraints(twoAGrid());

    expect(validateWord('AAIDE', constraints).valid).toBe(true);
  });

  test('still accepts a single copy when only one is required', () => {
    const grid = [row('CRANE', [X, X, Y, X, X]), emptyRow()];
    const constraints = analyzeConstraints(grid);

    // One A required, and it must avoid index 2 where it was guessed yellow.
    expect(validateWord('ADOPT', constraints).valid).toBe(true);
  });

  test('rejects a word containing an excluded letter', () => {
    const constraints = analyzeConstraints(twoAGrid());
    const result = validateWord('TAAIL', constraints);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/T/);
  });

  test('rejects a word that misses a confirmed position', () => {
    const constraints = analyzeConstraints(twoAGrid());
    // Index 1 is a confirmed A; this word puts an I there.
    const result = validateWord('IIAAA', constraints);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/[Pp]osition 2/);
  });

  test('rejects a word placing a letter in a known wrong position', () => {
    const constraints = analyzeConstraints(twoAGrid());
    // A at index 2 is a known wrong position.
    const result = validateWord('AAAID', constraints);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/position 3/);
  });

  test('is case insensitive', () => {
    const constraints = analyzeConstraints(twoAGrid());

    expect(validateWord('magic', constraints).valid).toBe(false);
    expect(validateWord('aaide', constraints).valid).toBe(true);
  });

  test('accepts anything when no letters have been marked', () => {
    const constraints = analyzeConstraints([emptyRow(), emptyRow()]);

    expect(validateWord('MAGIC', constraints).valid).toBe(true);
  });
});
