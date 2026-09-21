import React from 'react'
import { LetterBox, analyzeConstraints, validateWord } from './wordConstraints'
import './WordPatternGenerator.css'

interface WordPatternGeneratorProps {
  grid: LetterBox[][]
  wordIdeas?: string[]
}

const clampRatio = (ratio: number): number => Math.min(1, Math.max(0, ratio))

/**
 * Hue (in degrees) for a given heat ratio, walking from cool blue (~210°)
 * down through green/amber to hot red (0°) as ratio approaches 1.
 * Shared by `heatColorForRatio` and the glow/background colors so they all
 * agree on the same ramp.
 */
const heatHueForRatio = (ratio: number): number => 210 - clampRatio(ratio) * 210

/**
 * Maps a normalized match ratio in [0, 1] to an HSL color string, cool blue
 * at ratio 0 and hot red at ratio 1. Out-of-range input is clamped.
 */
export const heatColorForRatio = (ratio: number): string => {
  const hue = heatHueForRatio(ratio)
  return `hsl(${hue}, 85%, 50%)`
}

/**
 * Normalizes a pattern's match count into the ratio fed to `heatColorForRatio`.
 *
 * When `maxCount` is 0 or 1, every matched pattern has the same (single)
 * count, so no pattern actually out-draws another — they should all read
 * cool rather than all pinning to full-hot red. We anchor that case to a
 * low constant instead of `count / maxCount` (which would otherwise be 1).
 */
export const matchRatioForCount = (count: number, maxCount: number): number => {
  if (count <= 0) return 0
  return maxCount <= 1 ? 0.15 : count / maxCount
}

