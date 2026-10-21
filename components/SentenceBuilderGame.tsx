
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { buildSentenceRound, resolveFullSentence } from '../data/sentenceRounds';

interface SentenceBuilderGameProps {
  onExit: () => void;
  onFinish: (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => void;
}

interface WordTile { id: number; word: string; used: boolean; }

const ROUNDS_PER_SESSION = 6;

// מילות המשפט (בלי הנקודה - היא תמיד מתווספת אוטומטית בסוף, לא אריח לתפוס)
const buildWordTiles = (): { words: string[]; targetEn: string } => {
  const round = buildSentenceRound();
  const sentence = resolveFullSentence(round, round.targetWord.en);
  const words = sentence.replace(/\.$/, '').split(' ');
  return { words, targetEn: round.targetWord.en };
};

const shuffleTiles = (words: string[]): WordTile[] => {
  let shuffled: string[];
  do {
    shuffled = [...words].sort(() => 0.5 - Math.random());
  } while (words.length > 1 && shuffled.join(' ') === words.join(' '));
  return shuffled.map((word, id) => ({ id, word, used: false }));
};

export const SentenceBuilderGame: React.FC<SentenceBuilderGameProps> = ({ onExit, onFinish }) => {
  const [showInstructions, setShowInstructions] = useState(true);
  const [roundIndex, setRoundIndex] = useState(0);
  const [target, setTarget] = useState<string[]>(() => buildWordTiles().words);
  const [bank, setBank] = useState<WordTile[]>(() => shuffleTiles(target));
  const [placed, setPlaced] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState('');

  const advanceTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const hasAdvancedRef = useRef(false);

  const clearAdvance = () => { if (advanceTimerRef.current !== null) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; } };
  const clearRetry = () => { if (retryTimerRef.current !== null) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; } };
  useEffect(() => () => { clearAdvance(); clearRetry(); }, []);
  useEffect(() => { hasAdvancedRef.current = false; }, [roundIndex]);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.pitch = 1.2;
    u.rate = 0.7;
    window.speechSynthesis.speak(u);
  }, []);

  const assembledWords = placed.map(id => bank.find(t => t.id === id)?.word || '');

  const finishSession = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearAdvance(); clearRetry();
    // missedIds תמיד [] בכוונה: טעות בסדר מילים היא מבנית (תחביר), לא לקסיקלית -
    // לא הגיוני לתייג מילה בודדת מתוכה ל"תרגול טעויות".
    onFinish(score, mistakes, [], ROUNDS_PER_SESSION, 0);
  };

  const nextRound = () => {
    if (hasAdvancedRef.current) return;
    clearAdvance(); clearRetry();
    // הדגל נקבע רק בענף ה"המשך" - אחרת finishSession() (הענף האחר) היה רואה
    // אותו כבר true ויוצא בלי לקרוא ל-onFinish, והסבב האחרון היה נתקע לצמיתות.
    if (roundIndex + 1 < ROUNDS_PER_SESSION) {
      hasAdvancedRef.current = true;
      const next = buildWordTiles();
      setTarget(next.words);
      setBank(shuffleTiles(next.words));
      setPlaced([]);
      setRoundIndex(i => i + 1);
      setIsCorrect(null);
      setFeedback('');
    } else {
      finishSession();
    }
  };

  const tapWord = (tile: WordTile) => {
    if (isCorrect !== null || tile.used || placed.length >= target.length) return;
    setBank(prev => prev.map(t => (t.id === tile.id ? { ...t, used: true } : t)));
    setPlaced(prev => [...prev, tile.id]);
  };

  const removeLast = () => {
    if (isCorrect !== null || placed.length === 0) return;
    const lastId = placed[placed.length - 1];
    setPlaced(prev => prev.slice(0, -1));
    setBank(prev => prev.map(t => (t.id === lastId ? { ...t, used: false } : t)));
  };

  const checkOrder = () => {
    if (isCorrect !== null || placed.length !== target.length) return;
    const matched = target.every((w, i) => w === assembledWords[i]);
    if (matched) {
      setScore(s => s + 100);
      setIsCorrect(true);
      setFeedback('מעולה! 🌟');
      speak(target.join(' ') + '.');
      clearAdvance();
      advanceTimerRef.current = window.setTimeout(() => { advanceTimerRef.current = null; nextRound(); }, 2000);
    } else {
      setMistakes(m => m + 1);
      setIsCorrect(false);
      setFeedback('הסדר לא נכון - נסו שוב 💪');
      clearRetry();
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        setIsCorrect(null);
        setFeedback('');
        setPlaced([]);
        setBank(prev => prev.map(t => ({ ...t, used: false })));
      }, 1400);
    }
  };

  if (showInstructions) {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <h2 className="text-3xl sm:text-4xl gaming-font text-white">סדר את המשפט 🧩</h2>
        <p className="text-base sm:text-lg text-slate-200 leading-relaxed" dir="rtl">הקישו על המילים לפי הסדר הנכון כדי להרכיב משפט!</p>
        <button onClick={() => setShowInstructions(false)} className="roblox-btn bg-indigo-500 border-indigo-700 px-10 py-4 text-xl text-white w-full">
          בואו נסדר! 🔤
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-8 glass-panel rounded-3xl shadow-2xl flex flex-col items-center gap-5">
      <div className="w-full flex items-center justify-between gap-2">
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm">🏠</button>
        <div className="flex gap-2">
          <div className="result-badge px-3 py-2 font-black en-font text-yellow-300 text-sm">⭐ {score}</div>
          <div className="result-badge px-3 py-2 font-black en-font text-sky-300 text-sm">{roundIndex + 1}/{ROUNDS_PER_SESSION}</div>
        </div>
      </div>

      {/* שורת המשפט המורכב - dir="ltr" מפורש, אחרת ה-RTL של העמוד הופך את סדר התאים */}
      <div className="word-card w-full p-6 flex flex-wrap gap-2 justify-center min-h-[5.5rem] items-center" dir="ltr">
        {target.map((_, i) => {
          const word = i < assembledWords.length ? assembledWords[i] : '';
          return (
            <div key={i} className={`px-3 py-2 rounded-xl text-lg sm:text-xl font-black en-font ${
              word ? (isCorrect === true ? 'bg-green-100 text-green-700' : isCorrect === false ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700') : 'border-2 border-dashed border-slate-400 text-slate-400 min-w-[3rem] text-center'
            }`}>
              {word || '___'}
            </div>
          );
        })}
        {isCorrect !== null && <span className="text-lg sm:text-xl font-black text-slate-500">.</span>}
      </div>

      <div className="flex flex-wrap gap-2 justify-center w-full" dir="ltr">
        {bank.map(tile => (
          <button key={tile.id} disabled={isCorrect !== null || tile.used || placed.length >= target.length}
            onClick={() => tapWord(tile)}
            className={`roblox-btn px-4 py-3 text-lg font-black en-font ${tile.used ? 'opacity-25 bg-slate-700 border-slate-800' : 'bg-white text-slate-900 border-slate-300'}`}>
            {tile.word}
          </button>
        ))}
        <button disabled={isCorrect !== null || placed.length === 0} onClick={removeLast}
          className="roblox-btn px-4 py-3 text-lg font-black bg-red-500 border-red-700 text-white disabled:opacity-30">⌫</button>
      </div>

      <button onClick={checkOrder} disabled={isCorrect !== null || placed.length !== target.length}
        className="roblox-btn w-full bg-green-500 border-green-700 py-4 text-xl text-white glow-green disabled:opacity-40">
        בדוק ⚡
      </button>

      {feedback && <div className="w-full p-4 rounded-2xl text-lg font-black text-center glass-panel" dir="rtl">{feedback}</div>}
    </div>
  );
};
