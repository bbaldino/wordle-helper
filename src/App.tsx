import React, { useState, useEffect } from 'react';
import './App.css';
import WordGuessArea, { LetterBox } from './WordGuessArea';
import WordPatternGenerator from './WordPatternGenerator';
import WordScratchPad from './WordScratchPad';

const STORAGE_KEY_GRID = 'wordle-helper-grid';
const STORAGE_KEY_WORD_IDEAS = 'wordle-helper-word-ideas';

function App() {
  // Load initial state from localStorage
  const [grid, setGrid] = useState<LetterBox[][]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GRID);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load grid from localStorage:', e);
      return [];
    }
  });

  const [wordIdeas, setWordIdeas] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WORD_IDEAS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load word ideas from localStorage:', e);
      return [];
    }
  });

  // Save grid to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GRID, JSON.stringify(grid));
    } catch (e) {
      console.error('Failed to save grid to localStorage:', e);
    }
  }, [grid]);

  // Save word ideas to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WORD_IDEAS, JSON.stringify(wordIdeas));
    } catch (e) {
      console.error('Failed to save word ideas to localStorage:', e);
    }
  }, [wordIdeas]);

  const handleGridChange = (newGrid: LetterBox[][]) => {
    setGrid(newGrid);
  };

  const [showResetModal, setShowResetModal] = useState(false);

  const handleWordIdeasChange = (newWordIdeas: string[]) => {
    setWordIdeas(newWordIdeas);
  };

  const handleResetClick = () => {
    setShowResetModal(true);
  };

  const confirmReset = () => {
    // Clear state
    setGrid([]);
    setWordIdeas([]);
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY_GRID);
    localStorage.removeItem(STORAGE_KEY_WORD_IDEAS);
    localStorage.removeItem('wordle-helper-guess-grid');
    // Reload to reinitialize empty grid
    window.location.reload();
  };

  const cancelReset = () => {
    setShowResetModal(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="header-text">
            <h1>Wordle Helper</h1>
            <p>Enter your previous guesses and mark letter states to get help with your Wordle puzzle</p>
          </div>
          <button className="reset-all-btn" onClick={handleResetClick} title="Clear all data">
            Reset All
          </button>
        </div>
      </header>

      <main className="App-main">
        <WordGuessArea
          onGridChange={handleGridChange}
        />
        <div className="right-column">
          <WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />
          <WordScratchPad grid={grid} wordIdeas={wordIdeas} onWordIdeasChange={handleWordIdeasChange} />
        </div>
      </main>

      {showResetModal && (
        <div className="modal-overlay" onClick={cancelReset}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset All Data?</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to reset all your guesses and word ideas? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={cancelReset}>
                Cancel
              </button>
              <button className="modal-btn modal-btn-confirm modal-btn-danger" onClick={confirmReset}>
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
