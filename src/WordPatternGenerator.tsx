import React from 'react';
import { LetterState } from './WordleKeyboard';
import './WordPatternGenerator.css';

interface LetterBox {
  letter: string;
  state: LetterState;
}

interface WordPatternGeneratorProps {
  grid: LetterBox[][];
}

interface Constraints {
  confirmedPositions: { [position: number]: string }; // Green letters in confirmed positions
  mustIncludeLetters: Set<string>; // Letters that still need additional placements beyond greens
  excludedLetters: Set<string>; // Gray letters that must be excluded
  wrongPositions: { [letter: string]: Set<number> }; // Letters that can't be in certain positions
  requiredCounts: Record<string, number>; // Minimum required count per letter (from greens/yellows)
}

const WordPatternGenerator: React.FC<WordPatternGeneratorProps> = ({ grid }) => {
  const analyzeConstraints = (): Constraints => {
    const constraints: Constraints = {
      confirmedPositions: {},
      mustIncludeLetters: new Set(),
      excludedLetters: new Set(),
      wrongPositions: {},
      requiredCounts: {}
    };

    // Track global evidence per letter to resolve conflicts properly
    const letterHasGreen = new Set<string>();
    const letterHasYellow = new Set<string>();
    const letterHasGray = new Set<string>();
    // We do not sum greens across rows (different guesses). The minimal
    // required count for a letter is the maximum number of present occurrences
    // (yellow+green) seen in any single row/guess.

    // Analyze each cell in the grid
    grid.forEach((row) => {
      row.forEach((letterBox, colIndex) => {
        if (!letterBox.letter) return; // Skip empty boxes

        const letter = letterBox.letter.toUpperCase();

        switch (letterBox.state) {
          case 'in-word-correct-position': {
            // Green: Letter is confirmed in this position
            constraints.confirmedPositions[colIndex] = letter;
            letterHasGreen.add(letter);
            break;
          }
          case 'in-word-wrong-position': {
            // Yellow: Letter is in the word but not in this position
            letterHasYellow.add(letter);
            if (!constraints.wrongPositions[letter]) {
              constraints.wrongPositions[letter] = new Set();
            }
            constraints.wrongPositions[letter].add(colIndex);
            break;
          }
          case 'not-in-word': {
            // Gray: Track, but only exclude if we never saw yellow/green
            letterHasGray.add(letter);
            break;
          }
          // 'not-guessed' state is ignored for pattern generation
        }
      });
    });

    // Build requiredCounts by taking, for each row, the number of present (yellow/green) occurrences per letter,
    // and keeping the maximum across rows. Also ensure it's at least the total number of greens for that letter.
    grid.forEach((row) => {
      const rowPresent: Record<string, number> = {};
      row.forEach((letterBox) => {
        if (!letterBox.letter) return;
        const letter = letterBox.letter.toUpperCase();
        if (letterBox.state === 'in-word-correct-position' || letterBox.state === 'in-word-wrong-position') {
          rowPresent[letter] = (rowPresent[letter] || 0) + 1;
        }
      });
      Object.entries(rowPresent).forEach(([letter, count]) => {
        constraints.requiredCounts[letter] = Math.max(constraints.requiredCounts[letter] || 0, count);
      });
    });
    // Build must-include letters for display: letters that had yellow evidence
    // (present but not necessarily placed). This is UI-only and does not affect generation.
    letterHasYellow.forEach((letter) => {
      if ((constraints.requiredCounts[letter] || 0) > 0) {
        constraints.mustIncludeLetters.add(letter);
      }
    });

    // Build excluded set: letters seen as gray AND never seen as yellow nor green
    letterHasGray.forEach((letter) => {
      if (!letterHasGreen.has(letter) && !letterHasYellow.has(letter)) {
        constraints.excludedLetters.add(letter);
      }
    });

    return constraints;
  };

  const generatePatterns = (): string[] => {
    const constraints = analyzeConstraints();
    
    // If no constraints exist, return empty array
    if (Object.keys(constraints.confirmedPositions).length === 0 && 
        constraints.mustIncludeLetters.size === 0) {
      return [];
    }

    const patterns: string[] = [];

    // Generate all possible arrangements of the yellow letters in available positions
    const generateArrangements = (currentPattern: string[], remainingLetters: string[], usedPositions: Set<number>): void => {
      if (remainingLetters.length === 0) {
        // Fill remaining positions with blanks and add to patterns
        const finalPattern = [...currentPattern];
        for (let i = 0; i < 5; i++) {
          if (!finalPattern[i]) {
            finalPattern[i] = '_';
          }
        }
        patterns.push(finalPattern.join(''));
        return;
      }

      const letter = remainingLetters[0];
      const restLetters = remainingLetters.slice(1);

      // Try placing this letter in each available position
      for (let pos = 0; pos < 5; pos++) {
        // Skip if position is already confirmed or used
        if (constraints.confirmedPositions[pos] || usedPositions.has(pos)) {
          continue;
        }
        
        // Skip if this letter can't be in this position (wrong position constraint)
        if (constraints.wrongPositions[letter]?.has(pos)) {
          continue;
        }

        // Place letter and continue with remaining letters
        const newPattern = [...currentPattern];
        newPattern[pos] = letter;
        const newUsedPositions = new Set(usedPositions);
        newUsedPositions.add(pos);
        
        generateArrangements(newPattern, restLetters, newUsedPositions);
      }
    };

    // Start with confirmed positions (greens first)
    const basePattern: string[] = new Array(5).fill('');
    const usedPositions = new Set<number>();

    // Place confirmed letters (green)
    Object.entries(constraints.confirmedPositions).forEach(([pos, letter]) => {
      const idx = parseInt(pos);
      basePattern[idx] = letter;
      usedPositions.add(idx);
    });

    // Build a multiset of letters still needing placement (duplicates supported)
    // Count already-placed greens directly from confirmedPositions for robustness
    const placedCountByLetter: Record<string, number> = {};
    Object.values(constraints.confirmedPositions).forEach((ch) => {
      placedCountByLetter[ch] = (placedCountByLetter[ch] || 0) + 1;
    });

    const toPlace: string[] = [];
    Object.entries(constraints.requiredCounts).forEach(([letter, req]) => {
      const alreadyPlaced = placedCountByLetter[letter] || 0;
      const remain = req - alreadyPlaced;
      for (let i = 0; i < remain; i++) {
        if (remain > 0) toPlace.push(letter);
      }
    });

    // Generate arrangements for remaining letters (including duplicates)
    generateArrangements(basePattern, toPlace, usedPositions);

    // Fallback: if no patterns were generated and there were no remaining letters to place,
    // still return the base pattern with blanks (e.g., only greens known)
    if (patterns.length === 0 && toPlace.length === 0) {
      const finalPattern = [...basePattern];
      for (let i = 0; i < 5; i++) {
        if (!finalPattern[i]) {
          finalPattern[i] = '_';
        }
      }
      patterns.push(finalPattern.join(''));
    }
    
    // Remove duplicates and sort
    return Array.from(new Set(patterns)).sort();
  };

  const formatPatternDisplay = (pattern: string): React.ReactElement => {
    return (
      <div className="pattern-display">
        {pattern.split('').map((char, index) => (
          <div 
            key={index} 
            className={`pattern-cell ${char === '_' ? 'pattern-cell--blank' : 'pattern-cell--letter'}`}
          >
            {char === '_' ? '' : char}
          </div>
        ))}
      </div>
    );
  };

  const constraints = analyzeConstraints();
  const patterns = generatePatterns();

  return (
    <div className="word-pattern-generator">
      <div className="pattern-header">
        <h3>Possible Word Patterns</h3>
        <p>Based on your guesses, here are the possible letter combinations:</p>
      </div>

      <div className="constraints-summary">
        {Object.keys(constraints.confirmedPositions).length > 0 && (
          <div className="constraint-group">
            <strong>Confirmed positions:</strong>
            <div className="confirmed-letters">
              {Object.entries(constraints.confirmedPositions).map(([pos, letter]) => (
                <span key={pos} className="confirmed-letter">
                  {letter} at position {parseInt(pos) + 1}
                </span>
              ))}
            </div>
          </div>
        )}

        {constraints.mustIncludeLetters.size > 0 && (
          <div className="constraint-group">
            <strong>Must include letters:</strong>
            <div className="must-include-letters">
              {Array.from(constraints.mustIncludeLetters).map(letter => (
                <span key={letter} className="must-include-letter">
                  {letter}
                </span>
              ))}
            </div>
          </div>
        )}

        {constraints.excludedLetters.size > 0 && (
          <div className="constraint-group">
            <strong>Excluded letters:</strong>
            <div className="excluded-letters">
              {Array.from(constraints.excludedLetters).map(letter => (
                <span key={letter} className="excluded-letter">
                  {letter}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="patterns-container">
        {patterns.length === 0 ? (
          <div className="no-patterns">
            <p>No patterns available yet. Mark some letter states in your guesses above to generate patterns!</p>
          </div>
        ) : (
          <>
            <div className="patterns-count">
              <strong>{patterns.length}</strong> possible pattern{patterns.length !== 1 ? 's' : ''} found:
            </div>
            <div className="patterns-list">
              {patterns.map((pattern, index) => (
                <div key={index} className="pattern-item">
                  {formatPatternDisplay(pattern)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="pattern-legend">
        <div className="legend-item">
          <div className="legend-cell legend-cell--filled"></div>
          <span>Known letter</span>
        </div>
        <div className="legend-item">
          <div className="legend-cell legend-cell--blank"></div>
          <span>Unknown position</span>
        </div>
      </div>
    </div>
  );
};

export default WordPatternGenerator;
