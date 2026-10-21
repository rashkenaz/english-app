
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordEntry, TranslationDirection } from '../types';
import { generateExampleSentence } from '../services/geminiService';

interface MemoryCard {
  id: string;
  text: string;
  wordId: string;
  type: 'EN' | 'HE';
}

interface LetterTile {
  id: number;
  char: string;
  used: boolean;
}

interface GameAreaProps {
  words: WordEntry[];
  onFinish: (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => void;
  onExit: () => void;
  gameType: 'FLASHCARDS' | 'SPELLING' | 'QUIZ' | 'MEMORY';
  direction: TranslationDirection;
  difficulty: number;
  onExampleGenerated?: (wordId: string, example: string, exampleHebrew: string) => void;
  silent?: boolean; // ללא הקראה אוטומטית/כפתור שמע - למשחקי קריאה כמו "שמות", שבהם המטרה היא לקרוא ולזהות, לא לשמוע
  timedSeconds?: number; // מצב "מרוץ" (Quiz Race) - שעון יורד במקום/בנוסף ללבבות, וקצב מהיר יותר בין שאלות
}

const MAX_LIVES = 3;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const GAME_INSTRUCTIONS = {
  FLASHCARDS: { title: "מאסטר הכרטיסיות 🎴", desc: "הפוך את הקלפים וגלה את הסודות שמאחורי המילים!", btn: "מתחילים! 🚀", voice: "Flip the cards and reveal the secrets behind the words.", color: 'bg-sky-500 border-sky-700' },
  QUIZ:       { title: "קרב מהיר 🎯", desc: "בחר את התרגום הנכון מהאפשרויות. הדיוק הוא הכוח שלך!", btn: "לקרב! ⚔️", voice: "Choose the correct translation. Accuracy is your power!", color: 'bg-pink-500 border-pink-700' },
  SPELLING:   { title: "מלך המקלדת ⌨️", desc: "הרכיבו את המילה מהאותיות כדי לכבוש את הממלכה!", btn: "להקלדה! 👑", voice: "Build the words to conquer the kingdom!", color: 'bg-green-500 border-green-700' },
  MEMORY:     { title: "כספת המוח 🧠", desc: "התאם בין המילים לתרגום שלהן!", btn: "לפצח! 🔓", voice: "Match the words with their translation!", color: 'bg-purple-500 border-purple-700' }
};

// ביטויי עידוד מקומיים - בלי לצרוך קריאת Gemini על כל תשובה נכונה (המכסה החינמית
// מוגבלת ל-20 בקשות ביום, ועידוד הוא הערך הכי פחות חשוב לבזבז עליו מכסה).
const ENCOURAGEMENT_PHRASES = [
  'Amazing job! 🌟', "You're a superstar! ⭐", 'Fantastic! Keep going! 🚀',
  'Wow, so smart! 🧠', 'You nailed it! 🎯', 'Incredible work! 🏆',
  "You're on fire! 🔥", 'Super duper! 🎉', 'Brilliant! 💡', "You're a champion! 🏅",
];
const pickEncouragement = () => ENCOURAGEMENT_PHRASES[Math.floor(Math.random() * ENCOURAGEMENT_PHRASES.length)];

const generateLetterBank = (word: string): LetterTile[] => {
  const target = word.toUpperCase().replace(/[^A-Z]/g, '').split('');
  const distractorCount = Math.min(4, Math.max(2, 8 - target.length));
  const distractors: string[] = [];
  while (distractors.length < distractorCount) {
    distractors.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  }
  return [...target, ...distractors]
    .map((char, id) => ({ id, char, used: false }))
    .sort(() => 0.5 - Math.random());
};

export const GameArea: React.FC<GameAreaProps> = ({ words, onFinish, onExit, gameType, direction, difficulty, onExampleGenerated, silent, timedSeconds }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set());
  const [inputValue, setInputValue] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [options, setOptions] = useState<string[]>([]);
  const [showInstructions, setShowInstructions] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [lives, setLives] = useState(MAX_LIVES);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const [letterBank, setLetterBank] = useState<LetterTile[]>([]);
  const [assembledOrder, setAssembledOrder] = useState<number[]>([]);

  const [memoryCards, setMemoryCards] = useState<MemoryCard[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedWordIds, setMatchedWordIds] = useState<string[]>([]);
  const [isMemoryProcessing, setIsMemoryProcessing] = useState(false);

  const [loadingExample, setLoadingExample] = useState(false);
  const [exampleShown, setExampleShown] = useState<{ en: string; he: string } | null>(null);

