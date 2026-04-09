# @js-gamifications/word-search-core

Framework-agnostic engine for generating word search puzzles.

## Install

```bash
npm i @js-gamifications/word-search-core
```

## Usage

```ts
import { createWordSearch } from "@js-gamifications/word-search-core";

const puzzle = createWordSearch({
  rows: 12,
  cols: 12,
  words: ["react", "angular", "typescript"],
  allowDiagonal: true
});
```
