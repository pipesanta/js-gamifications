# @js-gamifications/word-search-angular

Angular adapter for the word search core package.

## Install

```bash
npm i @js-gamifications/word-search-angular
```

`@js-gamifications/word-search-core` is installed automatically as a dependency.

## Usage

```ts
import { Component } from "@angular/core";
import { WordSearchComponent } from "@js-gamifications/word-search-angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [WordSearchComponent],
  template: `
    <js-gamifications-word-search
      [rows]="10"
      [cols]="10"
      [words]="['angular', 'signals', 'components']"
      [allowDiagonal]="true"
    />
  `
})
export class AppComponent {}
```
