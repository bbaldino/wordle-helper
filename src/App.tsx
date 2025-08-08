import React, { useState } from 'react';
import './App.css';
import WordleKeyboard, { LetterState } from './WordleKeyboard';
import WordGuessArea, { LetterBox } from './WordGuessArea';
import WordPatternGenerator from './WordPatternGenerator';

function App() {
  // Store the current letter states to sync between components
  const [letterStates, setLetterStates] = useState<Record<string, LetterState>>({});
  // Store the grid data for pattern generation
  const [grid, setGrid] = useState<LetterBox[][]>([]);

  const handleLetterStateChange = (letter: string, newState: LetterState) => {
    console.log(`Letter ${letter} changed to state: ${newState}`);
    
    // Update the centralized letter states
    setLetterStates(prev => {
      const currentState = prev[letter] || 'not-guessed';
      
      // Priority logic: green > yellow > dark gray > light gray
      // Only update if the new state has higher priority
      const statePriority = {
        'not-guessed': 0,
        'not-in-word': 1,
        'in-word-wrong-position': 2,
        'in-word-correct-position': 3
      };
      
      const currentPriority = statePriority[currentState];
      const newPriority = statePriority[newState];
      
      // Always update if new state has higher priority, or if we're going back to not-guessed
      if (newPriority > currentPriority || newState === 'not-guessed') {
        return {
          ...prev,
          [letter]: newState
        };
      }
      
      return prev;
    });
  };

  const handleGridChange = (newGrid: LetterBox[][]) => {
    setGrid(newGrid);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Wordle Helper</h1>
        <p>Enter your previous guesses and mark letter states to get help with your Wordle puzzle</p>
      </header>
      
      <main className="App-main">
        <WordGuessArea 
          onLetterStateChange={handleLetterStateChange}
          onGridChange={handleGridChange}
        />
        <WordPatternGenerator grid={grid} />
        <WordleKeyboard 
          onLetterStateChange={handleLetterStateChange}
          externalLetterStates={letterStates}
        />
      </main>
    </div>
  );
}

export default App;
