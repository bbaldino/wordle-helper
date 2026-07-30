import React from 'react';
import { render, screen } from '@testing-library/react';
import { LetterState } from './LetterState';
import WordleKeyboard, { deriveLetterStates } from './WordleKeyboard';

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

test('renders each key with the CSS class matching its derived state', () => {
  const grid = [
    row(
      ['A', 'in-word-correct-position'],
      ['S', 'in-word-wrong-position'],
      ['C', 'not-in-word'],
      ['', 'not-guessed'],
      ['', 'not-guessed'],
    ),
  ];

  render(<WordleKeyboard grid={grid} />);

  expect(screen.getByText('A')).toHaveClass('keyboard-key--in-word-correct-position');
  expect(screen.getByText('S')).toHaveClass('keyboard-key--in-word-wrong-position');
  expect(screen.getByText('C')).toHaveClass('keyboard-key--not-in-word');
  expect(screen.getByText('Q')).toHaveClass('keyboard-key--not-guessed');
});
