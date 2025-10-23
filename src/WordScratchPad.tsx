import React, { useState } from 'react';
import './WordScratchPad.css';

interface LetterBox {
  letter: string;
  state: string;
}

interface WordScratchPadProps {
  grid: LetterBox[][];
}

const WordScratchPad: React.FC<WordScratchPadProps> = ({ grid }) => {
  const [wordIdeas, setWordIdeas] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);

  // Get all letters that have been guessed
  const getGuessedLetters = (): Set<string> => {
    const guessed = new Set<string>();
    grid.forEach(row => {
      row.forEach(box => {
        if (box.letter) {
          guessed.add(box.letter.toUpperCase());
        }
      });
    });
    return guessed;
  };

  // Calculate letter frequency from word ideas, excluding already guessed letters
  const calculateLetterFrequency = (): { letter: string; count: number }[] => {
    const guessedLetters = getGuessedLetters();
    const frequency: { [key: string]: number } = {};

    wordIdeas.forEach(word => {
      const lettersInWord = new Set<string>(); // Track unique letters per word
      word.split('').forEach(letter => {
        const upperLetter = letter.toUpperCase();
        if (!guessedLetters.has(upperLetter)) {
          lettersInWord.add(upperLetter);
        }
      });
      // Count each unique letter once per word
      lettersInWord.forEach(letter => {
        frequency[letter] = (frequency[letter] || 0) + 1;
      });
    });

    return Object.entries(frequency)
      .map(([letter, count]) => ({ letter, count }))
      .sort((a, b) => b.count - a.count);
  };

  const handleAddWord = () => {
    const trimmedWord = currentInput.trim().toUpperCase();
    if (trimmedWord && trimmedWord.length <= 5 && !wordIdeas.includes(trimmedWord)) {
      setWordIdeas([...wordIdeas, trimmedWord]);
      setCurrentInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddWord();
    }
  };

  const handleRemoveWord = (wordToRemove: string) => {
    setWordIdeas(wordIdeas.filter(word => word !== wordToRemove));
  };

  const handleClearAll = () => {
    setShowClearModal(true);
  };

  const confirmClearAll = () => {
    setWordIdeas([]);
    setShowClearModal(false);
  };

  const cancelClearAll = () => {
    setShowClearModal(false);
  };

  return (
    <div className="word-scratch-pad">
      <div className="scratch-pad-header">
        <h3>Word Ideas</h3>
        <p>Keep track of potential words to try</p>
      </div>

      <div className="word-input-area">
        <input
          type="text"
          className="word-input"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value.slice(0, 5))}
          onKeyPress={handleKeyPress}
          placeholder="Enter a word..."
          maxLength={5}
        />
        <button
          className="add-word-btn"
          onClick={handleAddWord}
          disabled={!currentInput.trim()}
        >
          Add
        </button>
      </div>

      {wordIdeas.length > 0 && (
        <>
          <div className="word-ideas-container">
            <div className="word-ideas-header">
              <span className="word-count">{wordIdeas.length} word{wordIdeas.length !== 1 ? 's' : ''}</span>
              <button className="clear-all-btn" onClick={handleClearAll}>
                Clear all
              </button>
            </div>
            <div className="word-ideas-list">
              {wordIdeas.map((word, index) => (
                <div key={index} className="word-idea-item">
                  <span className="word-idea-text">{word}</span>
                  <button
                    className="remove-word-btn"
                    onClick={() => handleRemoveWord(word)}
                    aria-label="Remove word"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {(() => {
            const letterFrequency = calculateLetterFrequency();
            return letterFrequency.length > 0 ? (
              <div className="letter-frequency-container">
                <div className="frequency-header">
                  <h4>Unguessed Letter Frequency</h4>
                  <p>Letters that appear in your word ideas but haven't been guessed yet</p>
                </div>
                <div className="frequency-list">
                  {letterFrequency.map(({ letter, count }) => (
                    <div key={letter} className="frequency-item">
                      <span className="frequency-letter">{letter}</span>
                      <div className="frequency-bar-container">
                        <div
                          className="frequency-bar"
                          style={{
                            width: `${(count / wordIdeas.length) * 100}%`
                          }}
                        />
                      </div>
                      <span className="frequency-count">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="frequency-hint">
                  <strong>Tip:</strong> Try guessing words with these letters to narrow down your options!
                </div>
              </div>
            ) : null;
          })()}
        </>
      )}

      {wordIdeas.length === 0 && (
        <div className="empty-state">
          <p>No word ideas yet. Add some words to keep track of them!</p>
        </div>
      )}

      {showClearModal && (
        <div className="modal-overlay" onClick={cancelClearAll}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Clear All Word Ideas?</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to clear all {wordIdeas.length} word{wordIdeas.length !== 1 ? 's' : ''}? This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={cancelClearAll}>
                Cancel
              </button>
              <button className="modal-btn modal-btn-confirm" onClick={confirmClearAll}>
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordScratchPad;
