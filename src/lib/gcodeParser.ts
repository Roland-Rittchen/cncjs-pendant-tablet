/**
 * Minimal G-code parser.
 * Tokenises a single line into { letter, value } word pairs.
 * Ported and simplified from cncjs-shopfloor-tablet's simple-parser.js.
 */

export interface GCodeWord {
  letter: string
  value: number
}

export interface ParsedLine {
  lineNumber: number | null
  words: GCodeWord[]
  comment: string
}

/** Tokenise a single G-code line. Returns null for blank/comment-only lines. */
export function parseLine(raw: string): ParsedLine | null {
  // Strip inline comments (; to end, or (…))
  let line = raw
    .replace(/;.*/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toUpperCase()

  if (!line) return null

  const words: GCodeWord[] = []
  let lineNumber: number | null = null
  const comment = ''

  // Extract all word pairs like G0, X-12.3, F1000, etc.
  const wordRe = /([A-Z])\s*(-?\d*\.?\d+(?:[Ee][+-]?\d+)?)/g
  let match: RegExpExecArray | null
  while ((match = wordRe.exec(line)) !== null) {
    const letter = match[1]
    const value = parseFloat(match[2])
    if (letter === 'N') {
      lineNumber = value
    } else {
      words.push({ letter, value })
    }
  }

  if (words.length === 0) return null
  return { lineNumber, words, comment }
}

/** Extract X/Y/Z/I/J/K/F/S/P values from a word list */
export function extractCoords(
  words: GCodeWord[]
): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {}
  for (const { letter, value } of words) {
    out[letter] = value
  }
  return out
}
