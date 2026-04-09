# JS Gamification Monorepo

This repository follows Option A with separate packages per framework.

## Packages

- `@js-gamifications/word-search-core`
- `@js-gamifications/word-search-react`
- `@js-gamifications/word-search-angular`

For app consumers, install only the framework wrapper package. The core engine is resolved automatically as a dependency.

## Quick start

```bash
pnpm install
pnpm build
pnpm test
```

## Publish flow

1. Create a changeset:

```bash
pnpm changeset
```

2. Version packages:

```bash
pnpm version-packages
```

3. Publish:

```bash
pnpm -r build
pnpm changeset publish
```

## Next package pattern

For crossword, repeat the same package split:

- `@js-gamifications/crossword-core`
- `@js-gamifications/crossword-react`
- `@js-gamifications/crossword-angular`