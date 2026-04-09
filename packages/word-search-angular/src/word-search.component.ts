import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output } from "@angular/core";
import { createWordSearch, type WordPlacement, type WordSearchPuzzle } from "@js-gamifications/word-search-core";

type LanguageCode = "EN" | "ES" | "AR";

const TRANSLATIONS = {
  ES: {
    title: "Busqueda de Palabras",
    found: "encontradas",
    instructions: "Haz clic y arrastra sobre las letras para seleccionar una palabra.",
    clearProgress: "Reiniciar",
    newPuzzle: "Nuevo Juego",
    words: "Palabras",
    allWordsFound: "Todas las palabras encontradas",
    timer: "Tiempo",
    completionTitle: "Puzzle completado",
    completionMessage: "Excelente trabajo, encontraste todas las palabras.",
    completionTime: "Tiempo total",
    completionWords: "Palabras encontradas",
    completionGrid: "Tamano de tablero",
    completionDiagonal: "Diagonal habilitada",
    completionAt: "Completado a las",
    yes: "Si",
    no: "No"
  },
  EN: {
    title: "Word Search",
    found: "found",
    instructions: "Hold click and drag over letters to select a word.",
    clearProgress: "Clear Progress",
    newPuzzle: "New Puzzle",
    words: "Words",
    allWordsFound: "All words found",
    timer: "Time",
    completionTitle: "Puzzle Completed",
    completionMessage: "Great job, you found every word.",
    completionTime: "Total time",
    completionWords: "Words found",
    completionGrid: "Grid size",
    completionDiagonal: "Diagonal enabled",
    completionAt: "Completed at",
    yes: "Yes",
    no: "No"
  },
  AR: {
    title: "البحث عن الكلمات",
    found: "موجودة",
    instructions: "اضغط واسحب فوق الحروف لتحديد كلمة",
    clearProgress: "مسح التقدم",
    newPuzzle: "لعبة جديدة",
    words: "الكلمات",
    allWordsFound: "تم العثور على جميع الكلمات",
    timer: "الوقت",
    completionTitle: "اكتمل اللغز",
    completionMessage: "عمل رائع، لقد عثرت على جميع الكلمات",
    completionTime: "الوقت الكلي",
    completionWords: "الكلمات التي تم العثور عليها",
    completionGrid: "حجم الشبكة",
    completionDiagonal: "القطري مفعل",
    completionAt: "اكتمل في",
    yes: "نعم",
    no: "لا"
  }
} as const;

interface CellPosition {
  row: number;
  col: number;
}

export interface WordSearchCompletionReport {
  elapsedSeconds: number;
  foundWords: number;
  totalWords: number;
  rows: number;
  cols: number;
  allowDiagonal: boolean;
  completedAt: string;
}

function playSound(frequency: number, duration: number) {
  if (typeof window === "undefined") {
    return;
  }

  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    return;
  }

  const audioContext = new Ctx();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.value = frequency;
  oscillator.type = "sine";

  gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function playSuccessSound() {
  playSound(800, 0.15);
  setTimeout(() => playSound(1000, 0.15), 150);
}

function playWinnerSound() {
  playSound(523.25, 0.2);
  setTimeout(() => playSound(659.25, 0.2), 220);
  setTimeout(() => playSound(783.99, 0.4), 440);
}

function normalizeWord(word: string): string {
  return word.trim().toUpperCase().replace(/\s+/g, "");
}

function toCellKey(cell: CellPosition): string {
  return `${cell.row}:${cell.col}`;
}

function toPathFromPlacement(placement: WordPlacement): CellPosition[] {
  return Array.from({ length: placement.word.length }, (_, index) => ({
    row: placement.startRow + placement.deltaRow * index,
    col: placement.startCol + placement.deltaCol * index
  }));
}

function buildPath(start: CellPosition, end: CellPosition): CellPosition[] {
  const rowDiff = end.row - start.row;
  const colDiff = end.col - start.col;
  const absRowDiff = Math.abs(rowDiff);
  const absColDiff = Math.abs(colDiff);

  const isHorizontal = rowDiff === 0;
  const isVertical = colDiff === 0;
  const isDiagonal = absRowDiff === absColDiff;

  if (!isHorizontal && !isVertical && !isDiagonal) {
    return [start];
  }

  const rowStep = rowDiff === 0 ? 0 : rowDiff / absRowDiff;
  const colStep = colDiff === 0 ? 0 : colDiff / absColDiff;
  const steps = Math.max(absRowDiff, absColDiff);

  return Array.from({ length: steps + 1 }, (_, index) => ({
    row: start.row + rowStep * index,
    col: start.col + colStep * index
  }));
}

