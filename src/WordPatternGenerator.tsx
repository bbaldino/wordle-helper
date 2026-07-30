import React from 'react';
import { LetterBox, analyzeConstraints, validateWord } from './wordConstraints';
import './WordPatternGenerator.css';

interface WordPatternGeneratorProps {
  grid: LetterBox[][];
  wordIdeas?: string[];
}

const WordPatternGenerator: React.FC<WordPatternGeneratorProps> = ({ grid, wordIdeas = [] }) => {
  const [eliminatedPatterns, setEliminatedPatterns] = React.useState<Set<string>>(new Set());

  const togglePatternElimination = (pattern: string) => {
    setEliminatedPatterns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pattern)) {
        newSet.delete(pattern);
      } else {
        newSet.add(pattern);
      }
      return newSet;
    });
  };

  const generatePatterns = (): string[] => {
    const constraints = analyzeConstraints(grid);
    
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

  const formatPatternDisplay = (pattern: string, hasMatch: boolean): React.ReactElement => {
    return (
      <div className={`pattern-display ${hasMatch ? 'pattern-display--matched' : ''}`}>
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

  const constraints = analyzeConstraints(grid);
  const patterns = generatePatterns();

  // Check if a word matches a pattern
  const wordMatchesPattern = (word: string, pattern: string): boolean => {
    if (word.length !== pattern.length) return false;

    for (let i = 0; i < word.length; i++) {
      // If pattern has a letter (not blank), word must match that letter
      if (pattern[i] !== '_' && word[i].toUpperCase() !== pattern[i]) {
        return false;
      }
    }
    return true;
  };

  // Check if a word is still valid given current constraints
  const isWordValid = (word: string): boolean => validateWord(word, constraints).valid;

  // Filter to only valid word ideas, then find which patterns have matches
  const validWordIdeas = wordIdeas.filter(isWordValid);
  const patternsWithMatches = new Set<string>();
  validWordIdeas.forEach(word => {
    patterns.forEach(pattern => {
      if (wordMatchesPattern(word, pattern)) {
        patternsWithMatches.add(pattern);
      }
    });
  });

  // Sort patterns: active patterns first, then eliminated patterns at the bottom
  const sortedPatterns = [...patterns].sort((a, b) => {
    const aEliminated = eliminatedPatterns.has(a);
    const bEliminated = eliminatedPatterns.has(b);

    if (aEliminated === bEliminated) return 0;
    return aEliminated ? 1 : -1; // Eliminated patterns go to the bottom
  });

  return (
    <div className="word-pattern-generator">
      <div className="pattern-header">
        <h3>Possible Word Patterns</h3>
        <p>Based on your guesses, here are the possible letter combinations:</p>
      </div>

      <div className="patterns-container">
        {patterns.length === 0 ? (
          <div className="no-patterns">
            {constraints.excludedLetters.size > 0 ? (
              <p>No positional information yet — mark a green or yellow letter to generate patterns. Eliminated letters are shown on the keyboard above.</p>
            ) : (
              <p>No patterns available yet. Mark some letter states in your guesses above to generate patterns!</p>
            )}
          </div>
        ) : (
          <>
            <div className="patterns-count">
              <strong>{patterns.length}</strong> possible pattern{patterns.length !== 1 ? 's' : ''} found:
            </div>
            <div className="patterns-list">
              {sortedPatterns.map((pattern, index) => {
                const isEliminated = eliminatedPatterns.has(pattern);
                const hasMatch = patternsWithMatches.has(pattern);
                return (
                  <div
                    key={index}
                    className={`pattern-item ${isEliminated ? 'pattern-item--eliminated' : ''}`}
                  >
                    {formatPatternDisplay(pattern, hasMatch)}
                    <button
                      className="pattern-eliminate-btn"
                      onClick={() => togglePatternElimination(pattern)}
                      aria-label={isEliminated ? 'Restore pattern' : 'Eliminate pattern'}
                      title={isEliminated ? (hasMatch ? 'Click to restore (matches a word idea)' : 'Click to restore') : (hasMatch ? 'Click to eliminate (matches a word idea)' : 'Click to eliminate')}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
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
