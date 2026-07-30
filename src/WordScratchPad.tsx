import React, { useState } from 'react';
import { LetterBox, analyzeConstraints, validateWord as validateAgainstConstraints } from './wordConstraints';
import './WordScratchPad.css';

interface WordScratchPadProps {
  grid: LetterBox[][];
  wordIdeas: string[];
  onWordIdeasChange: (wordIdeas: string[]) => void;
}

const WordScratchPad: React.FC<WordScratchPadProps> = ({ grid, wordIdeas, onWordIdeasChange }) => {
  const [currentInput, setCurrentInput] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Validate word against grid constraints
  const validateWord = React.useCallback(
    (word: string) => validateAgainstConstraints(word, analyzeConstraints(grid)),
    [grid]
  );

  // Calculate invalid words whenever wordIdeas or validateWord change
  const invalidWords = React.useMemo(() => {
    const invalid = new Set<string>();
    wordIdeas.forEach(word => {
      const validation = validateWord(word);
      if (!validation.valid) {
        invalid.add(word);
      }
    });
    return invalid;
  }, [wordIdeas, validateWord]);

  // Get all letters that have been marked in guesses (any state except not-guessed)
  const getKnownLetters = (): Set<string> => {
    const known = new Set<string>();
    grid.forEach(row => {
      row.forEach(box => {
        if (box.letter && box.state !== 'not-guessed') {
          known.add(box.letter.toUpperCase());
        }
      });
    });
    return known;
  };

  // Calculate letter frequency from valid word ideas only, excluding letters we already have info about
  const calculateLetterFrequency = (): { letter: string; count: number }[] => {
    const knownLetters = getKnownLetters();
    const frequency: { [key: string]: number } = {};

    wordIdeas.forEach(word => {
      // Skip invalid words
      if (invalidWords.has(word)) return;

      const lettersInWord = new Set<string>(); // Track unique letters per word
      word.split('').forEach(letter => {
        const upperLetter = letter.toUpperCase();
        // Only include letters we don't have info about yet
        if (!knownLetters.has(upperLetter)) {
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
    onWordIdeasChange([...wordIdeas, trimmedWord]);
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
    onWordIdeasChange(wordIdeas.filter(word => word !== wordToRemove));
  };

  const handleClearAll = () => {
    setShowClearModal(true);
  };

  const confirmClearAll = () => {
    onWordIdeasChange([]);
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
              <span className="word-count">
                {wordIdeas.length} word{wordIdeas.length !== 1 ? 's' : ''}
                {invalidWords.size > 0 && (
                  <span className="invalid-count"> ({invalidWords.size} invalid)</span>
                )}
              </span>
              <button className="clear-all-btn" onClick={handleClearAll}>
                Clear all
              </button>
            </div>
            <div className="word-ideas-list">
              {wordIdeas.map((word, index) => {
                const isInvalid = invalidWords.has(word);
                return (
                  <div
                    key={index}
                    className={`word-idea-item ${isInvalid ? 'word-idea-item--invalid' : ''}`}
                    title={isInvalid ? 'This word no longer matches the known clues' : ''}
                  >
                    <span className="word-idea-text">{word}</span>
                    <button
                      className="remove-word-btn"
                      onClick={() => handleRemoveWord(word)}
                      aria-label="Remove word"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {(() => {
            const letterFrequency = calculateLetterFrequency();
            return letterFrequency.length > 0 ? (
              <div className="letter-frequency-container">
                <div className="frequency-header">
                  <h4>Unknown Letter Frequency</h4>
                  <p>Letters in your valid word ideas that you haven't tested yet</p>
                </div>
                <div className="frequency-list">
                  {letterFrequency.map(({ letter, count }) => (
                    <div key={letter} className="frequency-item">
                      <span className="frequency-letter">{letter}</span>
                      <div className="frequency-bar-container">
                        <div
                          className="frequency-bar"
                          style={{
                            width: `${(count / (wordIdeas.length - invalidWords.size)) * 100}%`
                          }}
                        />
                      </div>
                      <span className="frequency-count">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="frequency-hint">
                  <strong>Tip:</strong> Letters that appear in more word ideas can help you eliminate multiple possibilities at once!
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