function matchesPlacement(path: CellPosition[], placement: WordPlacement): boolean {
  if (path.length !== placement.word.length) {
    return false;
  }

  const forward = toPathFromPlacement(placement);
  const matchesForward = forward.every((expected, index) => {
    const selected = path[index];
    return selected?.row === expected.row && selected?.col === expected.col;
  });

  if (matchesForward) {
    return true;
  }

  return forward.every((expected, index) => {
    const selected = path[path.length - 1 - index];
    return selected?.row === expected.row && selected?.col === expected.col;
  });
}

@Component({
  selector: "js-gamifications-word-search",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="word-search-root" [class.rtl]="language === 'AR'">
      <div class="celebration-overlay" *ngIf="showCelebration">
        <div class="celebration-glow"></div>
        <div class="celebration-emoji">🎉</div>
      </div>

      <div class="header-row">
        <div class="title-wrap">
          <strong class="title">{{ t.title }}</strong>
          <span class="meta-chip">{{ foundWords.size }}/{{ normalizedInputWords.length }} {{ t.found }}</span>
          <span class="meta-chip">{{ t.timer }}: {{ formatTime(elapsedSeconds) }}</span>
        </div>
        <div class="instructions">{{ t.instructions }}</div>
      </div>

      <div class="controls-row">
        <div class="language-wrap">
          <label>Language:</label>
          <select [ngModel]="language" (ngModelChange)="setLanguage($event)">
            <option value="EN">English</option>
            <option value="ES">Español</option>
            <option value="AR">العربية</option>
          </select>
        </div>

        <div class="buttons-wrap">
          <button type="button" class="btn btn-secondary" (click)="resetProgress()">{{ t.clearProgress }}</button>
          <button type="button" class="btn btn-primary" (click)="generateNewPuzzle()">{{ t.newPuzzle }}</button>
        </div>
      </div>

      <div class="board-wrapper">
        <div
          class="board-grid"
          [style.maxWidth.px]="boardSize"
          [style.gridTemplateColumns]="'repeat(' + cols + ', minmax(0, 1fr))'"
          [style.gridTemplateRows]="'repeat(' + rows + ', minmax(0, 1fr))'"
          (mouseleave)="finishSelection()"
        >
          <ng-container *ngIf="puzzle as currentPuzzle">
            <ng-container *ngFor="let row of currentPuzzle.grid; let rowIndex = index">
              <button
                type="button"
                class="word-search-cell"
                *ngFor="let cell of row; let colIndex = index"
                (mousedown)="startSelection(rowIndex, colIndex)"
                (mouseenter)="moveSelection(rowIndex, colIndex)"
                (mouseup)="finishSelection()"
                [class.found-cell]="isFoundCell(rowIndex, colIndex)"
                [class.path-cell]="isPathCell(rowIndex, colIndex)"
              >
                {{ cell }}
              </button>
            </ng-container>
          </ng-container>
        </div>
      </div>

      <div class="words-section">
        <div class="words-title">{{ t.words }}</div>
        <div class="words-list">
          <span class="word-chip" [class.word-chip-found]="isWordFound(word)" *ngFor="let word of normalizedInputWords">
            {{ word }}
          </span>
        </div>
        <span class="all-found" *ngIf="pendingWords.length === 0">{{ t.allWordsFound }}</span>
      </div>

      <div class="completion-card" *ngIf="completionReport as report">
        <div class="completion-title">{{ t.completionTitle }}</div>
        <div class="completion-message">{{ t.completionMessage }}</div>
        <div class="completion-grid">
          <div><strong>{{ t.completionTime }}:</strong> {{ formatTime(report.elapsedSeconds) }}</div>
          <div><strong>{{ t.completionWords }}:</strong> {{ report.foundWords }}/{{ report.totalWords }}</div>
          <div><strong>{{ t.completionGrid }}:</strong> {{ report.rows }}x{{ report.cols }}</div>
          <div><strong>{{ t.completionDiagonal }}:</strong> {{ report.allowDiagonal ? t.yes : t.no }}</div>
          <div><strong>{{ t.completionAt }}:</strong> {{ formatCompletedAt(report.completedAt) }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .word-search-root {
        position: relative;
        width: 100%;
        border-radius: 16px;
        border: 1px solid #e4e4e7;
        background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        padding: 16px;
        overflow: hidden;
      }

      .rtl {
        direction: rtl;
      }

      .celebration-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 20;
      }

      .celebration-glow {
        position: absolute;
        inset: 0;
        background: linear-gradient(45deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0) 100%);
        animation: pulse 0.6s ease-out;
      }

      .celebration-emoji {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 48px;
        color: #22c55e;
        animation: bounce 0.6s ease-out;
      }

      .header-row,
      .controls-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 12px;
      }

      .title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .title {
        font-size: 16px;
        color: #111827;
      }

      .meta-chip {
        font-size: 12px;
        color: #374151;
        background: #f3f4f6;
        padding: 4px 8px;
        border-radius: 999px;
      }

      .instructions,
      .language-wrap label,
      .words-title {
        font-size: 12px;
        color: #6b7280;
      }

      .language-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .language-wrap select {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid #d4d4d8;
        background: #fff;
      }

      .buttons-wrap {
        display: flex;
        gap: 8px;
      }

      .btn {
        border-radius: 8px;
        font-size: 12px;
        padding: 6px 10px;
        cursor: pointer;
        border: 1px solid #d4d4d8;
      }

      .btn-secondary {
        background: #fff;
        color: #374151;
      }

      .btn-primary {
        background: #0ea5e9;
        color: #fff;
        border-color: #0ea5e9;
      }

      .board-wrapper {
        width: 100%;
        display: flex;
        justify-content: center;
      }

      .board-grid {
        width: 100%;
        aspect-ratio: 1 / 1;
        display: grid;
        gap: 1px;
        user-select: none;
        touch-action: none;
      }

      .word-search-cell {
        display: inline-flex;
        width: 100%;
        height: 100%;
        min-width: 0;
        align-items: center;
        justify-content: center;
        border: 1px solid #d4d4d8;
        border-radius: 8px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-weight: 700;
        font-size: clamp(12px, 1.8vw, 16px);
        color: #111827;
        background: #fff;
        transition: background 120ms ease;
      }

      .path-cell {
        background: #e0f2fe;
      }

      .found-cell {
        background: #bae6fd;
      }

      .words-section {
        margin-top: 14px;
        display: grid;
        gap: 8px;
      }

      .words-list {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .word-chip {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid #d4d4d8;
        background: #fafafa;
        color: #3f3f46;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
      }

      .word-chip-found {
        border-color: #22c55e;
        background: #dcfce7;
        color: #166534;
        text-decoration: line-through;
        text-decoration-thickness: 2px;
      }

      .all-found {
        font-size: 12px;
        color: #16a34a;
        font-weight: 600;
      }

      .completion-card {
        margin-top: 14px;
        border: 1px solid #86efac;
        background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
        border-radius: 12px;
        padding: 12px;
      }

      .completion-title {
        font-size: 14px;
        font-weight: 700;
        color: #166534;
        margin-bottom: 4px;
      }

      .completion-message {
        font-size: 12px;
        color: #166534;
        margin-bottom: 10px;
      }

      .completion-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
        font-size: 12px;
        color: #14532d;
      }

      @keyframes pulse {
        0% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }

      @keyframes bounce {
        0%,
        100% {
          transform: translate(-50%, -50%) scale(1);
        }
        50% {
          transform: translate(-50%, -50%) scale(1.1);
        }
      }
    `
  ]
})
export class WordSearchComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) rows = 10;
  @Input({ required: true }) cols = 10;
  @Input({ required: true }) words: string[] = [];
  @Input() allowDiagonal = true;
  @Output() completed = new EventEmitter<WordSearchCompletionReport>();
  @Output() generated = new EventEmitter<WordSearchPuzzle>();

  puzzle: WordSearchPuzzle | null = null;
  language: LanguageCode = "EN";
  elapsedSeconds = 0;
  showCelebration = false;
  completionReport: WordSearchCompletionReport | null = null;

  foundWords = new Set<string>();
  normalizedInputWords: string[] = [];
  pendingWords: string[] = [];
  foundCellKeys = new Set<string>();
  currentPathKeys = new Set<string>();

  isDragging = false;
  dragStart: CellPosition | null = null;
  dragCurrent: CellPosition | null = null;

  puzzleSeed = 0;
  boardSize = 280;

  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private celebrationTimeout: ReturnType<typeof setTimeout> | null = null;

  get t() {
    return TRANSLATIONS[this.language];
  }

  ngOnInit(): void {
    this.timerHandle = setInterval(() => {
      this.elapsedSeconds += 1;
    }, 1000);

    this.generatePuzzle();
  }

  ngOnChanges(): void {
    this.normalizedInputWords = this.words.map(normalizeWord).filter(Boolean);
    this.pendingWords = [...this.normalizedInputWords];
    this.boardSize = Math.min(560, Math.max(280, Math.max(this.rows, this.cols) * 38));

    if (!this.words.length) {
      this.puzzle = null;
      this.clearRoundState();
      return;
    }

    if (this.puzzle) {
      this.generatePuzzle();
    }
  }

  ngOnDestroy(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
    }
    if (this.celebrationTimeout) {
      clearTimeout(this.celebrationTimeout);
    }
  }

  @HostListener("document:mouseup")
  onDocumentMouseUp(): void {
    this.finishSelection();
  }

  setLanguage(value: LanguageCode): void {
    this.language = value;
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  formatCompletedAt(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  isFoundCell(row: number, col: number): boolean {
    return this.foundCellKeys.has(`${row}:${col}`);
  }

  isPathCell(row: number, col: number): boolean {
    return this.currentPathKeys.has(`${row}:${col}`);
  }

  isWordFound(word: string): boolean {
    return this.foundWords.has(word);
  }

  startSelection(row: number, col: number): void {
    this.isDragging = true;
    this.dragStart = { row, col };
    this.dragCurrent = { row, col };
    this.refreshCurrentPathKeys();
  }

  moveSelection(row: number, col: number): void {
    if (!this.isDragging) {
      return;
    }

    this.dragCurrent = { row, col };
    this.refreshCurrentPathKeys();
  }

  finishSelection(): void {
    if (!this.isDragging || !this.dragStart || !this.dragCurrent || !this.puzzle) {
      this.clearDragState();
      return;
    }

    const path = buildPath(this.dragStart, this.dragCurrent);
    const match = this.puzzle.placements.find((placement) => matchesPlacement(path, placement));

    if (match && !this.foundWords.has(match.word)) {
      this.foundWords.add(match.word);
      this.refreshFoundCellKeys();
      this.pendingWords = this.normalizedInputWords.filter((word) => !this.foundWords.has(word));
      playSuccessSound();

      if (this.foundWords.size === this.normalizedInputWords.length) {
        const report: WordSearchCompletionReport = {
          elapsedSeconds: this.elapsedSeconds,
          foundWords: this.foundWords.size,
          totalWords: this.normalizedInputWords.length,
          rows: this.rows,
          cols: this.cols,
          allowDiagonal: this.allowDiagonal,
          completedAt: new Date().toISOString()
        };

        this.completionReport = report;
        this.completed.emit(report);
        playWinnerSound();
        this.showCelebration = true;
        if (this.celebrationTimeout) {
          clearTimeout(this.celebrationTimeout);
        }
        this.celebrationTimeout = setTimeout(() => {
          this.showCelebration = false;
        }, 3000);
      }
    }

    this.clearDragState();
  }

  resetProgress(): void {
    this.foundWords = new Set<string>();
    this.pendingWords = [...this.normalizedInputWords];
    this.foundCellKeys = new Set<string>();
    this.completionReport = null;
    this.showCelebration = false;
    this.clearDragState();
  }

  generateNewPuzzle(): void {
    this.puzzleSeed += 1;
    this.generatePuzzle();
  }

  private generatePuzzle(): void {
    if (this.words.length === 0) {
      this.puzzle = null;
      this.clearRoundState();
      return;
    }

    this.puzzle = createWordSearch({
      rows: this.rows,
      cols: this.cols,
      words: this.words,
      allowDiagonal: this.allowDiagonal
    });

    this.generated.emit(this.puzzle);
    this.elapsedSeconds = 0;
    this.resetProgress();
  }

  private refreshFoundCellKeys(): void {
    const next = new Set<string>();
    if (!this.puzzle) {
      this.foundCellKeys = next;
      return;
    }

    for (const placement of this.puzzle.placements) {
      if (!this.foundWords.has(placement.word)) {
        continue;
      }
      for (const cell of toPathFromPlacement(placement)) {
        next.add(toCellKey(cell));
      }
    }

    this.foundCellKeys = next;
  }

  private refreshCurrentPathKeys(): void {
    if (!this.dragStart || !this.dragCurrent) {
      this.currentPathKeys = new Set<string>();
      return;
    }

    const path = buildPath(this.dragStart, this.dragCurrent);
    const next = new Set<string>();
    for (const cell of path) {
      next.add(toCellKey(cell));
    }
    this.currentPathKeys = next;
  }

  private clearDragState(): void {
    this.isDragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
    this.currentPathKeys = new Set<string>();
  }

  private clearRoundState(): void {
    this.elapsedSeconds = 0;
    this.showCelebration = false;
    this.completionReport = null;
    this.foundWords = new Set<string>();
    this.pendingWords = [...this.normalizedInputWords];
    this.foundCellKeys = new Set<string>();
    this.clearDragState();
    if (this.celebrationTimeout) {
      clearTimeout(this.celebrationTimeout);
      this.celebrationTimeout = null;
    }
  }
}
