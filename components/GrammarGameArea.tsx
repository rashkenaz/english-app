
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GrammarExercise } from '../types';

interface GrammarGameAreaProps {
  topicDisplayName: string;
  exercises: GrammarExercise[];
  onExit: () => void;
  onFinish: (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => void;
}

const MAX_LIVES = 3;

// ביטויי עידוד מקומיים - בלי לצרוך קריאת Gemini על כל תשובה נכונה (המכסה החינמית
// מוגבלת ל-20 בקשות ביום, ועידוד הוא הערך הכי פחות חשוב לבזבז עליו מכסה).
const ENCOURAGEMENT_PHRASES = [
  'Amazing job! 🌟', "You're a superstar! ⭐", 'Fantastic! Keep going! 🚀',
  'Wow, so smart! 🧠', 'You nailed it! 🎯', 'Incredible work! 🏆',
  "You're on fire! 🔥", 'Super duper! 🎉', 'Brilliant! 💡', "You're a champion! 🏅",
];
const pickEncouragement = () => ENCOURAGEMENT_PHRASES[Math.floor(Math.random() * ENCOURAGEMENT_PHRASES.length)];

export const GrammarGameArea: React.FC<GrammarGameAreaProps> = ({ topicDisplayName, exercises, onExit, onFinish }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set());
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [showInstructions, setShowInstructions] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [lives, setLives] = useState(MAX_LIVES);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  const advanceTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const hasAdvancedRef = useRef(false);

  const currentExercise = exercises[currentIndex];

