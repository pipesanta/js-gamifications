import { createWordSearch, type WordPlacement, type WordSearchPuzzle } from "@js-gamifications/word-search-core";
import { useEffect, useMemo, useState } from "react";

/**
 * Generates a short synthetic tone for lightweight game feedback.
 */
function playSound(frequency: number, duration: number) {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = "sine";

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

/**
 * Positive feedback played when a valid word is found.
 */
function playSuccessSound() {
  playSound(800, 0.15);
  setTimeout(() => {
    playSound(1000, 0.15);
  }, 150);
}

/**
 * Final completion jingle played when all words are found.
 */
function playWinnerSound() {
  playSound(523.25, 0.2);
  setTimeout(() => {
    playSound(659.25, 0.2);
  }, 220);
  setTimeout(() => {
    playSound(783.99, 0.4);
  }, 440);
}

/**
 * UI labels localized per supported language.
 */
const TRANSLATIONS = {
  ES: {
    title: "Búsqueda de Palabras",
    found: "encontradas",
    instructions: "Haz clic y arrastra sobre las letras para seleccionar una palabra.",
    clearProgress: "Reiniciar",
    newPuzzle: "Nuevo Juego",
    words: "Palabras",
    allWordsFound: "Todas las palabras encontradas",
    squareText: "El tablero se muestra en un contenedor cuadrado para un seguimiento más fácil.",
    timer: "Tiempo",
    completionTitle: "Puzzle completado",
    completionMessage: "Excelente trabajo, encontraste todas las palabras.",
    completionTime: "Tiempo total",
    completionWords: "Palabras encontradas",
    completionGrid: "Tamanio de tablero",
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
    squareText: "Board is rendered in a square container for easier tracking.",
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
    squareText: "يتم تقديم اللوحة في حاوية مربعة لتتبع أسهل",
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
};

export interface WordSearchCompletionReport {
  elapsedSeconds: number;
  foundWords: number;
  totalWords: number;
  rows: number;
  cols: number;
  allowDiagonal: boolean;
  completedAt: string;
}

export interface WordSearchBoardProps {
  /** Number of rows in the generated puzzle grid. */
  rows: number;
  /** Number of columns in the generated puzzle grid. */
  cols: number;
  /** Input words to place in the puzzle. */
  words: string[];
  /** Enables diagonal word placement in the generator. */
  allowDiagonal?: boolean;
  /** Optional className applied to the root container. */
  className?: string;
  /** Callback fired whenever a new puzzle is generated. */
  onGenerated?: (puzzle: WordSearchPuzzle) => void;
  /** Callback fired when the player completes the puzzle. */
  onCompleted?: (report: WordSearchCompletionReport) => void;
}

interface CellPosition {
  row: number;
  col: number;
}

/** Serializes a cell position for use in Set/Map membership checks. */
function toCellKey(cell: CellPosition): string {
  return `${cell.row}:${cell.col}`;
}

/** Normalizes user words to uppercase and removes spaces for consistent matching. */
function normalizeWord(word: string): string {
  return word.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Builds a contiguous selection path from start to end.
 * Only horizontal, vertical, and diagonal paths are considered valid.
 */
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

/** Expands a placed word into the full list of occupied cells. */
function toPathFromPlacement(placement: WordPlacement): CellPosition[] {
  return Array.from({ length: placement.word.length }, (_, index) => ({
    row: placement.startRow + placement.deltaRow * index,
    col: placement.startCol + placement.deltaCol * index
  }));
}

/**
 * Validates whether the drag path matches a placement in either direction.
 */
function matchesPlacement(path: CellPosition[], placement: WordPlacement): boolean {
  if (path.length !== placement.word.length) {
    return false;
  }

  const expectedForward = toPathFromPlacement(placement);
  const forwardMatch = expectedForward.every((expectedCell, index) => {
    const selected = path[index];
    return selected?.row === expectedCell.row && selected?.col === expectedCell.col;
  });

  if (forwardMatch) {
    return true;
  }

  return expectedForward.every((expectedCell, index) => {
    const selected = path[path.length - 1 - index];
    return selected?.row === expectedCell.row && selected?.col === expectedCell.col;
  });
}

/**
 * Interactive word-search board component with drag selection,
 * progress tracking, timer, sounds, and localized labels.
 */
export function WordSearchBoard(props: WordSearchBoardProps) {
  const [puzzleSeed, setPuzzleSeed] = useState(0);
  const [language, setLanguage] = useState<"EN" | "ES" | "AR">("EN");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completionReport, setCompletionReport] = useState<WordSearchCompletionReport | null>(null);

  const t = TRANSLATIONS[language];

  // Regenerate the puzzle whenever inputs or seed change.
  const puzzle = useMemo(() => {
    const options = {
      rows: props.rows,
      cols: props.cols,
      words: props.words
    };

    if (props.allowDiagonal !== undefined) {
      Object.assign(options, { allowDiagonal: props.allowDiagonal });
    }

    const generated = createWordSearch(options);

    props.onGenerated?.(generated);
    return generated;
  }, [props.rows, props.cols, props.words, props.allowDiagonal, props.onGenerated, puzzleSeed]);

  const normalizedInputWords = useMemo(
    () => props.words.map(normalizeWord).filter(Boolean),
    [props.words]
  );

  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<CellPosition | null>(null);
  const [dragCurrent, setDragCurrent] = useState<CellPosition | null>(null);

  // Reset interaction and game state every time a new puzzle is created.
  useEffect(() => {
    setFoundWords(new Set());
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
    setElapsedSeconds(0);
    setShowCelebration(false);
    setCompletionReport(null);
  }, [puzzle]);

  // Global elapsed timer for the current round.
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((previous) => previous + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Resolves the current in-progress drag into board coordinates.
  const currentPath = useMemo(() => {
    if (!dragStart || !dragCurrent) {
      return [];
    }

    return buildPath(dragStart, dragCurrent);
  }, [dragStart, dragCurrent]);

  const foundPlacements = useMemo(
    () => puzzle.placements.filter((placement) => foundWords.has(placement.word)),
    [puzzle.placements, foundWords]
  );

  const foundCellKeys = useMemo(() => {
    const result = new Set<string>();
    for (const placement of foundPlacements) {
      for (const cell of toPathFromPlacement(placement)) {
        result.add(toCellKey(cell));
      }
    }

    return result;
  }, [foundPlacements]);

  const currentPathKeys = useMemo(() => {
    const result = new Set<string>();
    for (const cell of currentPath) {
      result.add(toCellKey(cell));
    }

    return result;
  }, [currentPath]);

  const pendingWords = useMemo(
    () => normalizedInputWords.filter((word) => !foundWords.has(word)),
    [normalizedInputWords, foundWords]
  );

  /**
   * Finalizes current drag selection and applies scoring + feedback.
   */
  const completeSelection = () => {
    if (!dragStart || !dragCurrent) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const path = buildPath(dragStart, dragCurrent);
    const match = puzzle.placements.find((placement) => matchesPlacement(path, placement));

    if (match) {
      setFoundWords((previous) => {
        const next = new Set(previous);
        next.add(match.word);
        playSuccessSound();

        if (next.size === normalizedInputWords.length) {
          const report: WordSearchCompletionReport = {
            elapsedSeconds,
            foundWords: next.size,
            totalWords: normalizedInputWords.length,
            rows: props.rows,
            cols: props.cols,
            allowDiagonal: props.allowDiagonal ?? true,
            completedAt: new Date().toISOString()
          };

          setTimeout(() => {
            playWinnerSound();
            setShowCelebration(true);
            setCompletionReport(report);
            props.onCompleted?.(report);
            setTimeout(() => {
              setShowCelebration(false);
            }, 3000);
          }, 100);
        }

        return next;
      });
    }

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseUp = () => {
      completeSelection();
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, dragCurrent, puzzle.placements]);

  /** Begins a drag operation from a cell. */
  const startSelection = (row: number, col: number) => {
    setIsDragging(true);
    setDragStart({ row, col });
    setDragCurrent({ row, col });
  };

  /** Updates drag endpoint while user moves across cells. */
  const moveSelection = (row: number, col: number) => {
    if (!isDragging) {
      return;
    }

    setDragCurrent({ row, col });
  };

  /** Completes drag selection if one is in progress. */
  const finishSelection = () => {
    if (!isDragging) {
      return;
    }

    completeSelection();
  };

  /** Clears solved words while preserving the same puzzle layout. */
  const resetProgress = () => {
    setFoundWords(new Set());
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  /** Generates a fresh puzzle and resets round state. */
  const generateNewPuzzle = () => {
    resetProgress();
    setPuzzleSeed((previous) => previous + 1);
  };

  const boardSize = useMemo(() => {
    const maxDimension = Math.max(props.rows, props.cols);
    return Math.min(560, Math.max(280, maxDimension * 38));
  }, [props.rows, props.cols]);

  return (
    <div
      className={props.className}
      style={{
        width: "100%",
        borderRadius: "16px",
        border: "1px solid #e4e4e7",
        background:
          "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(248, 250, 252, 1) 100%)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        padding: "16px",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {showCelebration && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 20,
            borderRadius: "inherit"
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(45deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0) 100%)",
              animation: "pulse 0.6s ease-out"
            }}
          />
          <style>{`
            @keyframes pulse {
              0% { opacity: 1; }
              100% { opacity: 0; }
            }
            @keyframes bounce {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }
          `}</style>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "48px",
              fontWeight: "bold",
              color: "#22c55e",
              animation: "bounce 0.6s ease-out",
              textShadow: "0 4px 12px rgba(34, 197, 94, 0.4)"
            }}
          >
            🎉
          </div>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          gap: "10px",
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <strong style={{ fontSize: "16px", color: "#111827" }}>{t.title}</strong>
          <span
            style={{
              fontSize: "12px",
              color: "#374151",
              background: "#f3f4f6",
              padding: "4px 8px",
              borderRadius: "999px"
            }}
          >
            {foundWords.size}/{normalizedInputWords.length} {t.found}
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "#374151",
              background: "#f3f4f6",
              padding: "4px 8px",
              borderRadius: "999px"
            }}
          >
            {t.timer}: {formatTime(elapsedSeconds)}
          </span>
        </div>

        <div style={{ fontSize: "12px", color: "#6b7280" }}>
          {t.instructions}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
          flexWrap: "wrap"
        }}
      >
        <div>
          <label style={{ fontSize: "12px", color: "#6b7280", marginRight: "6px" }}>
            Language:
          </label>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as "EN" | "ES" | "AR")}
            style={{
              fontSize: "12px",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid #d4d4d8",
              background: "#ffffff",
              cursor: "pointer"
            }}
          >
            <option value="EN">English</option>
            <option value="ES">Español</option>
            <option value="AR">العربية</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={resetProgress}
            style={{
              border: "1px solid #d4d4d8",
              background: "#ffffff",
              color: "#374151",
              borderRadius: "8px",
              fontSize: "12px",
              padding: "6px 10px",
              cursor: "pointer"
            }}
          >
            {t.clearProgress}
          </button>
          <button
            type="button"
            onClick={generateNewPuzzle}
            style={{
              border: "1px solid #0ea5e9",
              background: "#0ea5e9",
              color: "#ffffff",
              borderRadius: "4px",
              fontSize: "12px",
              padding: "6px 10px",
              cursor: "pointer"
            }}
          >
            {t.newPuzzle}
          </button>
        </div>
      </div>

      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: `min(100%, ${boardSize}px)`,
            aspectRatio: "1 / 1",
            display: "grid",
            gridTemplateColumns: `repeat(${props.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${props.rows}, minmax(0, 1fr))`,
            gap: "1px",
            userSelect: "none",
            touchAction: "none"
          }}
          onMouseLeave={finishSelection}
        >
          {puzzle.grid.flatMap((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                onMouseDown={() => startSelection(rowIndex, colIndex)}
                onMouseEnter={() => moveSelection(rowIndex, colIndex)}
                onMouseUp={finishSelection}
                style={{
                  display: "inline-flex",
                  width: "100%",
                  height: "100%",
                  minWidth: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #d4d4d8",
                  borderRadius: "8px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
                  fontWeight: 700,
                  fontSize: "clamp(12px, 1.8vw, 16px)",
                  color: "#111827",
                  background: foundCellKeys.has(toCellKey({ row: rowIndex, col: colIndex }))
                    ? "#bae6fd"
                    : currentPathKeys.has(toCellKey({ row: rowIndex, col: colIndex }))
                      ? "#e0f2fe"
                      : "#ffffff",
                  cursor: "pointer",
                  transition: "background 120ms ease, transform 120ms ease"
                }}
              >
                {cell}
              </button>
            ))
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "14px",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "8px"
        }}
      >
        <div style={{ fontSize: "12px", color: "#6b7280" }}>{t.words}</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {normalizedInputWords.map((word) => {
            const found = foundWords.has(word);
            return (
              <span
                key={word}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: "999px",
                  border: found ? "1px solid #22c55e" : "1px solid #d4d4d8",
                  background: found ? "#dcfce7" : "#fafafa",
                  color: found ? "#166534" : "#3f3f46",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textDecoration: found ? "line-through" : "none",
                  textDecorationThickness: found ? "2px" : undefined,
                  textDecorationColor: found ? "#166534" : undefined
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        {pendingWords.length === 0 ? (
          <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600 }}>
            {t.allWordsFound}
          </span>
        ) : null}
      </div>

      {completionReport ? (
        <div
          style={{
            marginTop: "14px",
            border: "1px solid #86efac",
            background: "linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)",
            borderRadius: "12px",
            padding: "12px"
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#166534", marginBottom: "4px" }}>
            {t.completionTitle}
          </div>
          <div style={{ fontSize: "12px", color: "#166534", marginBottom: "10px" }}>
            {t.completionMessage}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "8px"
            }}
          >
            <div style={{ fontSize: "12px", color: "#14532d" }}>
              <strong>{t.completionTime}:</strong> {formatTime(completionReport.elapsedSeconds)}
            </div>
            <div style={{ fontSize: "12px", color: "#14532d" }}>
              <strong>{t.completionWords}:</strong> {completionReport.foundWords}/{completionReport.totalWords}
            </div>
            <div style={{ fontSize: "12px", color: "#14532d" }}>
              <strong>{t.completionGrid}:</strong> {completionReport.rows}x{completionReport.cols}
            </div>
            <div style={{ fontSize: "12px", color: "#14532d" }}>
              <strong>{t.completionDiagonal}:</strong> {completionReport.allowDiagonal ? t.yes : t.no}
            </div>
            <div style={{ fontSize: "12px", color: "#14532d" }}>
              <strong>{t.completionAt}:</strong>{" "}
              {new Date(completionReport.completedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
