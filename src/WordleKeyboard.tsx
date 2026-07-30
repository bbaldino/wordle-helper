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
