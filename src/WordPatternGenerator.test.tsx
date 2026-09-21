import React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('WordPatternGenerator pattern list keying (mobile sticky-hover bug fix)', () => {
  // Single yellow 'A' generates every remaining-position pattern, sorted
  // alphabetically: _A___, __A__, ___A_, ____A.
  const grid: LetterBox[][] = [row(['A', 'in-word-wrong-position'])]
  // 'XBAXX'/'YYAYY' match __A__ (2 matches); 'ZZZAZ' matches ___A_ (1 match);
  // _A___ and ____A have 0 matches.
  const wordIdeas = ['XBAXX', 'YYAYY', 'ZZZAZ']

  test("eliminating one pattern does not leak its state onto another pattern's button", () => {
    const { getAllByRole } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)
    const buttonsBefore = getAllByRole('button', { name: 'Eliminate pattern' })
    expect(buttonsBefore).toHaveLength(4)

    // Capture the actual DOM node for ___A_ (1 match) before eliminating anything.
    const warmPatternButton = buttonsBefore[2]
    const warmPatternTitleBefore = warmPatternButton.getAttribute('title')
    expect(warmPatternTitleBefore).toBe('Click to eliminate (matches 1 word idea)')

    // Eliminate __A__ (2 matches). This re-sorts it to the bottom of the list,
    // shifting ___A_ up one slot in the rendered order.
    fireEvent.click(buttonsBefore[1])

    // If list items were keyed by array index (the bug), React would reuse the
    // DOM node that used to occupy this position for whatever pattern now
    // renders there, mutating this captured node's title to a DIFFERENT
    // pattern's state. Keyed by pattern string (the fix), this exact node
    // keeps representing ___A_ regardless of where it re-sorts to.
    expect(warmPatternButton.getAttribute('title')).toBe(warmPatternTitleBefore)
    expect(warmPatternButton.getAttribute('aria-label')).toBe('Eliminate pattern')

    // The eliminated pattern re-sorts correctly and reflects its own new state.
    const restoreButtons = getAllByRole('button', { name: 'Restore pattern' })
    expect(restoreButtons).toHaveLength(1)
    expect(restoreButtons[0].getAttribute('title')).toBe('Click to restore (matches 2 word ideas)')
  })
})

