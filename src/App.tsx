import React, { useState } from 'react';
import './App.css';
import WordGuessArea, { LetterBox } from './WordGuessArea';
import WordPatternGenerator from './WordPatternGenerator';

function App() {
  // Store the grid data for pattern generation
  const [grid, setGrid] = useState<LetterBox[][]>([]);

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
          onGridChange={handleGridChange}
        />
        <WordPatternGenerator grid={grid} />
      </main>
    </div>
  );
}

export default App;
