
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VOWEL_GROUPS, VOWEL_SOUND_GROUPS, FP_GROUPS } from '../data/curriculum';

interface PhonicsGameProps {
  onExit: () => void;
  onFinish: (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => void;
}

type SubMode = 'VOWELS' | 'FP';
const ROUNDS_PER_SESSION = 10;
const VOWELS = ['a', 'e', 'i', 'o', 'u'];

const pickVowelRound = () => {
  const vowel = VOWELS[Math.floor(Math.random() * VOWELS.length)];
  const words = VOWEL_GROUPS[vowel];
  const word = words[Math.floor(Math.random() * words.length)];
  return { word, answer: vowel };
};

const pickFpRound = () => {
  const letter = Math.random() < 0.5 ? 'f' : 'p';
  const words = FP_GROUPS[letter as 'f' | 'p'];
  const word = words[Math.floor(Math.random() * words.length)];
  return { word, answer: letter };
};

export const PhonicsGame: React.FC<PhonicsGameProps> = ({ onExit, onFinish }) => {
  const [subMode, setSubMode] = useState<SubMode | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState<{ word: string; answer: string } | null>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const advanceTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const hasAdvancedRef = useRef(false);
  // מונע שכמה ניסיונות שגויים על אותו סבב (לפני הצלחה) יספרו ככמה "פספוסים" -
  // ראו הסבר מקביל ב-ColorLabGame.tsx
  const hasMissedRoundRef = useRef(false);

  const clearAdvance = () => { if (advanceTimerRef.current !== null) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; } };
  const clearRetry = () => { if (retryTimerRef.current !== null) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; } };
  useEffect(() => () => { clearAdvance(); clearRetry(); }, []);
  useEffect(() => { hasAdvancedRef.current = false; hasMissedRoundRef.current = false; }, [roundIndex]);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.pitch = 1.2;
    u.rate = 0.65;
    window.speechSynthesis.speak(u);
  }, []);

  useEffect(() => {
    if (round) { const t = setTimeout(() => speak(round.word), 400); return () => clearTimeout(t); }
  }, [round, speak]);

  const startMode = (mode: SubMode) => {
    setSubMode(mode);
    setRound(mode === 'VOWELS' ? pickVowelRound() : pickFpRound());
  };

  const finishSession = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearAdvance(); clearRetry();
    onFinish(score, mistakes, missed, ROUNDS_PER_SESSION, 0);
  };

  const nextRound = () => {
    if (hasAdvancedRef.current) return;
    clearAdvance(); clearRetry();
    // הדגל נקבע רק בענף ה"המשך" - אחרת finishSession() (הענף האחר) היה רואה
    // אותו כבר true ויוצא בלי לקרוא ל-onFinish, והסבב האחרון היה נתקע לצמיתות.
    if (roundIndex + 1 < ROUNDS_PER_SESSION) {
      hasAdvancedRef.current = true;
      setRound(subMode === 'VOWELS' ? pickVowelRound() : pickFpRound());
      setRoundIndex(i => i + 1);
      setIsCorrect(null);
      setSelected(null);
      setFeedback('');
    } else {
      finishSession();
    }
  };

  const choose = (letter: string) => {
    if (isCorrect !== null || !round) return;
    setSelected(letter);
    // ב-VOWELS הבחירה היא קבוצת-צליל בעברית (למשל 'א') שעשויה להכיל כמה אותיות
    // אנגליות (a,u) - לכן הבדיקה היא הכלה בקבוצה, לא שוויון ישיר כמו ב-FP
    const correct = subMode === 'VOWELS' ? (VOWEL_SOUND_GROUPS[letter]?.includes(round.answer) ?? false) : letter === round.answer;
    if (correct) {
      setScore(s => s + 100);
      setIsCorrect(true);
      setFeedback('מצוין! 🎯');
      clearAdvance();
      advanceTimerRef.current = window.setTimeout(() => { advanceTimerRef.current = null; nextRound(); }, 1500);
    } else {
      setMistakes(m => m + 1);
      if (!hasMissedRoundRef.current) {
        hasMissedRoundRef.current = true;
        setMissed(prev => [...prev, round.word]);
      }
      setIsCorrect(false);
      setFeedback('נסו שוב 💪');
      clearRetry();
      retryTimerRef.current = window.setTimeout(() => { retryTimerRef.current = null; setIsCorrect(null); setSelected(null); setFeedback(''); }, 1200);
    }
  };

  if (!subMode) {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <h2 className="text-3xl sm:text-4xl gaming-font text-white">צלילים ותנועות 🔤</h2>
        <p className="text-base sm:text-lg text-slate-200 leading-relaxed" dir="rtl">באיזה תרגול רוצים להתחיל?</p>
        <div className="w-full grid grid-cols-1 gap-3">
          <button onClick={() => startMode('VOWELS')} className="roblox-btn bg-rose-500 border-rose-700 py-4 text-xl text-white">תנועות a e i o u 🔊</button>
          <button onClick={() => startMode('FP')} className="roblox-btn bg-cyan-500 border-cyan-700 py-4 text-xl text-white">הבדלה f / p 👂</button>
        </div>
      </div>
    );
  }

  if (!round) return null;

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-8 glass-panel rounded-3xl shadow-2xl flex flex-col items-center gap-5">
      <div className="w-full flex items-center justify-between gap-2">
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm">🏠</button>
        <div className="flex gap-2">
          <div className="result-badge px-3 py-2 font-black en-font text-yellow-300 text-sm">⭐ {score}</div>
          <div className="result-badge px-3 py-2 font-black en-font text-sky-300 text-sm">{roundIndex + 1}/{ROUNDS_PER_SESSION}</div>
        </div>
      </div>

      <p className="text-slate-200 font-bold" dir="rtl">{subMode === 'VOWELS' ? 'איזה צליל שומעים במילה?' : 'f או p?'}</p>

      <div className="word-card w-full p-8 flex flex-col items-center gap-3 cursor-pointer" onClick={() => speak(round.word)}>
        <span className="text-2xl">🔊</span>
        <p className="text-4xl font-black en-font" dir="ltr">{round.word}</p>
      </div>

      <div className={`grid gap-3 w-full ${subMode === 'VOWELS' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {subMode === 'VOWELS' ? Object.keys(VOWEL_SOUND_GROUPS).map(group => (
          <button key={group} disabled={isCorrect !== null} onClick={() => choose(group)}
            className={`roblox-btn p-4 text-3xl font-black text-white disabled:opacity-60 flex flex-col items-center gap-1 ${
              isCorrect !== null && VOWEL_SOUND_GROUPS[group].includes(round.answer) ? 'bg-green-500 border-green-700' :
              isCorrect === false && group === selected ? 'bg-red-500 border-red-700' : 'bg-rose-500 border-rose-700'
            }`} dir="rtl">
            {group}
          </button>
        )) : ['f', 'p'].map(letter => (
          <button key={letter} disabled={isCorrect !== null} onClick={() => choose(letter)}
            className={`roblox-btn p-6 text-3xl font-black text-white disabled:opacity-60 en-font ${
              isCorrect !== null && letter === round.answer ? 'bg-green-500 border-green-700' :
              isCorrect === false && letter === selected ? 'bg-red-500 border-red-700' : 'bg-cyan-500 border-cyan-700'
            }`}>
            {letter}
          </button>
        ))}
      </div>

      {feedback && <div className="w-full p-4 rounded-2xl text-lg font-black text-center glass-panel" dir="rtl">{feedback}</div>}
    </div>
  );
};
