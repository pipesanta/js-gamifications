# @js-gamifications/word-search-react

React adapter for the word search core package.

## Install

```bash
npm i @js-gamifications/word-search-react
```

`@js-gamifications/word-search-core` is installed automatically as a dependency.

## Usage

```tsx
import { WordSearchBoard } from "@js-gamifications/word-search-react";

export function App() {
  return (
    <WordSearchBoard
      rows={10}
      cols={10}
      words={["react", "hooks", "state"]}
      allowDiagonal
    />
  );
}
```
