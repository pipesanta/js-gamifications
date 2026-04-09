export interface WordPlacement {
  word: string;
  startRow: number;
  startCol: number;
  deltaRow: number;
  deltaCol: number;
}

export interface WordSearchOptions {
  rows: number;
  cols: number;
  words: string[];
  alphabet?: string;
  allowDiagonal?: boolean;
  maxPlacementAttempts?: number;
}

export interface WordSearchPuzzle {
  grid: string[][];
  placements: WordPlacement[];
}
