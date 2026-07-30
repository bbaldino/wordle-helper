import React, { useState, useEffect } from 'react';
import { LetterState } from './LetterState';
import { LetterBox } from './wordConstraints';
import './WordGuessArea.css';

interface WordGuessAreaProps {
  onGridChange?: (grid: LetterBox[][]) => void;
}

export type { LetterBox };

const STORAGE_KEY_GUESS_GRID = 'wordle-helper-guess-grid';

const WordGuessArea: React.FC<WordGuessAreaProps> = ({ onGridChange }) => {
  // Initialize 6 rows of 5 empty letter boxes (like Wordle)
  const initializeGrid = (): LetterBox[][] => {
    return Array(6).fill(null).map(() =>
      Array(5).fill(null).map(() => ({
        letter: '',
        state: 'not-guessed' as LetterState
      }))
    );
  };

  // Load initial grid from localStorage or initialize empty
  const [grid, setGrid] = useState<LetterBox[][]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GUESS_GRID);
      return saved ? JSON.parse(saved) : initializeGrid();
    } catch (e) {
      console.error('Failed to load guess grid from localStorage:', e);
      return initializeGrid();
    }
  });

  // Save grid to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GUESS_GRID, JSON.stringify(grid));
    } catch (e) {
      console.error('Failed to save guess grid to localStorage:', e);
    }
  }, [grid]);

  // Notify the parent after the grid settles. This must not happen inside a
  // setGrid updater: React runs those during the render phase (twice under
  // StrictMode), and calling the parent's setState from there warns about
  // updating one component while rendering another.
  // onGridChange is intentionally not a dependency — the parent recreates it
  // every render, which would re-fire this on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onGridChange?.(grid); }, [grid]);

  const updateLetterContent = (rowIndex: number, colIndex: number, letter: string) => {
    if (letter.length > 1) return; // Only allow single characters
    if (letter && !/^[A-Za-z]$/.test(letter)) return; // Only allow letters

    setGrid(prev => {
      const newGrid = prev.map(row => [...row]);
      newGrid[rowIndex][colIndex] = {
        ...newGrid[rowIndex][colIndex],
        letter: letter.toUpperCase()
      };

      return newGrid;
    });
  };

  const updateLetterState = (rowIndex: number, colIndex: number, newState: LetterState) => {
    setGrid(prev => {
      const newGrid = prev.map(row => [...row]);
      const letterBox = newGrid[rowIndex][colIndex];
      
      // Only update state if there's a letter in the box
      if (letterBox.letter) {
        newGrid[rowIndex][colIndex] = {
          ...letterBox,
          state: newState
        };
      }

      return newGrid;
    });
  };

  const cycleLetterState = (rowIndex: number, colIndex: number) => {
    const letterBox = grid[rowIndex][colIndex];
    if (!letterBox.letter) return; // Don't cycle empty boxes

    const stateOrder: LetterState[] = ['not-guessed', 'not-in-word', 'in-word-wrong-position', 'in-word-correct-position'];
    const currentStateIndex = stateOrder.indexOf(letterBox.state);
    const nextStateIndex = (currentStateIndex + 1) % stateOrder.length;
    const nextState = stateOrder[nextStateIndex];
    
    updateLetterState(rowIndex, colIndex, nextState);
  };

  const clearRow = (rowIndex: number) => {
    setGrid(prev => {
      const newGrid = prev.map(row => [...row]);
      newGrid[rowIndex] = Array(5).fill(null).map(() => ({
        letter: '',
        state: 'not-guessed' as LetterState
      }));

      return newGrid;
    });
  };

  const getLetterClassName = (letterBox: LetterBox) => {
    const hasLetter = letterBox.letter !== '';
    const baseClass = 'letter-box';
    const stateClass = hasLetter ? `letter-box--${letterBox.state}` : 'letter-box--empty';
    return `${baseClass} ${stateClass}`;
  };

  const handleLetterInput = (rowIndex: number, colIndex: number, value: string) => {
    updateLetterContent(rowIndex, colIndex, value);
    
    // Auto-focus next box if a letter was entered
    if (value && colIndex < 4) {
      const nextInput = document.querySelector(
        `[data-row="${rowIndex}"][data-col="${colIndex + 1}"]`
      ) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    } else if (value && colIndex === 4) {
      // Blur after last letter to dismiss mobile keyboard before user taps to cycle colors
      (document.activeElement as HTMLElement)?.blur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    // Handle backspace to go to previous box
    if (e.key === 'Backspace' && !grid[rowIndex][colIndex].letter && colIndex > 0) {
      const prevInput = document.querySelector(
        `[data-row="${rowIndex}"][data-col="${colIndex - 1}"]`
      ) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
      }
    }
  };

  return (
    <div className="word-guess-area">
      <div className="guess-header">
        <h2>Enter Your Wordle Guesses</h2>
        <p>Type letters in each row, then click letters to mark their states</p>
      </div>

      <div className="wordle-grid">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="guess-row">
            <div className="row-number">{rowIndex + 1}</div>
            <div className="letter-boxes">
              {row.map((letterBox, colIndex) => (
                <div key={colIndex} className="letter-container">
                  <input
                    type="text"
                    value={letterBox.letter}
                    onChange={(e) => handleLetterInput(rowIndex, colIndex, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                    className={getLetterClassName(letterBox)}
                    maxLength={1}
                    data-row={rowIndex}
                    data-col={colIndex}
                  />
                  {letterBox.letter && (
                    <div 
                      className="state-overlay"
                      onClick={() => cycleLetterState(rowIndex, colIndex)}
                      title={`Click to change state of ${letterBox.letter}`}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => clearRow(rowIndex)}
              className="clear-row-btn"
              title="Clear this row"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="grid-instructions">
        <p>Type letters in each box, then click on letters to cycle through states</p>
        <div className="state-legend">
          <span className="legend-item">
            <span className="legend-color legend-color--not-guessed"></span>
            Not marked yet
          </span>
          <span className="legend-item">
            <span className="legend-color legend-color--not-in-word"></span>
            Not in word
          </span>
          <span className="legend-item">
            <span className="legend-color legend-color--in-word-wrong-position"></span>
            Wrong position
          </span>
          <span className="legend-item">
            <span className="legend-color legend-color--in-word-correct-position"></span>
            Correct position
          </span>
        </div>
      </div>
    </div>
  );
};

export default WordGuessArea;