const WordPatternGenerator: React.FC<WordPatternGeneratorProps> = ({ grid, wordIdeas = [] }) => {
  const [eliminatedPatterns, setEliminatedPatterns] = React.useState<Set<string>>(new Set())

  const togglePatternElimination = (pattern: string) => {
    setEliminatedPatterns((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(pattern)) {
        newSet.delete(pattern)
      } else {
        newSet.add(pattern)
      }
      return newSet
    })
  }

  const generatePatterns = (): string[] => {
    const constraints = analyzeConstraints(grid)

    // If no constraints exist, return empty array
    if (
      Object.keys(constraints.confirmedPositions).length === 0 &&
      constraints.mustIncludeLetters.size === 0
    ) {
      return []
    }

    const patterns: string[] = []

    // Generate all possible arrangements of the yellow letters in available positions
    const generateArrangements = (
      currentPattern: string[],
      remainingLetters: string[],
      usedPositions: Set<number>,
    ): void => {
      if (remainingLetters.length === 0) {
        // Fill remaining positions with blanks and add to patterns
        const finalPattern = [...currentPattern]
        for (let i = 0; i < 5; i++) {
          if (!finalPattern[i]) {
            finalPattern[i] = '_'
          }
        }
        patterns.push(finalPattern.join(''))
        return
      }

      const letter = remainingLetters[0]
      const restLetters = remainingLetters.slice(1)

      // Try placing this letter in each available position
      for (let pos = 0; pos < 5; pos++) {
        // Skip if position is already confirmed or used
        if (constraints.confirmedPositions[pos] || usedPositions.has(pos)) {
          continue
        }

        // Skip if this letter can't be in this position (wrong position constraint)
        if (constraints.wrongPositions[letter]?.has(pos)) {
          continue
        }

        // Place letter and continue with remaining letters
        const newPattern = [...currentPattern]
        newPattern[pos] = letter
        const newUsedPositions = new Set(usedPositions)
        newUsedPositions.add(pos)

        generateArrangements(newPattern, restLetters, newUsedPositions)
      }
    }

    // Start with confirmed positions (greens first)
    const basePattern: string[] = new Array(5).fill('')
    const usedPositions = new Set<number>()

    // Place confirmed letters (green)
    Object.entries(constraints.confirmedPositions).forEach(([pos, letter]) => {
      const idx = parseInt(pos)
      basePattern[idx] = letter
      usedPositions.add(idx)
    })

    // Build a multiset of letters still needing placement (duplicates supported)
    // Count already-placed greens directly from confirmedPositions for robustness
    const placedCountByLetter: Record<string, number> = {}
    Object.values(constraints.confirmedPositions).forEach((ch) => {
      placedCountByLetter[ch] = (placedCountByLetter[ch] || 0) + 1
    })

    const toPlace: string[] = []
    Object.entries(constraints.requiredCounts).forEach(([letter, req]) => {
      const alreadyPlaced = placedCountByLetter[letter] || 0
      const remain = req - alreadyPlaced
      for (let i = 0; i < remain; i++) {
        if (remain > 0) toPlace.push(letter)
      }
    })

    // Generate arrangements for remaining letters (including duplicates)
    generateArrangements(basePattern, toPlace, usedPositions)

    // Fallback: if no patterns were generated and there were no remaining letters to place,
    // still return the base pattern with blanks (e.g., only greens known)
    if (patterns.length === 0 && toPlace.length === 0) {
      const finalPattern = [...basePattern]
      for (let i = 0; i < 5; i++) {
        if (!finalPattern[i]) {
          finalPattern[i] = '_'
        }
      }
      patterns.push(finalPattern.join(''))
    }

    // Remove duplicates and sort
    return Array.from(new Set(patterns)).sort()
  }

  const formatPatternDisplay = (
    pattern: string,
    ratio: number,
    count: number,
  ): React.ReactElement => {
    const style: React.CSSProperties = {}

    if (count > 0) {
      const hue = heatHueForRatio(ratio)
      const blur = 6 + ratio * 14
      const spread = 1 + ratio * 3
      const glowOpacity = 0.25 + ratio * 0.45
      const bgOpacity = 0.08 + ratio * 0.12

      style.borderColor = `hsl(${hue}, 85%, 50%)`
      style.backgroundColor = `hsla(${hue}, 85%, 50%, ${bgOpacity})`
      style.boxShadow = `0 0 ${blur}px ${spread}px hsla(${hue}, 85%, 50%, ${glowOpacity})`
    }

    return (
      <div className="pattern-display" style={style}>
        {pattern.split('').map((char, index) => (
          <div
            key={index}
            className={`pattern-cell ${char === '_' ? 'pattern-cell--blank' : 'pattern-cell--letter'}`}
          >
            {char === '_' ? '' : char}
          </div>
        ))}
      </div>
    )
  }

  const constraints = analyzeConstraints(grid)
  const patterns = generatePatterns()

  // Check if a word matches a pattern
  const wordMatchesPattern = (word: string, pattern: string): boolean => {
    if (word.length !== pattern.length) return false

    for (let i = 0; i < word.length; i++) {
      // If pattern has a letter (not blank), word must match that letter
      if (pattern[i] !== '_' && word[i].toUpperCase() !== pattern[i]) {
        return false
      }
    }
    return true
  }

  // Check if a word is still valid given current constraints
  const isWordValid = (word: string): boolean => validateWord(word, constraints).valid

  // Filter to only valid word ideas, then count how many match each pattern
  const validWordIdeas = wordIdeas.filter(isWordValid)
  const matchCountByPattern = new Map<string, number>()
  validWordIdeas.forEach((word) => {
    patterns.forEach((pattern) => {
      if (wordMatchesPattern(word, pattern)) {
        matchCountByPattern.set(pattern, (matchCountByPattern.get(pattern) || 0) + 1)
      }
    })
  })
  const maxCount = Math.max(...Array.from(matchCountByPattern.values()), 0)

  // Sort patterns: active patterns first, then eliminated patterns at the bottom
  const sortedPatterns = [...patterns].sort((a, b) => {
    const aEliminated = eliminatedPatterns.has(a)
    const bEliminated = eliminatedPatterns.has(b)

    if (aEliminated === bEliminated) return 0
    return aEliminated ? 1 : -1 // Eliminated patterns go to the bottom
  })

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
              <p>
                No positional information yet — mark a green or yellow letter to generate patterns.
                Eliminated letters are shown on the keyboard above.
              </p>
            ) : (
              <p>
                No patterns available yet. Mark some letter states in your guesses above to generate
                patterns!
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="patterns-count">
              <strong>{patterns.length}</strong> possible pattern{patterns.length !== 1 ? 's' : ''}{' '}
              found:
            </div>
            <div className="patterns-list">
              {sortedPatterns.map((pattern, index) => {
                const isEliminated = eliminatedPatterns.has(pattern)
                const count = matchCountByPattern.get(pattern) || 0
                const ratio = matchRatioForCount(count, maxCount)
                const matchSuffix =
                  count > 0 ? ` (matches ${count} word idea${count === 1 ? '' : 's'})` : ''
                return (
                  <div
                    key={index}
                    className={`pattern-item ${isEliminated ? 'pattern-item--eliminated' : ''}`}
                  >
                    {formatPatternDisplay(pattern, ratio, count)}
                    <button
                      className="pattern-eliminate-btn"
                      onClick={() => togglePatternElimination(pattern)}
                      aria-label={isEliminated ? 'Restore pattern' : 'Eliminate pattern'}
                      title={
                        isEliminated
                          ? `Click to restore${matchSuffix}`
                          : `Click to eliminate${matchSuffix}`
                      }
                    >
                      ×
                    </button>
                  </div>
                )
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
        <div className="legend-item">
          <div className="legend-cell legend-cell--heatmap"></div>
          <span>More word ideas</span>
        </div>
      </div>
    </div>
  )
}

export default WordPatternGenerator