  const currentWord = words[currentIndex];
  // במצב מתוזמן (מרוץ) השעון הוא הלחץ - לבבות + שעון ביחד זה עונש כפול לילד
  const hasHearts = (gameType === 'QUIZ' || gameType === 'SPELLING') && !timedSeconds;
  const advanceDelay = timedSeconds ? 700 : 1800;
  const retryDelay = timedSeconds ? 800 : 1200;

  const [timeLeft, setTimeLeft] = useState<number | null>(timedSeconds ?? null);
  const countdownTimerRef = useRef<number | null>(null);

  // מונע קריאה כפולה ל-handleNext/finishSession (למשל לחיצה ידנית + טיימר ההתקדמות
  // האוטומטי שרץ ברקע) שגרמה בעבר לדילוג על מילים ולאינדקס מחוץ לתחום המערך.
  const advanceTimerRef = useRef<number | null>(null);
  const hasAdvancedRef = useRef(false);

  // מאפשר לנסות שוב אחרי תשובה שגויה - בלי זה isCorrect נשאר false לצמיתות
  // וכל הכפתורים/הקלדה ננעלים (הילד נתקע בלי יכולת להמשיך).
  const retryTimerRef = useRef<number | null>(null);

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
      setFeedback('');
      setInputValue('');
      setAssembledOrder([]);
      setLetterBank(prev => prev.map(l => ({ ...l, used: false })));
    }, delay);
  };

  const scheduleGameOver = (delay: number) => {
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      finishSession();
    }, delay);
  };

  const finishSession = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearAdvanceTimer();
    clearRetryTimer();
    onFinish(score, mistakes, Array.from(missedIds), currentIndex + 1, maxCombo);
  };

  useEffect(() => {
    hasAdvancedRef.current = false;
    setIsFlipped(false);
    setExampleShown(null);
  }, [currentIndex]);

  // ניקוי הטיימרים רק בעת unmount בפועל (deps ריק), כדי לא לבטל בטעות
  // טיימר תקין בכל רינדור ביניים.
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current);
      if (retryTimerRef.current !== null) clearTimeout(retryTimerRef.current);
      if (countdownTimerRef.current !== null) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // שעון המרוץ - מתחיל ברגע שיוצאים ממסך ההוראות, מסתיים (וסוגר את הסשן) ב-0.
  // interval יחיד ב-ref, לא תלוי ב-timeLeft כדי לא ליצור interval חדש כל שניה.
  useEffect(() => {
    if (!timedSeconds || showInstructions) return;
    countdownTimerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          if (countdownTimerRef.current !== null) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
          finishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownTimerRef.current !== null) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedSeconds, showInstructions]);

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
      const timer = setTimeout(() => speak(GAME_INSTRUCTIONS[gameType].voice, 'en'), 500);
      return () => clearTimeout(timer);
    }
  }, [showInstructions, gameType, speak]);

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

  const promptText = currentWord ? (direction === 'EN_TO_HE' ? currentWord.english : currentWord.hebrew) : '';
  const answerHint = currentWord ? (direction === 'EN_TO_HE' ? currentWord.hebrew : currentWord.english) : '';
  const promptLang = direction === 'EN_TO_HE' ? 'en' : 'he';

  // באיות תמיד מרכיבים את המילה באנגלית מאריחי אותיות (לא תלוי בכיוון התרגום הכללי) -
  // זו המיומנות הרלוונטית לתרגול כתיבה, וזה גם מה שמאפשר מאגר אותיות לטיני קבוע.
  const spellingTarget = currentWord ? currentWord.english.toUpperCase().replace(/[^A-Z]/g, '') : '';
  const assembledWord = assembledOrder.map(id => letterBank.find(l => l.id === id)?.char || '').join('');

  useEffect(() => {
    if (!silent && !showInstructions && gameType !== 'MEMORY' && gameType !== 'SPELLING' && currentWord) {
      const timer = setTimeout(() => speak(promptText, promptLang as any), 600);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentWord, direction, speak, gameType, showInstructions, promptText, promptLang, silent]);

  useEffect(() => {
    if (!showInstructions && gameType === 'SPELLING' && currentWord) {
      const timer = setTimeout(() => speak(currentWord.hebrew, 'he'), 600);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentWord, gameType, showInstructions, speak]);

  useEffect(() => {
    if (gameType === 'QUIZ') generateQuizOptions();
    if (gameType === 'MEMORY') initializeMemoryGame();
    if (gameType === 'SPELLING' && currentWord) {
      setLetterBank(generateLetterBank(currentWord.english));
      setAssembledOrder([]);
    }
  }, [currentIndex, gameType, direction]);

  const initializeMemoryGame = () => {
    // מספר הזוגות עולה עם רמת הקושי - חלק מהקושי האדפטיבי, לא קבוע כמו שהיה
    const pairs = difficulty <= 2 ? 4 : difficulty === 3 ? 6 : 8;
    const gameWords = words.slice(0, pairs);
    const cards: MemoryCard[] = [];
    gameWords.forEach(w => {
      cards.push({ id: Math.random().toString(36), text: w.english, wordId: w.id, type: 'EN' });
      cards.push({ id: Math.random().toString(36), text: w.hebrew, wordId: w.id, type: 'HE' });
    });
    setMemoryCards(cards.sort(() => Math.random() - 0.5));
  };

  const handleMemoryCardClick = (index: number) => {
    if (isMemoryProcessing || flippedIndices.includes(index) || matchedWordIds.includes(memoryCards[index].wordId)) return;
    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);
    if (newFlipped.length === 2) {
      setIsMemoryProcessing(true);
      const card1 = memoryCards[newFlipped[0]];
      const card2 = memoryCards[newFlipped[1]];
      if (card1.wordId === card2.wordId && card1.type !== card2.type) {
        playSound('correct');
        setScore(s => s + 200);
        setMatchedWordIds(prev => [...prev, card1.wordId]);
        setFlippedIndices([]);
        setIsMemoryProcessing(false);
        if (matchedWordIds.length + 1 === memoryCards.length / 2) {
          setTimeout(() => onFinish(score + 200, mistakes, Array.from(missedIds), memoryCards.length / 2, 0), 1500);
        }
      } else {
        playSound('wrong');
        setMistakes(m => m + 1);
        setMissedIds(prev => new Set(prev).add(card1.wordId).add(card2.wordId));
        setTimeout(() => { setFlippedIndices([]); setIsMemoryProcessing(false); }, 1000);
      }
    }
  };

  const generateQuizOptions = () => {
    if (!currentWord) return;
    const targetLang = direction === 'EN_TO_HE' ? 'hebrew' : 'english';
    let numOthers = 1;
    if (difficulty >= 2 && difficulty <= 3) numOthers = 3;
    if (difficulty >= 4) numOthers = 5;
    const others = words.filter(w => w.id !== currentWord.id).map(w => w[targetLang]).sort(() => 0.5 - Math.random()).slice(0, numOthers);
    setOptions([currentWord[targetLang], ...others].sort(() => 0.5 - Math.random()));
  };

  const handleNext = () => {
    if (hasAdvancedRef.current) return;
    clearAdvanceTimer();
    clearRetryTimer();
    // הדגל נקבע רק בענף ה"המשך" - אחרת finishSession() (הענף האחר) היה רואה אותו
    // כבר true ויוצא בלי לקרוא ל-onFinish, והמילה האחרונה בכל סשן הייתה נתקעת לצמיתות
    if (currentIndex + 1 < words.length) {
      hasAdvancedRef.current = true;
      setCurrentIndex(prev => prev + 1);
      setInputValue('');
      setIsCorrect(null);
      setFeedback('');
      setAssembledOrder([]);
      // hasAdvancedRef מתאפס ל-false ב-useEffect שתלוי ב-currentIndex (אחרי שהרינדור הבא קורה)
    } else {
      finishSession();
    }
  };

  const registerCorrect = (points: number) => {
    playSound('correct');
    setScore(s => s + points);
    setCombo(c => {
      const next = c + 1;
      setMaxCombo(m => Math.max(m, next));
      return next;
    });
  };

  const registerWrong = (wordId: string) => {
    playSound('wrong');
    setMistakes(m => m + 1);
    setMissedIds(prev => new Set(prev).add(wordId));
    setCombo(0);
  };

  const checkAnswer = (answer: string) => {
    if (isCorrect !== null || !answer.trim()) return;
    setInputValue(answer);
    const target = direction === 'EN_TO_HE' ? currentWord.hebrew : currentWord.english;
    const isMatched = answer.toLowerCase().trim() === target.toLowerCase().trim();
    if (isMatched) {
      registerCorrect(100);
      setIsCorrect(true);
      const msg = pickEncouragement();
      setFeedback(msg);
      speak(msg, 'en');
      scheduleAdvance(advanceDelay);
    } else {
      registerWrong(currentWord.id);
      setIsCorrect(false);
      const newLives = hasHearts ? lives - 1 : lives;
      if (hasHearts) setLives(newLives);
      if (hasHearts && newLives <= 0) {
        setGameOver(true);
        setFeedback('נגמרו החיים... בפעם הבאה! 💔');
        speak('Game over! Try again next time.', 'en');
        scheduleGameOver(2000);
      } else {
        setFeedback('TRY AGAIN! 💪');
        speak('Try again!', 'en');
        scheduleRetry(retryDelay);
      }
    }
  };

  const tapLetter = (tile: LetterTile) => {
    if (isCorrect !== null || tile.used || assembledOrder.length >= spellingTarget.length) return;
    setLetterBank(prev => prev.map(l => (l.id === tile.id ? { ...l, used: true } : l)));
    setAssembledOrder(prev => [...prev, tile.id]);
  };

  const removeLastLetter = () => {
    if (isCorrect !== null || assembledOrder.length === 0) return;
    const lastId = assembledOrder[assembledOrder.length - 1];
    setAssembledOrder(prev => prev.slice(0, -1));
    setLetterBank(prev => prev.map(l => (l.id === lastId ? { ...l, used: false } : l)));
  };

  const checkSpelling = () => {
    if (isCorrect !== null || assembledOrder.length !== spellingTarget.length) return;
    const isMatched = assembledWord === spellingTarget;
    if (isMatched) {
      registerCorrect(100);
      setIsCorrect(true);
      const msg = pickEncouragement();
      setFeedback(msg);
      speak(msg, 'en');
      scheduleAdvance(advanceDelay);
    } else {
      registerWrong(currentWord.id);
      setIsCorrect(false);
      const newLives = hasHearts ? lives - 1 : lives;
      if (hasHearts) setLives(newLives);
      if (hasHearts && newLives <= 0) {
        setGameOver(true);
        setFeedback('נגמרו החיים... בפעם הבאה! 💔');
        speak('Game over! Try again next time.', 'en');
        scheduleGameOver(2000);
      } else {
        setFeedback('TRY AGAIN! 💪');
        speak('Try again!', 'en');
        scheduleRetry(retryDelay);
      }
    }
  };

  const showExample = async () => {
    if (!currentWord || loadingExample) return;
    if (exampleShown) {
      speak(exampleShown.en, 'en');
      return;
    }
    if (currentWord.example && currentWord.exampleHebrew) {
      setExampleShown({ en: currentWord.example, he: currentWord.exampleHebrew });
      speak(currentWord.example, 'en');
      return;
    }
    setLoadingExample(true);
    try {
      const result = await generateExampleSentence(currentWord.english, currentWord.hebrew, 9);
      if (result) {
        setExampleShown({ en: result.sentence, he: result.hebrew });
        speak(result.sentence, 'en');
        onExampleGenerated?.(currentWord.id, result.sentence, result.hebrew);
      }
    } finally {
      setLoadingExample(false);
    }
  };

  const handleFlashcardRate = (knewIt: boolean) => {
    if (isCorrect !== null) return;
    setIsCorrect(knewIt);
    if (knewIt) {
      registerCorrect(50);
      setFeedback('מעולה! 🌟');
    } else {
      registerWrong(currentWord.id);
      setFeedback('ננסה שוב בפעם הבאה 💪');
    }
    scheduleAdvance(600);
  };

  if (showInstructions) {
    const inst = GAME_INSTRUCTIONS[gameType];
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <h2 className="text-3xl sm:text-4xl gaming-font text-white">{inst.title}</h2>
        <p className="text-base sm:text-lg text-slate-200 leading-relaxed" dir="rtl">{inst.desc}</p>
        <button onClick={() => { window.speechSynthesis.cancel(); setShowInstructions(false); }}
          className={`roblox-btn ${inst.color} px-10 py-4 text-xl text-white w-full`}>
          {inst.btn}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-8 glass-panel rounded-3xl shadow-2xl relative transition-all duration-300 flex flex-col items-center gap-5 overflow-hidden">

      {/* Header */}
      <div className="w-full flex items-center justify-between gap-2">
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm flex items-center gap-1">
          🏠 <span className="hidden sm:inline">יציאה</span>
        </button>
        <div className="flex gap-2" dir="rtl">
          {timedSeconds != null && timeLeft != null && (
            <div className={`result-badge px-3 py-2 font-black en-font text-sm flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-orange-300'}`}>
              ⏱️ {timeLeft}
            </div>
          )}
          {hasHearts && (
            <div className="result-badge px-3 py-2 font-black en-font text-red-400 text-sm flex items-center gap-1">
              {lives} ❤️
            </div>
          )}
          <div className="result-badge px-3 py-2 font-black en-font text-yellow-300 text-sm">⭐ {score}</div>
          <div className="result-badge px-3 py-2 font-black gaming-font text-sky-300 text-sm">
            {gameType === 'MEMORY' ? `${matchedWordIds.length}/${memoryCards.length / 2} זוגות` : `${currentIndex + 1}/${words.length}`}
          </div>
        </div>
      </div>

      {combo >= 2 && (gameType === 'QUIZ' || gameType === 'SPELLING') && (
        <div className="roblox-btn bg-orange-500 border-orange-700 px-5 py-2 text-white font-black en-font text-sm animate-float">
          🔥 COMBO x{combo}
        </div>
      )}

      {/* Game content */}
      <div key={gameType === 'MEMORY' ? 'memory' : `game-${currentIndex}`} className="w-full flex flex-col items-center gap-5 animate-slide-in">

        {/* FLASHCARDS */}
        {gameType === 'FLASHCARDS' && (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="w-full word-card p-8 sm:p-12 relative">
              <button onClick={() => speak(promptText, promptLang as any)}
                className="absolute top-4 left-4 text-2xl p-3 bg-sky-500 border-sky-700 text-white rounded-2xl roblox-btn">🔊</button>
              <h3 onClick={() => { if (!isFlipped) { setIsFlipped(true); speak(answerHint, direction === 'EN_TO_HE' ? 'he' : 'en'); } }}
                className="text-5xl sm:text-7xl font-black gaming-font mb-2 text-center pt-4 cursor-pointer active:scale-95 transition-all">{promptText}</h3>
              {isFlipped ? (
                <div className="mt-4 flex flex-col items-center gap-2 animate-fade-in">
                  <div className="h-1 w-16 bg-indigo-300 rounded-full" />
                  <div className="flex items-center gap-2">
                    <p className="text-3xl sm:text-4xl text-indigo-600 gaming-font">{answerHint}</p>
                    <button onClick={() => speak(answerHint, direction === 'EN_TO_HE' ? 'he' : 'en')}
                      className="roblox-btn bg-indigo-400 border-indigo-600 text-white w-9 h-9 rounded-full flex items-center justify-center text-sm">🔊</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center mt-4">הקש על המילה כדי להפוך את הכרטיס</p>
              )}
            </div>

            <button onClick={showExample} disabled={loadingExample}
              className="roblox-btn bg-amber-400 border-amber-600 text-slate-900 w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-60">
              {loadingExample ? <span className="animate-spin">🌀</span> : '📖'} דוגמה למשפט
            </button>
            {exampleShown && (
              <div className="w-full glass-panel p-4 rounded-2xl flex items-center justify-between gap-3 animate-slide-in">
                <div>
                  <p className="text-base font-black text-white en-font" dir="ltr">{exampleShown.en}</p>
                  <p className="text-sm text-slate-300">{exampleShown.he}</p>
                </div>
                <button onClick={() => speak(exampleShown.en, 'en')}
                  className="roblox-btn bg-amber-400 border-amber-600 text-slate-900 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">🔊</button>
              </div>
            )}

            {!isFlipped ? (
              <button onClick={() => { setIsFlipped(true); speak(answerHint, direction === 'EN_TO_HE' ? 'he' : 'en'); }}
                className="roblox-btn bg-sky-500 border-sky-700 w-full py-4 text-xl text-white glow-cyan">
                הפוך את הכרטיס 🔄
              </button>
            ) : (
              <div className="w-full grid grid-cols-2 gap-3">
                <button disabled={isCorrect !== null} onClick={() => handleFlashcardRate(false)} className="roblox-btn bg-red-500 border-red-700 py-5 text-xl text-white disabled:opacity-50">
                  עוד לא ✗
                </button>
                <button disabled={isCorrect !== null} onClick={() => handleFlashcardRate(true)} className="roblox-btn bg-green-500 border-green-700 py-5 text-xl text-white disabled:opacity-50">
                  ידעתי! ✓
                </button>
              </div>
            )}
          </div>
        )}

        {/* SPELLING */}
        {gameType === 'SPELLING' && currentWord && (
          <div className="w-full flex flex-col items-center gap-5">
            <div className="text-center flex flex-col items-center gap-3">
              <p className="text-sm text-slate-300 font-black tracking-widest">איך כותבים באנגלית?</p>
              <div className="word-card w-28 h-28 flex items-center justify-center">
                <span className="text-lg font-black text-center px-2">{currentWord.hebrew}</span>
              </div>
              <button onClick={() => speak(currentWord.english, 'en')}
                className="roblox-btn bg-sky-500 border-sky-700 w-12 h-12 flex items-center justify-center text-xl text-white rounded-full">🔊</button>
            </div>

            {/* תאי המילה שמורכבת - dir="ltr" מפורש כי זו מילה באנגלית, אחרת ה-RTL
                של העמוד היה הופך את סדר התאים ומציג את המילה הפוכה */}
            <div className="flex gap-2 justify-center flex-wrap" dir="ltr">
              {Array.from({ length: spellingTarget.length }).map((_, i) => {
                const filled = i < assembledOrder.length;
                const char = filled ? letterBank.find(l => l.id === assembledOrder[i])?.char : '';
                return (
                  <div key={i} className={`w-11 h-14 rounded-xl flex items-center justify-center text-2xl font-black en-font ${
                    filled ? 'bg-amber-400 text-slate-900' : 'border-2 border-dashed border-slate-500 text-slate-500'
                  }`}>
                    {char}
                  </div>
                );
              })}
            </div>

            {/* מאגר אותיות */}
            <div className="grid grid-cols-4 gap-2 w-full" dir="ltr">
              {letterBank.map(tile => (
                <button key={tile.id} disabled={isCorrect !== null || tile.used || assembledOrder.length >= spellingTarget.length}
                  onClick={() => tapLetter(tile)}
                  className={`roblox-btn py-4 text-xl font-black en-font ${tile.used ? 'opacity-25 bg-slate-700 border-slate-800' : 'bg-white text-slate-900 border-slate-300'}`}>
                  {tile.char}
                </button>
              ))}
              <button disabled={isCorrect !== null || assembledOrder.length === 0} onClick={removeLastLetter}
                className="roblox-btn py-4 text-xl font-black bg-red-500 border-red-700 text-white disabled:opacity-30">⌫</button>
            </div>

            <button onClick={checkSpelling} disabled={isCorrect !== null || assembledOrder.length !== spellingTarget.length}
              className="roblox-btn w-full bg-green-500 border-green-700 py-4 text-xl text-white glow-green disabled:opacity-40">
              בדוק ⚡
            </button>
          </div>
        )}

        {/* QUIZ */}
        {gameType === 'QUIZ' && currentWord && (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="word-card w-full p-6 flex flex-col items-center gap-2">
              {!silent && (
                <button onClick={() => speak(currentWord.english, 'en')}
                  className="roblox-btn bg-sky-500 border-sky-700 w-12 h-12 flex items-center justify-center text-xl text-white rounded-full mb-1">🔊</button>
              )}
              <span className="text-3xl sm:text-4xl font-black text-center en-font">{currentWord.english}</span>
            </div>
            <p className="text-lg text-slate-200 font-bold text-center" dir="rtl">מה הפירוש של המילה?</p>
            <div className={`grid gap-3 w-full ${options.length <= 2 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {options.map((opt, i) => (
                <button key={i} disabled={isCorrect !== null} onClick={() => checkAnswer(opt)}
                  className={`roblox-btn p-4 text-xl sm:text-2xl text-white ${
                    isCorrect === true && opt === answerHint ? 'bg-green-500 border-green-700 scale-105' :
                    isCorrect === false && opt === inputValue ? 'bg-red-500 border-red-700' :
                    'bg-indigo-500 border-indigo-700 hover:bg-indigo-400'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MEMORY */}
        {gameType === 'MEMORY' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full animate-fade-in">
            {memoryCards.map((card, i) => {
              const isFlippedCard = flippedIndices.includes(i) || matchedWordIds.includes(card.wordId);
              return (
                <button key={card.id}
                  onClick={() => { handleMemoryCardClick(i); if (!isFlippedCard && !silent) speak(card.text, card.type === 'EN' ? 'en' : 'he'); }}
                  className={`aspect-square rounded-2xl flex items-center justify-center text-center p-2 font-black text-base sm:text-lg transition-all duration-500 border-b-4 ${
                    isFlippedCard ? 'bg-white text-slate-900 border-green-400' : 'bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-800 text-transparent'
                  } ${matchedWordIds.includes(card.wordId) ? 'opacity-40 grayscale' : 'active:scale-95 shadow-lg'}`}>
                  {isFlippedCard ? card.text : <span className="text-2xl text-white/60">?</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Feedback */}
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