describe('WordPatternGenerator matching word ideas tooltip', () => {
  // Sorted patterns: _A___ (0 matches), __A__ (2 matches: XBAXX, YYAYY),
  // ___A_ (1 match: ZZZAZ), ____A (0 matches).
  const grid: LetterBox[][] = [row(['A', 'in-word-wrong-position'])]
  const wordIdeas = ['XBAXX', 'YYAYY', 'ZZZAZ']

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  test('hovering a matched pattern for ~1.5s shows a tooltip listing the matching word ideas', () => {
    const { container } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)
    const displays = Array.from(container.querySelectorAll('.pattern-display')) as HTMLElement[]
    const hottest = displays[1] // __A__

    fireEvent.mouseEnter(hottest)
    act(() => {
      jest.advanceTimersByTime(1500)
    })

    const tooltip = hottest.querySelector('.pattern-tooltip')
    expect(tooltip).not.toBeNull()
    expect(tooltip?.textContent).toContain('XBAXX')
    expect(tooltip?.textContent).toContain('YYAYY')
  })

  test('hovering a pattern with no matches shows no tooltip even after the delay', () => {
    const { container } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)
    const displays = Array.from(container.querySelectorAll('.pattern-display')) as HTMLElement[]
    const unmatched = displays[0] // _A___

    fireEvent.mouseEnter(unmatched)
    act(() => {
      jest.advanceTimersByTime(1500)
    })

    expect(unmatched.querySelector('.pattern-tooltip')).toBeNull()
  })

  test('hover-then-leave before the delay elapses does not show the tooltip', () => {
    const { container } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)
    const displays = Array.from(container.querySelectorAll('.pattern-display')) as HTMLElement[]
    const hottest = displays[1] // __A__

    fireEvent.mouseEnter(hottest)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    fireEvent.mouseLeave(hottest)
    act(() => {
      jest.advanceTimersByTime(1500)
    })

    expect(hottest.querySelector('.pattern-tooltip')).toBeNull()
  })

  test('tapping/clicking a matched pattern display toggles the tooltip open then closed', () => {
    const { container } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)
    const displays = Array.from(container.querySelectorAll('.pattern-display')) as HTMLElement[]
    const warm = displays[2] // ___A_

    fireEvent.click(warm)
    expect(warm.querySelector('.pattern-tooltip')).not.toBeNull()

    fireEvent.click(warm)
    expect(warm.querySelector('.pattern-tooltip')).toBeNull()
  })

  test('a single real click/tap on a not-yet-focused pattern opens the tooltip (not open-then-close)', () => {
    // Real browsers (and touch, which synthesizes the same sequence) focus a
    // focusable target as part of mousedown's default action, BEFORE the click
    // that follows fires. `fireEvent.click` in jsdom does NOT reproduce that
    // ordering, so it can't catch a bug where focus (which also opens the
    // tooltip) races the click's own toggle. `userEvent.click` does reproduce
    // it: pointerdown -> mousedown (default focus, unless prevented) -> focus
    // -> pointerup -> mouseup -> click. Without the mousedown preventDefault()
    // fix, this sequence would open the tooltip via focus and then immediately
    // close it via the click's toggle, leaving nothing visible after a single
    // tap -- this test fails against that bug and passes with the fix.
    const { container } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)
    const displays = Array.from(container.querySelectorAll('.pattern-display')) as HTMLElement[]
    const warm = displays[2] // ___A_

    expect(document.activeElement).not.toBe(warm)
    userEvent.click(warm)

    const tooltip = warm.querySelector('.pattern-tooltip')
    expect(tooltip).not.toBeNull()
    expect(tooltip?.textContent).toContain('ZZZAZ')

    userEvent.click(warm)
    expect(warm.querySelector('.pattern-tooltip')).toBeNull()
  })

  test('keyboard focus still opens the tooltip after the click/mousedown fix', () => {
    const { container } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)
    const displays = Array.from(container.querySelectorAll('.pattern-display')) as HTMLElement[]
    const hottest = displays[1] // __A__

    userEvent.tab()
    userEvent.tab()

    expect(document.activeElement).toBe(hottest)
    expect(hottest.querySelector('.pattern-tooltip')).not.toBeNull()
  })

  test('clicking the eliminate button does not toggle the tooltip for its pattern', () => {
    const { container, getAllByRole } = render(
      <WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />,
    )
    const displays = Array.from(container.querySelectorAll('.pattern-display')) as HTMLElement[]
    const hottest = displays[1] // __A__
    const buttons = getAllByRole('button', { name: 'Eliminate pattern' })

    userEvent.click(buttons[1]) // eliminate button for __A__

    expect(hottest.querySelector('.pattern-tooltip')).toBeNull()

    // If eliminating had (incorrectly) also toggled the tooltip's active-pattern
    // state for __A__, the very next click on its display would close an
    // already-open tooltip instead of opening a fresh one. Asserting it opens
    // here proves the eliminate click left the tooltip state untouched.
    fireEvent.click(hottest)
    expect(hottest.querySelector('.pattern-tooltip')).not.toBeNull()
  })

  test('focusing a matched pattern shows the tooltip, blurring hides it', () => {
    const { container } = render(<WordPatternGenerator grid={grid} wordIdeas={wordIdeas} />)
    const displays = Array.from(container.querySelectorAll('.pattern-display')) as HTMLElement[]
    const hottest = displays[1] // __A__

    fireEvent.focus(hottest)
    expect(hottest.querySelector('.pattern-tooltip')).not.toBeNull()

    fireEvent.blur(hottest)
    expect(hottest.querySelector('.pattern-tooltip')).toBeNull()
  })
})
