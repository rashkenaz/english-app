
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SentenceRound, buildSentenceRound, resolveFullSentence } from '../data/sentenceRounds';

interface SentenceGameProps {
  onExit: () => void;
  onFinish: (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => void;
}

type Round = SentenceRound;

const ROUNDS_PER_SESSION = 8;
const buildRound = buildSentenceRound;

export const SentenceGame: React.FC<SentenceGameProps> = ({ onExit, onFinish }) => {
  const [showInstructions, setShowInstructions] = useState(true);
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState<Round>(() => buildRound());
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const advanceTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const hasAdvancedRef = useRef(false);

  const clearAdvance = () => { if (advanceTimerRef.current !== null) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; } };
  const clearRetry = () => { if (retryTimerRef.current !== null) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; } };
  useEffect(() => () => { clearAdvance(); clearRetry(); }, []);
  useEffect(() => { hasAdvancedRef.current = false; }, [roundIndex]);

  const speak = useCallback((text: string, lang: 'en' | 'he' = 'en') => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'he' ? 'he-IL' : 'en-US';
    u.pitch = 1.2;
    u.rate = 0.7;
    window.speechSynthesis.speak(u);
  }, []);

  const buildSentence = (wordEn: string) => resolveFullSentence(round, wordEn);

  const finishSession = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearAdvance(); clearRetry();
    onFinish(score, mistakes, missed, ROUNDS_PER_SESSION, 0);
  };

  const nextRound = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearAdvance(); clearRetry();
    if (roundIndex + 1 < ROUNDS_PER_SESSION) {
      setRound(buildRound());
      setRoundIndex(i => i + 1);
      setIsCorrect(null);
      setSelected(null);
      setFeedback('');
    } else {
      finishSession();
    }
  };

  const choose = (opt: string) => {
    if (isCorrect !== null) return;
    setSelected(opt);
    const correct = opt === round.targetWord.en;
    if (correct) {
      setScore(s => s + 100);
      setIsCorrect(true);
      setFeedback('מעולה! 🌟');
      speak(buildSentence(opt), 'en');
      clearAdvance();
      advanceTimerRef.current = window.setTimeout(() => { advanceTimerRef.current = null; nextRound(); }, 2000);
    } else {
      setMistakes(m => m + 1);
      setMissed(prev => [...prev, round.targetWord.en]);
      setIsCorrect(false);
      setFeedback('נסו שוב 💪');
      clearRetry();
      retryTimerRef.current = window.setTimeout(() => { retryTimerRef.current = null; setIsCorrect(null); setSelected(null); setFeedback(''); }, 1200);
    }
  };

  if (showInstructions) {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <h2 className="text-3xl sm:text-4xl gaming-font text-white">בניית משפטים ✍️</h2>
        <p className="text-base sm:text-lg text-slate-200 leading-relaxed" dir="rtl">השלימו את המשפט עם המילה הנכונה לפי התמונה!</p>
        <button onClick={() => setShowInstructions(false)} className="roblox-btn bg-teal-500 border-teal-700 px-10 py-4 text-xl text-white w-full">
          בואו נתחיל! 🚀
        </button>
      </div>
    );
  }

  const [before, after] = round.pattern.pattern.split('{thing}');
  const afterResolved = round.secondWord ? after.replace(/\{color\}|\{adjective\}/, round.secondWord.en) : after;

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-8 glass-panel rounded-3xl shadow-2xl flex flex-col items-center gap-5">
      <div className="w-full flex items-center justify-between gap-2">
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm">🏠</button>
        <div className="flex gap-2">
          <div className="result-badge px-3 py-2 font-black en-font text-yellow-300 text-sm">⭐ {score}</div>
          <div className="result-badge px-3 py-2 font-black en-font text-sky-300 text-sm">{roundIndex + 1}/{ROUNDS_PER_SESSION}</div>
        </div>
      </div>

      <div className="word-card w-full p-8 flex flex-col items-center gap-4">
        <span className="text-6xl">{round.targetWord.emoji || '❓'}</span>
        <p className="text-xl sm:text-2xl font-black text-center leading-relaxed en-font" dir="ltr">
          {before}<span className={`inline-block px-2 border-b-4 ${isCorrect === true ? 'border-green-500 text-green-600' : isCorrect === false ? 'border-red-500 text-red-600' : 'border-teal-400 text-teal-600'}`}>{selected || '___'}</span>{afterResolved}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {round.options.map((opt, i) => (
          <button key={i} disabled={isCorrect !== null} onClick={() => choose(opt)}
            className={`roblox-btn p-4 text-xl text-white disabled:opacity-60 en-font ${
              isCorrect === true && opt === round.targetWord.en ? 'bg-green-500 border-green-700' :
              isCorrect === false && opt === selected ? 'bg-red-500 border-red-700' : 'bg-teal-500 border-teal-700'
            }`}>
            {opt}
          </button>
        ))}
      </div>

      {feedback && <div className="w-full p-4 rounded-2xl text-lg font-black text-center glass-panel" dir="rtl">{feedback}</div>}
    </div>
  );
};
