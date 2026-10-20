
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { STORY, CLASSIFY_CATEGORY_LABELS } from '../data/curriculum';

interface StoryGameProps {
  onExit: () => void;
  onFinish: (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => void;
}

type Phase = 'INSTRUCTIONS' | 'READ' | 'YESNO' | 'CLASSIFY';

interface ClassifyItem { word: string; category: string; }

export const StoryGame: React.FC<StoryGameProps> = ({ onExit, onFinish }) => {
  const [phase, setPhase] = useState<Phase>('INSTRUCTIONS');
  const [readIndex, setReadIndex] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [missedWords, setMissedWords] = useState<string[]>([]);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);

  const [classifyItems] = useState<ClassifyItem[]>(() => {
    const items: ClassifyItem[] = [];
    Object.entries(STORY.classifyWords).forEach(([cat, words]) => {
      words.forEach(w => items.push({ word: w, category: cat }));
    });
    return items.sort(() => 0.5 - Math.random());
  });
  const [classifyIndex, setClassifyIndex] = useState(0);
  const [classifyAnswered, setClassifyAnswered] = useState<boolean | null>(null);

  const advanceTimerRef = useRef<number | null>(null);
  const hasAdvancedRef = useRef(false);

  const clearAdvance = () => { if (advanceTimerRef.current !== null) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; } };
  useEffect(() => () => clearAdvance(), []);

  const speak = useCallback((text: string, lang: 'en' | 'he' = 'en') => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'he' ? 'he-IL' : 'en-US';
    u.pitch = 1.2;
    u.rate = 0.7;
    window.speechSynthesis.speak(u);
  }, []);

  const totalItems = STORY.yesNo.length + classifyItems.length;

  const finish = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearAdvance();
    onFinish(score, mistakes, missedWords, totalItems, 0);
  };

  // --- READ phase ---
  useEffect(() => {
    if (phase === 'READ') speak(STORY.text[readIndex], 'en');
  }, [phase, readIndex, speak]);

  // --- YES/NO phase ---
  useEffect(() => {
    if (phase === 'YESNO' && answered === null) {
      const timer = setTimeout(() => speak(STORY.yesNo[qIndex].q, 'en'), 400);
      return () => clearTimeout(timer);
    }
  }, [phase, qIndex, answered, speak]);

  const answerYesNo = (choice: 'YES' | 'NO') => {
    if (answered !== null) return;
    const correct = choice === STORY.yesNo[qIndex].a;
    setAnswered(correct);
    if (correct) { setScore(s => s + 100); setFeedback('נכון! 🌟'); } else { setMistakes(m => m + 1); setFeedback(`לא מדויק - התשובה: ${STORY.yesNo[qIndex].a === 'YES' ? 'כן' : 'לא'}`); }
    clearAdvance();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      setAnswered(null);
      setFeedback('');
      if (qIndex + 1 < STORY.yesNo.length) {
        setQIndex(i => i + 1);
      } else {
        setPhase('CLASSIFY');
      }
    }, 1600);
  };

  // --- CLASSIFY phase ---
  const answerClassify = (chosenCategory: string) => {
    if (classifyAnswered !== null) return;
    const item = classifyItems[classifyIndex];
    const correct = chosenCategory === item.category;
    setClassifyAnswered(correct);
    if (correct) { setScore(s => s + 100); setFeedback('מצוין! 🎯'); } else { setMistakes(m => m + 1); setMissedWords(prev => [...prev, item.word]); setFeedback(`זה שייך ל-${CLASSIFY_CATEGORY_LABELS[item.category]}`); }
    clearAdvance();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      setClassifyAnswered(null);
      setFeedback('');
      if (classifyIndex + 1 < classifyItems.length) {
        setClassifyIndex(i => i + 1);
      } else {
        finish();
      }
    }, 1400);
  };

  if (phase === 'INSTRUCTIONS') {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <h2 className="text-3xl sm:text-4xl gaming-font text-white">הסיפור של דן ותמי 📖</h2>
        <p className="text-base sm:text-lg text-slate-200 leading-relaxed" dir="rtl">נקרא סיפור קצר, נענה על שאלות, ואז נמיין מילים לקבוצות!</p>
        <button onClick={() => setPhase('READ')} className="roblox-btn bg-amber-500 border-amber-700 px-10 py-4 text-xl text-white w-full">
          לקרוא! 📚
        </button>
      </div>
    );
  }

  if (phase === 'READ') {
    const isLast = readIndex === STORY.text.length - 1;
    return (
      <div className="max-w-lg mx-auto p-4 sm:p-8 glass-panel rounded-3xl shadow-2xl flex flex-col items-center gap-5">
        <div className="w-full flex items-center justify-between gap-2">
          <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm">🏠</button>
          <div className="result-badge px-3 py-2 font-black en-font text-sky-300 text-sm">{readIndex + 1}/{STORY.text.length}</div>
        </div>
        <div className="word-card w-full p-8 flex flex-col items-center gap-3 cursor-pointer" onClick={() => speak(STORY.text[readIndex], 'en')}>
          <span className="text-2xl">🔊</span>
          <p className="text-2xl sm:text-3xl font-black text-center en-font" dir="ltr">{STORY.text[readIndex]}</p>
          {showTranslation && <p className="text-base text-slate-500 text-center" dir="rtl">{STORY.he[readIndex]}</p>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); setShowTranslation(s => !s); }}
          className="roblox-btn bg-slate-600 border-slate-800 w-full py-2 text-sm text-white">
          {showTranslation ? 'הסתר תרגום 🙈' : 'הצג תרגום 👁️'}
        </button>
        <button onClick={() => (isLast ? setPhase('YESNO') : setReadIndex(i => i + 1))}
          className="roblox-btn w-full bg-amber-500 border-amber-700 py-4 text-xl text-white">
          {isLast ? 'לשאלות! ❓' : 'המשך ⬅️'}
        </button>
      </div>
    );
  }

  if (phase === 'YESNO') {
    const q = STORY.yesNo[qIndex];
    return (
      <div className="max-w-lg mx-auto p-4 sm:p-8 glass-panel rounded-3xl shadow-2xl flex flex-col items-center gap-5">
        <div className="w-full flex items-center justify-between gap-2">
          <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm">🏠</button>
          <div className="flex gap-2">
            <div className="result-badge px-3 py-2 font-black en-font text-yellow-300 text-sm">⭐ {score}</div>
            <div className="result-badge px-3 py-2 font-black en-font text-sky-300 text-sm">{qIndex + 1}/{STORY.yesNo.length}</div>
          </div>
        </div>
        <div className="word-card w-full p-8 flex flex-col items-center gap-3">
          <button onClick={() => speak(q.q, 'en')} className="text-2xl">🔊</button>
          <p className="text-2xl sm:text-3xl font-black text-center en-font" dir="ltr">{q.q}</p>
        </div>
        <div className="w-full grid grid-cols-2 gap-3">
          <button disabled={answered !== null} onClick={() => answerYesNo('NO')}
            className={`roblox-btn py-5 text-xl text-white disabled:opacity-60 ${answered !== null && q.a === 'NO' ? 'bg-green-500 border-green-700' : 'bg-red-500 border-red-700'}`}>לא ✗</button>
          <button disabled={answered !== null} onClick={() => answerYesNo('YES')}
            className={`roblox-btn py-5 text-xl text-white disabled:opacity-60 ${answered !== null && q.a === 'YES' ? 'bg-green-500 border-green-700' : 'bg-green-500 border-green-700'}`}>כן ✓</button>
        </div>
        {feedback && <div className="w-full p-4 rounded-2xl text-lg font-black text-center glass-panel" dir="rtl">{feedback}</div>}
      </div>
    );
  }

  // CLASSIFY
  const item = classifyItems[classifyIndex];
  const categories = Object.keys(STORY.classifyWords);
  return (
    <div className="max-w-lg mx-auto p-4 sm:p-8 glass-panel rounded-3xl shadow-2xl flex flex-col items-center gap-5">
      <div className="w-full flex items-center justify-between gap-2">
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm">🏠</button>
        <div className="flex gap-2">
          <div className="result-badge px-3 py-2 font-black en-font text-yellow-300 text-sm">⭐ {score}</div>
          <div className="result-badge px-3 py-2 font-black en-font text-sky-300 text-sm">{classifyIndex + 1}/{classifyItems.length}</div>
        </div>
      </div>
      <p className="text-slate-200 font-bold" dir="rtl">לאיזו קבוצה שייכת המילה?</p>
      <div className="word-card w-full p-8 flex items-center justify-center">
        <p className="text-4xl font-black en-font" dir="ltr">{item.word}</p>
      </div>
      <div className="w-full grid grid-cols-3 gap-2">
        {categories.map(cat => (
          <button key={cat} disabled={classifyAnswered !== null} onClick={() => answerClassify(cat)}
            className={`roblox-btn p-3 text-sm text-white disabled:opacity-60 ${
              classifyAnswered !== null && cat === item.category ? 'bg-green-500 border-green-700' : 'bg-indigo-500 border-indigo-700'
            }`}>
            {CLASSIFY_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>
      {feedback && <div className="w-full p-4 rounded-2xl text-lg font-black text-center glass-panel" dir="rtl">{feedback}</div>}
    </div>
  );
};
