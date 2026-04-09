import type { WordPlacement, WordSearchOptions, WordSearchPuzzle } from "./types";

const DEFAULT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function normalizeWord(word: string): string {
  return word.trim().toUpperCase().replace(/\s+/g, "");
}

function createDirections(allowDiagonal: boolean): Array<[number, number]> {
  const base: Array<[number, number]> = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0]
  ];

  if (!allowDiagonal) {
    return base;
  }

  return [
    ...base,
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ];
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function inBounds(row: number, col: number, rows: number, cols: number): boolean {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function canPlaceWord(
  grid: string[][],
  word: string,
  startRow: number,
  startCol: number,
  deltaRow: number,
  deltaCol: number
): boolean {
  const firstRow = grid[0];
  if (!firstRow) {
    return false;
  }

  for (let i = 0; i < word.length; i += 1) {
    const row = startRow + i * deltaRow;
    const col = startCol + i * deltaCol;

    if (!inBounds(row, col, grid.length, firstRow.length)) {
      return false;
    }

    const rowCells = grid[row];
    const existing = rowCells?.[col];
    const char = word[i];
    if (!rowCells || existing === undefined || char === undefined) {
      return false;
    }

    if (existing !== "" && existing !== char) {
      return false;
    }
  }

  return true;
}

function placeWord(
  grid: string[][],
  word: string,
  startRow: number,
  startCol: number,
  deltaRow: number,
  deltaCol: number
): void {
  for (let i = 0; i < word.length; i += 1) {
    const row = startRow + i * deltaRow;
    const col = startCol + i * deltaCol;
    const rowCells = grid[row];
    const char = word[i];
    if (!rowCells || char === undefined) {
      throw new Error("Invalid word placement coordinates");
    }

    rowCells[col] = char;
  }
}

function fillEmptyCells(grid: string[][], alphabet: string): void {
  const chars = alphabet.split("");
  for (let row = 0; row < grid.length; row += 1) {
    const rowCells = grid[row];
    if (!rowCells) {
      continue;
    }

    for (let col = 0; col < rowCells.length; col += 1) {
      if (rowCells[col] === "") {
        const nextChar = chars[randomInt(chars.length)];
        rowCells[col] = nextChar ?? chars[0] ?? "A";
      }
    }
  }
}

export function createWordSearch(options: WordSearchOptions): WordSearchPuzzle {
  const rows = options.rows;
  const cols = options.cols;
  const alphabet = options.alphabet ?? DEFAULT_ALPHABET;
  const allowDiagonal = options.allowDiagonal ?? true;
  const maxPlacementAttempts = options.maxPlacementAttempts ?? 250;

  if (rows <= 0 || cols <= 0) {
    throw new Error("rows and cols must be greater than 0");
  }

  if (alphabet.length === 0) {
    throw new Error("alphabet must contain at least one character");
  }

  const words = options.words.map(normalizeWord).filter(Boolean);
  if (words.length === 0) {
    throw new Error("words must include at least one valid entry");
  }

  const sortedWords = [...words].sort((a, b) => b.length - a.length);
  const directions = createDirections(allowDiagonal);
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
  const placements: WordPlacement[] = [];

  for (const word of sortedWords) {
    let placed = false;

    for (let attempt = 0; attempt < maxPlacementAttempts; attempt += 1) {
      const direction = directions[randomInt(directions.length)];
      if (!direction) {
        throw new Error("No directions configured for placement");
      }

      const [deltaRow, deltaCol] = direction;
      const startRow = randomInt(rows);
      const startCol = randomInt(cols);

      if (!canPlaceWord(grid, word, startRow, startCol, deltaRow, deltaCol)) {
        continue;
      }

      placeWord(grid, word, startRow, startCol, deltaRow, deltaCol);
      placements.push({ word, startRow, startCol, deltaRow, deltaCol });
      placed = true;
      break;
    }

    if (!placed) {
      throw new Error(`Unable to place word: ${word}`);
    }
  }

  fillEmptyCells(grid, alphabet.toUpperCase());

  return { grid, placements };
}
