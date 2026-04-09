import { Injectable } from "@angular/core";
import { createWordSearch, type WordSearchOptions, type WordSearchPuzzle } from "@js-gamifications/word-search-core";

@Injectable({ providedIn: "root" })
export class WordSearchService {
  generate(options: WordSearchOptions): WordSearchPuzzle {
    return createWordSearch(options);
  }
}
