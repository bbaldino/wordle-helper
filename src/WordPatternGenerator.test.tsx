import React from 'react'
import { render } from '@testing-library/react'
import { LetterState } from './LetterState'
import WordPatternGenerator, { heatColorForRatio, matchRatioForCount } from './WordPatternGenerator'

interface LetterBox {
  letter: string
  state: LetterState
}

/** Build a single grid row from pairs like ['C', 'not-in-word']. */
const row = (...cells: Array<[string, LetterState]>): LetterBox[] =>
  cells.map(([letter, state]) => ({ letter, state }))

describe('heatColorForRatio', () => {
  test('returns a valid HSL color string', () => {
    expect(heatColorForRatio(0)).toMatch(/^hsl\(-?\d+(\.\d+)?, 85%, 50%\)$/)
    expect(heatColorForRatio(1)).toMatch(/^hsl\(-?\d+(\.\d+)?, 85%, 50%\)$/)
  })

  test('ratio 0 and ratio 1 produce different colors', () => {
    expect(heatColorForRatio(0)).not.toBe(heatColorForRatio(1))
  })

  test('hue is monotonically warmer (closer to 0/red) as ratio increases', () => {
    const hueOf = (color: string): number => {
      const match = color.match(/^hsl\((-?\d+(?:\.\d+)?), /)
      if (!match) throw new Error(`Could not parse hue from ${color}`)
      return parseFloat(match[1])
    }

    const ratios = [0, 0.25, 0.5, 0.75, 1]
    const hues = ratios.map((ratio) => hueOf(heatColorForRatio(ratio)))

    for (let i = 1; i < hues.length; i++) {
      // Higher ratio => hue walks down toward 0 (red), i.e. strictly decreasing.
      expect(hues[i]).toBeLessThan(hues[i - 1])
    }
  })

  test('clamps ratios below 0 and above 1', () => {
    expect(heatColorForRatio(-5)).toBe(heatColorForRatio(0))
    expect(heatColorForRatio(5)).toBe(heatColorForRatio(1))
  })
})

describe('matchRatioForCount', () => {
  test('a pattern with no matches has ratio 0', () => {
    expect(matchRatioForCount(0, 0)).toBe(0)
    expect(matchRatioForCount(0, 5)).toBe(0)
  })

  test('when every matched pattern shares the same single count, ratio stays low (cool)', () => {
    // maxCount <= 1 means no pattern out-draws another, so even a matched
    // pattern should read cool rather than pinning to full-hot red.
    expect(matchRatioForCount(1, 1)).toBeLessThan(0.5)
    expect(matchRatioForCount(1, 1)).toBeGreaterThan(0)
  })

  test('normalizes against maxCount once matches diverge', () => {
    expect(matchRatioForCount(2, 4)).toBeCloseTo(0.5)
    expect(matchRatioForCount(4, 4)).toBe(1)
  })
})

describe('WordPatternGenerator heatmap rendering', () => {
  // Single yellow 'A' (not in position 0) with no greens generates every
  // remaining-position pattern: _A___, __A__, ___A_, ____A (alphabetical).
  const grid: LetterBox[][] = [row(['A', 'in-word-wrong-position'])]

  test('an unmatched pattern renders with no glow style', () => {
    const { container } = render(<WordPatternGenerator grid={grid} wordIdeas={[]} />)
    const displays = container.querySelectorAll('.pattern-display')
    expect(displays.length).toBeGreaterThan(0)
    displays.forEach((el) => {
      const style = (el as HTMLElement).style
      expect(style.boxShadow).toBe('')
    })
  })

  test('the pattern with more matching word ideas gets a warmer glow than one with fewer', () => {
    // 'XBAXX' and 'YYAYY' both put A at index 2 -> matches pattern __A__ (count 2).
    // 'ZZZAZ' puts A at index 3 -> matches pattern ___A_ (count 1).
    const wordIdeas = ['XBAXX', 'YYAYY', 'ZZZAZ']
    const { container } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)

    const displays = Array.from(container.querySelectorAll('.pattern-display')) as HTMLElement[]
    // Sorted alphabetically: _A___ (0), __A__ (2), ___A_ (1), ____A (0)
    const [unmatchedFirst, hottest, warm, unmatchedLast] = displays

    expect(unmatchedFirst.style.boxShadow).toBe('')
    expect(unmatchedLast.style.boxShadow).toBe('')

    expect(hottest.style.boxShadow).not.toBe('')
    expect(warm.style.boxShadow).not.toBe('')

    // The hotter pattern (higher ratio) should have a larger blur/spread glow.
    const blurOf = (boxShadow: string): number => {
      const match = boxShadow.match(/0 0 (\d+(?:\.\d+)?)px/)
      if (!match) throw new Error(`Could not parse blur from ${boxShadow}`)
      return parseFloat(match[1])
    }
    expect(blurOf(hottest.style.boxShadow)).toBeGreaterThan(blurOf(warm.style.boxShadow))
  })

  test('eliminate button title reflects the match count, singular and plural', () => {
    const wordIdeas = ['ZZZAZ']
    const { getAllByRole } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)
    const buttons = getAllByRole('button', { name: 'Eliminate pattern' })
    const titles = buttons.map((b) => b.getAttribute('title'))

    expect(titles).toContain('Click to eliminate (matches 1 word idea)')
    expect(titles.some((t) => t === 'Click to eliminate')).toBe(true)
  })
})
