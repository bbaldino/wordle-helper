import React, { useState } from 'react';
import './WordleKeyboard.css';

export type LetterState = 'not-guessed' | 'not-in-word' | 'in-word-wrong-position' | 'in-word-correct-position';

interface WordleKeyboardProps {
  onLetterStateChange?: (letter: string, state: LetterState) => void;
  externalLetterStates?: Record<string, LetterState>;
}

const WordleKeyboard: React.FC<WordleKeyboardProps> = ({ onLetterStateChange, externalLetterStates }) => {
  // QWERTY keyboard layout
  const keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  // Initialize all letters to 'not-guessed' state
  const initializeLetterStates = () => {
    const states: Record<string, LetterState> = {};
    keyboardRows.flat().forEach(letter => {
      states[letter] = 'not-guessed';
    });
    return states;
  };

  const [letterStates, setLetterStates] = useState<Record<string, LetterState>>(initializeLetterStates);

  // Cycle through states when clicking a letter
  const cycleLetterState = (letter: string) => {
    const stateOrder: LetterState[] = ['not-guessed', 'not-in-word', 'in-word-wrong-position', 'in-word-correct-position'];
    const currentStateIndex = stateOrder.indexOf(letterStates[letter]);
    const nextStateIndex = (currentStateIndex + 1) % stateOrder.length;
    const nextState = stateOrder[nextStateIndex];
    
    setLetterStates(prev => ({
      ...prev,
      [letter]: nextState
    }));

    if (onLetterStateChange) {
      onLetterStateChange(letter, nextState);
    }
  };

  const getLetterClassName = (letter: string) => {
    // Use external state if available, otherwise fall back to internal state
    const state = externalLetterStates?.[letter] || letterStates[letter];
    return `keyboard-key keyboard-key--${state}`;
  };

  return (
    <div className="wordle-keyboard">
      <div className="keyboard-instructions">
        <p>Click letters to cycle through states:</p>
        <div className="state-legend">
          <span className="legend-item">
            <span className="legend-color legend-color--not-guessed"></span>
            Not guessed yet
          </span>
          <span className="legend-item">
            <span className="legend-color legend-color--not-in-word"></span>
            Not in word
          </span>
          <span className="legend-item">
            <span className="legend-color legend-color--in-word-wrong-position"></span>
            In word, wrong position
          </span>
          <span className="legend-item">
            <span className="legend-color legend-color--in-word-correct-position"></span>
            Correct position
          </span>
        </div>
      </div>
      
      {keyboardRows.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {row.map(letter => (
            <button
              key={letter}
              className={getLetterClassName(letter)}
              onClick={() => cycleLetterState(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default WordleKeyboard;
