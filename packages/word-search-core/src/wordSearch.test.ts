import { describe, expect, it } from "vitest";

import { createWordSearch } from "./wordSearch";

describe("createWordSearch", () => {
  it("creates a grid with expected dimensions", () => {
    const puzzle = createWordSearch({
      rows: 10,
      cols: 12,
      words: ["react", "angular", "typescript"]
    });

    expect(puzzle.grid.length).toBe(10);
    expect(puzzle.grid[0].length).toBe(12);
    expect(puzzle.placements.length).toBe(3);
  });
});