  const speak = useCallback((text: string, lang: 'en' | 'he' = 'en') => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'he' ? 'he-IL' : 'en-US';
    utterance.pitch = 1.2;
    utterance.rate = 0.7; // איטי ומדוד, כדי שילד שלומד אנגלית יספיק להבין
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (showInstructions) {
      const timer = setTimeout(() => speak(`Let's practice ${topicDisplayName}!`, 'en'), 500);
      return () => clearTimeout(timer);
    }
  }, [showInstructions, topicDisplayName, speak]);

  useEffect(() => {
    hasAdvancedRef.current = false;
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current);
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showInstructions && currentExercise) {
      const timer = setTimeout(() => speak(currentExercise.sentence.replace('___', 'blank')), 500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentExercise, showInstructions, speak]);

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const clearRetryTimer = () => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const scheduleAdvance = (delay: number) => {
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      handleNext();
    }, delay);
  };

  const scheduleRetry = (delay: number) => {
    clearRetryTimer();
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setIsCorrect(null);
      setSelectedOption(null);
      setFeedback('');
    }, delay);
  };

  const finishSession = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearAdvanceTimer();
    clearRetryTimer();
    onFinish(score, mistakes, Array.from(missedIds), currentIndex + 1, maxCombo);
  };

  const scheduleGameOver = (delay: number) => {
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      finishSession();
    }, delay);
  };

  const playSound = (type: 'correct' | 'wrong') => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {}
  };

  const handleNext = () => {
    if (hasAdvancedRef.current) return;
    clearAdvanceTimer();
    clearRetryTimer();
    // הדגל נקבע רק בענף ה"המשך" - אחרת finishSession() (הענף האחר) היה רואה אותו
    // כבר true ויוצא בלי לקרוא ל-onFinish, והתרגיל האחרון בכל שיעור היה נתקע לצמיתות
    if (currentIndex + 1 < exercises.length) {
      hasAdvancedRef.current = true;
      setCurrentIndex(prev => prev + 1);
      setIsCorrect(null);
      setSelectedOption(null);
      setFeedback('');
    } else {
      finishSession();
    }
  };

  const checkAnswer = (option: string) => {
    if (isCorrect !== null || !currentExercise) return;
    setSelectedOption(option);
    const isMatched = option === currentExercise.correctAnswer;
    if (isMatched) {
      playSound('correct');
      setScore(s => s + 100);
      setCombo(c => { const next = c + 1; setMaxCombo(m => Math.max(m, next)); return next; });
      setIsCorrect(true);
      const msg = pickEncouragement();
      setFeedback(msg);
      speak(msg, 'en');
      scheduleAdvance(1800);
    } else {
      playSound('wrong');
      setMistakes(m => m + 1);
      setMissedIds(prev => new Set(prev).add(currentExercise.id));
      setCombo(0);
      setIsCorrect(false);
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        setFeedback('נגמרו החיים... בפעם הבאה! 💔');
        speak('Game over! Try again next time.', 'en');
        scheduleGameOver(2000);
      } else {
        setFeedback('TRY AGAIN! 💪');
        speak('Try again!', 'en');
        scheduleRetry(1200);
      }
    }
  };

  if (!currentExercise) {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl text-center text-white">
        <p>אין תרגילים זמינים לנושא הזה כרגע.</p>
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-6 py-3 text-white font-black mt-4">חזרה</button>
      </div>
    );
  }

  if (showInstructions) {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <h2 className="text-3xl sm:text-4xl gaming-font text-white">תרגול השיעור 📝</h2>
        <p className="text-base sm:text-lg text-slate-200 leading-relaxed" dir="rtl">
          היום מתרגלים: <span className="text-purple-300 font-black">{topicDisplayName}</span>
        </p>
        <button onClick={() => { window.speechSynthesis.cancel(); setShowInstructions(false); }}
          className="roblox-btn bg-purple-500 border-purple-700 px-10 py-4 text-xl text-white glow-purple w-full">
          לתרגול! 🧠
        </button>
      </div>
    );
  }

  const [before, after] = currentExercise.sentence.split('___');

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-8 glass-panel rounded-3xl shadow-2xl relative transition-all duration-300 flex flex-col items-center gap-5 overflow-hidden">
      <div className="w-full flex items-center justify-between gap-2">
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm flex items-center gap-1">
          🏠 <span className="hidden sm:inline">יציאה</span>
        </button>
        <div className="flex gap-2" dir="rtl">
          <div className="result-badge px-3 py-2 font-black en-font text-red-400 text-sm">{lives} ❤️</div>
          <div className="result-badge px-3 py-2 font-black en-font text-yellow-300 text-sm">⭐ {score}</div>
          <div className="result-badge px-3 py-2 font-black en-font text-sky-300 text-sm">{currentIndex + 1}/{exercises.length}</div>
        </div>
      </div>

      {combo >= 2 && (
        <div className="roblox-btn bg-orange-500 border-orange-700 px-5 py-2 text-white font-black en-font text-sm animate-float">
          🔥 COMBO x{combo}
        </div>
      )}

      <div key={`grammar-${currentIndex}`} className="w-full flex flex-col items-center gap-5 animate-slide-in">
        <div className="w-full word-card p-6 flex flex-col items-center gap-3">
          <button onClick={() => speak(currentExercise.sentence.replace('___', 'blank'))}
            className="roblox-btn bg-sky-500 border-sky-700 w-12 h-12 flex items-center justify-center text-xl text-white rounded-full">🔊</button>
          <h3 className="text-2xl sm:text-3xl en-font text-center leading-relaxed" dir="ltr">
            {before}
            <span className={`inline-block min-w-[70px] px-2 border-b-4 ${isCorrect === true ? 'border-green-500 text-green-600' : isCorrect === false ? 'border-red-500 text-red-600' : 'border-purple-400 text-purple-600'}`}>
              {selectedOption || '___'}
            </span>
            {after}
          </h3>
          {currentExercise.hebrewHint && (
            <p className="text-slate-500 text-sm" dir="rtl">{currentExercise.hebrewHint}</p>
          )}
        </div>

        <div className={`grid gap-3 w-full ${currentExercise.options.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {currentExercise.options.map((opt, i) => (
            <button key={i} disabled={isCorrect !== null} onClick={() => checkAnswer(opt)}
              className={`roblox-btn p-4 text-xl sm:text-2xl text-white uppercase en-font ${
                isCorrect === true && opt === currentExercise.correctAnswer ? 'bg-green-500 border-green-700 scale-105' :
                isCorrect === false && opt === selectedOption ? 'bg-red-500 border-red-700' :
                'bg-purple-500 border-purple-700 hover:bg-purple-400'
              }`}>
              {opt}
            </button>
          ))}
        </div>

        {feedback && (
          <div className={`w-full p-4 rounded-2xl text-xl font-black animate-slide-in text-center glass-panel flex items-center justify-center gap-3 ${
            isCorrect ? 'text-green-300' : 'text-red-300'
          }`} dir="rtl">
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
};
