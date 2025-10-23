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
  const [validationError, setValidationError] = useState<string>('');

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

  // Validate word against grid constraints
  const validateWord = (word: string): { valid: boolean; error: string } => {
    const upperWord = word.toUpperCase();

    // Build constraints from grid
    const excludedLetters = new Set<string>();
    const requiredLetters = new Set<string>();
    const confirmedPositions: { [pos: number]: string } = {};
    const wrongPositions: { [letter: string]: Set<number> } = {};

    grid.forEach(row => {
      row.forEach((box, colIndex) => {
        if (!box.letter) return;
        const letter = box.letter.toUpperCase();

        switch (box.state) {
          case 'in-word-correct-position':
            confirmedPositions[colIndex] = letter;
            requiredLetters.add(letter);
            break;
          case 'in-word-wrong-position':
            requiredLetters.add(letter);
            if (!wrongPositions[letter]) {
              wrongPositions[letter] = new Set();
            }
            wrongPositions[letter].add(colIndex);
            break;
          case 'not-in-word':
            // Only exclude if letter never appears as green or yellow
            const letterInWord = Array.from(grid.flat()).some(
              b => b.letter?.toUpperCase() === letter &&
                   (b.state === 'in-word-correct-position' || b.state === 'in-word-wrong-position')
            );
            if (!letterInWord) {
              excludedLetters.add(letter);
            }
            break;
        }
      });
    });

    // Check for excluded letters
    for (let i = 0; i < upperWord.length; i++) {
      const letter = upperWord[i];
      if (excludedLetters.has(letter)) {
        return {
          valid: false,
          error: `Letter '${letter}' is marked as not in the word`
        };
      }
    }

    // Check confirmed positions
    for (const [pos, letter] of Object.entries(confirmedPositions)) {
      const position = parseInt(pos);
      if (upperWord[position] !== letter) {
        return {
          valid: false,
          error: `Position ${position + 1} must be '${letter}'`
        };
      }
    }

    // Check wrong positions
    for (const [letter, positions] of Object.entries(wrongPositions)) {
      for (const pos of Array.from(positions)) {
        if (upperWord[pos] === letter) {
          return {
            valid: false,
            error: `Letter '${letter}' cannot be at position ${pos + 1}`
          };
        }
      }
    }

    // Check required letters are present
    for (const letter of Array.from(requiredLetters)) {
      if (!upperWord.includes(letter)) {
        return {
          valid: false,
          error: `Word must contain letter '${letter}'`
        };
      }
    }

    return { valid: true, error: '' };
  };

  const handleAddWord = () => {
    const trimmedWord = currentInput.trim().toUpperCase();

    // Clear any previous validation error
    setValidationError('');

    if (!trimmedWord) return;

    if (trimmedWord.length !== 5) {
      setValidationError('Word must be exactly 5 letters');
      return;
    }

    if (wordIdeas.includes(trimmedWord)) {
      setValidationError('This word is already in your list');
      return;
    }

    // Validate against grid constraints
    const validation = validateWord(trimmedWord);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    // All checks passed, add the word
    setWordIdeas([...wordIdeas, trimmedWord]);
    setCurrentInput('');
  };

  const handleInputChange = (value: string) => {
    setCurrentInput(value.slice(0, 5));
    // Clear error when user starts typing
    if (validationError) {
      setValidationError('');
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

      <div className="word-input-section">
        <div className="word-input-area">
          <input
            type="text"
            className={`word-input ${validationError ? 'word-input--error' : ''}`}
            value={currentInput}
            onChange={(e) => handleInputChange(e.target.value)}
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
        {validationError && (
          <div className="validation-error">
            <svg className="error-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M8 4V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="8" cy="12" r="0.5" fill="currentColor" />
            </svg>
            <span>{validationError}</span>
          </div>
        )}
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
