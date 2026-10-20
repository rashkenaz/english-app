
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { CURRICULUM_VOCAB } from '../data/curriculum';
import { generateWordHuntGrid, WordPlacement } from '../data/wordHuntGrid';

interface WordHuntGameProps {
  onExit: () => void;
  onFinish: (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => void;
}

const GRID_SIZE = 8;
const WORD_COUNT = 5;

const pickWords = (): { en: string; he: string }[] => {
  const uniqueByEn = Array.from(new Map(
    CURRICULUM_VOCAB.filter(w => w.en.length >= 3 && w.en.length <= GRID_SIZE).map(w => [w.en.toLowerCase(), w])
  ).values());
  return uniqueByEn.sort(() => 0.5 - Math.random()).slice(0, WORD_COUNT).map(w => ({ en: w.en, he: w.he }));
};

const cellKey = (r: number, c: number) => `${r},${c}`;

export const WordHuntGame: React.FC<WordHuntGameProps> = ({ onExit, onFinish }) => {
  const [showInstructions, setShowInstructions] = useState(true);
  const [words] = useState(() => pickWords());
  const { grid, placements } = useMemo<{ grid: string[][]; placements: WordPlacement[] }>(
    () => generateWordHuntGrid(words.map(w => w.en), GRID_SIZE), [words]
  );

  const [anchor, setAnchor] = useState<[number, number] | null>(null);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [flashCells, setFlashCells] = useState<Set<string> | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const flashTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const hasAdvancedRef = useRef(false);

  const clearFlashTimer = () => { if (flashTimerRef.current !== null) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; } };
  const clearAdvance = () => { if (advanceTimerRef.current !== null) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; } };
  useEffect(() => () => { clearFlashTimer(); clearAdvance(); }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.pitch = 1.2;
    u.rate = 0.7;
    window.speechSynthesis.speak(u);
  }, []);

  const totalWords = placements.length; // אם אלגוריתם ההשמה הפיל מילה - totalWords יהיה קטן ממה שנבחר, וזה בסדר

  const finishSession = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearAdvance(); clearFlashTimer();
    // missedIds תמיד [] בכוונה: לא למצוא מילה בחיפוש ויזואלי זה לא כשל ידע (ולא
    // מתייג "תרגול טעויות"). תופעת לוואי: accuracy תמיד 100% גם עם טעויות ניסיון - מקובל למשחק-השלמה.
    onFinish(foundWords.size * 100, wrongAttempts, [], totalWords, 0);
  };

  // סיום אוטומטי ברגע שכל המילים נמצאו
  useEffect(() => {
    if (totalWords > 0 && foundWords.size === totalWords && !hasAdvancedRef.current) {
      advanceTimerRef.current = window.setTimeout(() => { advanceTimerRef.current = null; finishSession(); }, 1200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundWords, totalWords]);

  const handleCellTap = (r: number, c: number) => {
    const key = cellKey(r, c);
    if (foundCells.has(key)) return;
    if (!anchor) { setAnchor([r, c]); return; }
    const [ar, ac] = anchor;
    if (ar === r && ac === c) { setAnchor(null); return; }
    if (ar !== r && ac !== c) { setAnchor([r, c]); return; } // לא באותה שורה/עמודה - מתחילים בחירה חדשה מכאן

    const between: [number, number][] = [];
    if (ar === r) {
      const [c1, c2] = [Math.min(ac, c), Math.max(ac, c)];
      for (let cc = c1; cc <= c2; cc++) between.push([r, cc]);
    } else {
      const [r1, r2] = [Math.min(ar, r), Math.max(ar, r)];
      for (let rr = r1; rr <= r2; rr++) between.push([rr, c]);
    }
    const selSet = new Set(between.map(([rr, cc]) => cellKey(rr, cc)));
    const match = placements.find(p =>
      !foundWords.has(p.word) && p.cells.length === between.length && p.cells.every(([rr, cc]) => selSet.has(cellKey(rr, cc)))
    );
    setAnchor(null);
    if (match) {
      setFoundWords(prev => new Set(prev).add(match.word));
      setFoundCells(prev => { const next = new Set(prev); match.cells.forEach(([rr, cc]) => next.add(cellKey(rr, cc))); return next; });
      speak(match.word);
    } else {
      setWrongAttempts(w => w + 1);
      clearFlashTimer();
      setFlashCells(selSet);
      flashTimerRef.current = window.setTimeout(() => { flashTimerRef.current = null; setFlashCells(null); }, 500);
    }
  };

  if (showInstructions) {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <h2 className="text-3xl sm:text-4xl gaming-font text-white">ציד המילים 🔍</h2>
        <p className="text-base sm:text-lg text-slate-200 leading-relaxed" dir="rtl">מצאו את כל המילים ברשת! הקישו על האות הראשונה ואז על האחרונה.</p>
        <button onClick={() => setShowInstructions(false)} className="roblox-btn bg-red-500 border-red-700 px-10 py-4 text-xl text-white w-full">
          לצאת לציד! 🎯
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center gap-4">
      <div className="w-full flex items-center justify-between gap-2">
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm">🏠</button>
        <div className="result-badge px-3 py-2 font-black gaming-font text-sky-300 text-sm">{foundWords.size}/{totalWords} נמצאו</div>
      </div>

      <div className="grid grid-cols-5 gap-1.5 w-full" dir="rtl">
        {words.map(w => (
          <div key={w.en} className={`rounded-xl p-1.5 text-center transition-all ${
            foundWords.has(w.en.toUpperCase()) ? 'bg-green-500/30 text-green-200' : 'bg-white/10 text-slate-300'
          }`}>
            <p className={`text-xs font-black en-font ${foundWords.has(w.en.toUpperCase()) ? 'line-through' : ''}`} dir="ltr">{w.en}</p>
            {foundWords.has(w.en.toUpperCase()) && <p className="text-[10px]">{w.he}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-1 w-full" dir="ltr" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
        {grid.map((row, r) => row.map((letter, c) => {
          const key = cellKey(r, c);
          const isFound = foundCells.has(key);
          const isAnchor = anchor && anchor[0] === r && anchor[1] === c;
          const isFlash = flashCells?.has(key);
          return (
            <button key={key} onClick={() => handleCellTap(r, c)}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm sm:text-base font-black en-font transition-all ${
                isFound ? 'bg-green-500 text-white' :
                isFlash ? 'bg-red-500 text-white' :
                isAnchor ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-200' :
                'bg-white/90 text-slate-800 active:scale-90'
              }`}>
              {letter}
            </button>
          );
        }))}
      </div>
    </div>
  );
};
