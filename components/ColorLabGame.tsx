
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CURRICULUM_VOCAB } from '../data/curriculum';

interface ColorLabGameProps {
  onExit: () => void;
  onFinish: (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => void;
}

interface ColorOption { en: string; he: string; hex: string; }
interface ColorRound {
  prefix: 'My' | 'The';
  thing: { en: string; he: string; emoji?: string };
  target: ColorOption;
  options: ColorOption[];
}

const ROUNDS_PER_SESSION = 8;

const COLORS: ColorOption[] = CURRICULUM_VOCAB
  .filter(w => w.cat === 'colors' && w.hex)
  .map(w => ({ en: w.en, he: w.he, hex: w.hex! }));
const THINGS = CURRICULUM_VOCAB.filter(w => (w.cat === 'school' || w.cat === 'home') && w.emoji);

const buildRound = (): ColorRound => {
  const thing = THINGS[Math.floor(Math.random() * THINGS.length)];
  const target = COLORS[Math.floor(Math.random() * COLORS.length)];
  const distractors = COLORS.filter(c => c.en !== target.en).sort(() => 0.5 - Math.random()).slice(0, 3);
  const options = [target, ...distractors].sort(() => 0.5 - Math.random());
  const prefix: 'My' | 'The' = Math.random() < 0.5 ? 'My' : 'The';
  return { prefix, thing: { en: thing.en, he: thing.he, emoji: thing.emoji }, target, options };
};

export const ColorLabGame: React.FC<ColorLabGameProps> = ({ onExit, onFinish }) => {
  const [showInstructions, setShowInstructions] = useState(true);
  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState<ColorRound>(() => buildRound());
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

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.pitch = 1.2;
    u.rate = 0.7;
    window.speechSynthesis.speak(u);
  }, []);

  const sentence = `${round.prefix} ${round.thing.en} is`;
  const fullSentence = (colorEn: string) => `${round.prefix} ${round.thing.en} is ${colorEn}.`;

  const finishSession = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearAdvance(); clearRetry();
    onFinish(score, mistakes, missed, ROUNDS_PER_SESSION, 0);
  };

  const nextRound = () => {
    if (hasAdvancedRef.current) return;
    clearAdvance(); clearRetry();
    // הדגל נקבע רק בענף ה"המשך" - אם זה הסבב האחרון, finishSession() קובע אותו
    // בעצמה. קביעה כאן ללא תנאי הייתה גורמת ל-finishSession לראות שכבר "התקדמנו"
    // ולצאת מיד בלי לקרוא בכלל ל-onFinish - הסבב האחרון בכל סשן היה נתקע לצמיתות.
    if (roundIndex + 1 < ROUNDS_PER_SESSION) {
      hasAdvancedRef.current = true;
      setRound(buildRound());
      setRoundIndex(i => i + 1);
      setIsCorrect(null);
      setSelected(null);
      setFeedback('');
    } else {
      finishSession();
    }
  };

  const choose = (colorEn: string) => {
    if (isCorrect !== null) return;
    setSelected(colorEn);
    const correct = colorEn === round.target.en;
    if (correct) {
      setScore(s => s + 100);
      setIsCorrect(true);
      setFeedback('מעולה! 🌟');
      speak(fullSentence(colorEn));
      clearAdvance();
      advanceTimerRef.current = window.setTimeout(() => { advanceTimerRef.current = null; nextRound(); }, 2000);
    } else {
      setMistakes(m => m + 1);
      setMissed(prev => [...prev, round.target.en]);
      setIsCorrect(false);
      setFeedback('נסו שוב 💪');
      clearRetry();
      retryTimerRef.current = window.setTimeout(() => { retryTimerRef.current = null; setIsCorrect(null); setSelected(null); setFeedback(''); }, 1200);
    }
  };

  if (showInstructions) {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <h2 className="text-3xl sm:text-4xl gaming-font text-white">מעבדת הצבעים 🎨</h2>
        <p className="text-base sm:text-lg text-slate-200 leading-relaxed" dir="rtl">קראו את המשפט ובחרו את הצבע הנכון!</p>
        <button onClick={() => setShowInstructions(false)} className="roblox-btn bg-fuchsia-500 border-fuchsia-700 px-10 py-4 text-xl text-white w-full">
          בואו נצבע! 🖌️
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

      <div className="word-card w-full p-8 flex flex-col items-center gap-4">
        {/* האובייקט עצמו (לא ריבוע מסביבו) צריך להראות בצבע היעד - אחרת הילד
            קורא את זה כ"יש מסגרת צבעונית סביב חפץ ניטרלי", לא "החפץ הזה בצבע הזה".
            אימוג'י הוא גרפיקה צבעונית קבועה שא"א לצבוע ישירות עם background, אז
            הופכים אותו לגווני אפור ואז "צובעים" אותו עם mix-blend-mode: color -
            זה משמר את הצללים/הצורה אבל נותן לו את הגוון של צבע היעד. */}
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center bg-white transition-all duration-500 border-4"
          style={{
            borderColor: isCorrect === true ? '#22c55e' : isCorrect === false ? '#ef4444' : '#e2e8f0',
          }}
        >
          <span className="relative inline-flex items-center justify-center text-5xl leading-none">
            <span style={{ filter: 'grayscale(1) contrast(1.15)' }}>{round.thing.emoji || '❓'}</span>
            <span
              className="absolute -inset-2 rounded-full pointer-events-none"
              style={{ backgroundColor: round.target.hex, mixBlendMode: 'color' }}
            />
          </span>
        </div>
        <p className="text-xl sm:text-2xl font-black text-center en-font" dir="ltr">
          {sentence} <span className={`inline-block px-2 border-b-4 ${isCorrect === true ? 'border-green-500 text-green-600' : isCorrect === false ? 'border-red-500 text-red-600' : 'border-fuchsia-400 text-fuchsia-600'}`}>{selected || '___'}</span>
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 w-full">
        {round.options.map((opt) => (
          <button key={opt.en} disabled={isCorrect !== null} onClick={() => choose(opt.en)}
            className={`roblox-btn aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 disabled:opacity-60 border-b-4 ${
              isCorrect !== null && opt.en === round.target.en ? 'ring-4 ring-green-400' :
              isCorrect === false && opt.en === selected ? 'ring-4 ring-red-400' : ''
            }`}
            style={{ backgroundColor: opt.hex, borderColor: opt.hex === '#FFFFFF' ? '#cbd5e1' : opt.hex }}>
            {/* תווית באנגלית בכוונה - זו אפליקציה ללימוד אנגלית, התרגום לעברית לא מלמד את מילת הצבע באנגלית */}
            <span className="text-sm sm:text-base font-black text-slate-900 bg-white/80 rounded-full px-3 py-1 en-font" dir="ltr">{opt.en.charAt(0).toUpperCase() + opt.en.slice(1)}</span>
          </button>
        ))}
      </div>

      {feedback && <div className="w-full p-4 rounded-2xl text-lg font-black text-center glass-panel" dir="rtl">{feedback}</div>}
    </div>
  );
};
