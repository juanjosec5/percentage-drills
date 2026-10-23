import { applyChange, fmt, isCorrect, parseAnswer, percentOf, whatPercent } from '@/engine/math'

describe('percent math', () => {
  it('computes percentages without float noise', () => {
    expect(percentOf(15, 70)).toBe(10.5)
    expect(percentOf(19, 70)).toBe(13.3)
    expect(percentOf(12, 70)).toBe(8.4)
    expect(percentOf(1, 83)).toBe(0.83)
  })

  it('handles reverse and change problems', () => {
    expect(whatPercent(14, 70)).toBe(20)
    expect(applyChange(80, -15)).toBe(68)
    expect(applyChange(70, 20)).toBe(84)
  })

  it('formats without trailing zeros', () => {
    expect(fmt(10.5)).toBe('10.5')
    expect(fmt(21)).toBe('21')
    expect(fmt(0.1 + 0.2)).toBe('0.3')
  })

  it('uses the locale decimal mark, with no thousands separator', () => {
    expect(fmt(63.5, 'es')).toBe('63,5')
    expect(fmt(1.2, 'es', 1)).toBe('1,2')
    expect(fmt(3, 'en', 1)).toBe('3.0')
    // parseAnswer would read "1,000" as 1.
    expect(fmt(1000)).toBe('1000')
    expect(fmt(12345.5, 'es')).toBe('12345,5')
  })
})

describe('answer parsing', () => {
  it('accepts a decimal comma, a point, a % sign and a $ sign', () => {
    expect(parseAnswer('10,5')).toBe(10.5)
    expect(parseAnswer(' 10.5 ')).toBe(10.5)
    expect(parseAnswer('20%')).toBe(20)
    expect(parseAnswer('$68')).toBe(68)
    expect(parseAnswer('.5')).toBe(0.5)
  })

  it('rejects things that are not numbers', () => {
    expect(parseAnswer('')).toBeNull()
    expect(parseAnswer('abc')).toBeNull()
    expect(parseAnswer('1.2.3')).toBeNull()
  })

  it('grades equivalent spellings as correct', () => {
    expect(isCorrect('10,5', 10.5)).toBe(true)
    expect(isCorrect('10.50', 10.5)).toBe(true)
    expect(isCorrect('10', 10.5)).toBe(false)
    expect(isCorrect('', 0)).toBe(false)
  })
})
