## For local build and pack

```bash


## For core
cd /home/pipesanta/projects/gamifications
pnpm --filter @js-gamifications/word-search-core build
cd packages/word-search-core && pnpm pack

## for react
cd /home/pipesanta/projects/gamifications
pnpm --filter @js-gamifications/word-search-react build
cd packages/word-search-react && pnpm pack

# for angular
cd /home/pipesanta/projects/gamifications
pnpm --filter @js-gamifications/word-search-angular build
cd packages/word-search-angular && pnpm pack
```

## Then install the generated tarball in your test project:

```bash
# For React
npm uninstall @js-gamifications/word-search-react @js-gamifications/word-search-core
npm install /home/pipesanta/projects/gamifications/packages/word-search-core/js-gamifications-word-search-core-0.1.0.tgz /home/pipesanta/projects/gamifications/packages/word-search-react/js-gamifications-word-search-react-0.1.0.tgz
rm -rf node_modules/.vite
npm run dev
---
# For Angular
npm uninstall @js-gamifications/word-search-angular @js-gamifications/word-search-core
npm install /home/pipesanta/projects/gamifications/packages/word-search-core/js-gamifications-word-search-core-0.1.0.tgz /home/pipesanta/projects/gamifications/packages/word-search-angular/js-gamifications-word-search-angular-0.1.0.tgz
npm run start

```