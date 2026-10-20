
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VOWEL_GROUPS, VOWEL_SOUND_GROUPS, FP_GROUPS } from '../data/curriculum';

interface SoundCatcherGameProps {
  onExit: () => void;
  onFinish: (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => void;
}

type SubMode = 'VOWELS' | 'FP';
type Phase = 'MODE_SELECT' | 'READY' | 'PLAYING' | 'DONE';
type Resolution = 'caught' | 'wrong';

interface BounceItem { id: number; word: string; isTarget: boolean; }

const ITEM_COUNT = 10;
const ROUND_SECONDS = 30;
const CONTAINER_H = 320; // px
const ITEM_W = 84, ITEM_H = 44; // px - גבולות תנועה לכל "כדור" מילה
const SPEED_RANGE = [45, 85]; // px/שנייה

const buildVowelRound = () => {
  const groupKey = Object.keys(VOWEL_SOUND_GROUPS)[Math.floor(Math.random() * 3)];
  const targetLetters = VOWEL_SOUND_GROUPS[groupKey];
  const targetWords = targetLetters.flatMap(l => VOWEL_GROUPS[l]);
  const otherLetters = Object.keys(VOWEL_GROUPS).filter(l => !targetLetters.includes(l));
  const distractorWords = otherLetters.flatMap(l => VOWEL_GROUPS[l]);
  return { label: groupKey, targetWords, distractorWords };
};

const buildFpRound = () => {
  const letter = Math.random() < 0.5 ? 'f' : 'p';
  const other = letter === 'f' ? 'p' : 'f';
  return { label: letter, targetWords: FP_GROUPS[letter as 'f' | 'p'], distractorWords: FP_GROUPS[other as 'f' | 'p'] };
};

const buildItems = (targetWords: string[], distractorWords: string[]): BounceItem[] => {
  const targetCount = Math.ceil(ITEM_COUNT * 0.45);
  const distractorCount = ITEM_COUNT - targetCount;
  // ייחוד מילים בפועל (בלי כפילויות) כדי שלא יהיו שני "sun" בו-זמנית על הלוח - מבלבל ילד
  const uniq = (pool: string[], n: number) => [...new Set(pool)].sort(() => 0.5 - Math.random()).slice(0, n);
  const targets = uniq(targetWords, Math.min(targetCount, new Set(targetWords).size));
  const distractors = uniq(distractorWords, Math.min(distractorCount, new Set(distractorWords).size));
  const chosen = [...targets.map(word => ({ word, isTarget: true })), ...distractors.map(word => ({ word, isTarget: false }))]
    .sort(() => 0.5 - Math.random());
  return chosen.map((c, i) => ({ id: i, word: c.word, isTarget: c.isTarget }));
};

export const SoundCatcherGame: React.FC<SoundCatcherGameProps> = ({ onExit, onFinish }) => {
  const [phase, setPhase] = useState<Phase>('MODE_SELECT');
  const [subMode, setSubMode] = useState<SubMode | null>(null);
  const [targetLabel, setTargetLabel] = useState('');
  const [items, setItems] = useState<BounceItem[]>([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [wrongTaps, setWrongTaps] = useState(0);
  const [renderTick, setRenderTick] = useState(0); // רק כדי להכריח רינדור כשמשהו "נפתר" (נתפס/טעות)

  const resolvedRef = useRef<Map<number, Resolution>>(new Map());
  const posRef = useRef<{ x: number; y: number; vx: number; vy: number }[]>([]);
  const elRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const flashTimersRef = useRef<Map<number, number>>(new Map());
  const countdownTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const hasAdvancedRef = useRef(false);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.pitch = 1.2;
    u.rate = 0.7;
    window.speechSynthesis.speak(u);
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (countdownTimerRef.current !== null) clearInterval(countdownTimerRef.current);
    if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current);
    flashTimersRef.current.forEach(t => clearTimeout(t));
  }, []);

  const startMode = (mode: SubMode) => {
    const round = mode === 'VOWELS' ? buildVowelRound() : buildFpRound();
    setSubMode(mode);
    setTargetLabel(round.label);
    setItems(buildItems(round.targetWords, round.distractorWords));
    resolvedRef.current = new Map();
    setPhase('READY');
  };

  const targetCount = items.filter(it => it.isTarget).length;
  const caughtCount = [...resolvedRef.current.values()].filter(v => v === 'caught').length;

  const finishRound = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (countdownTimerRef.current !== null) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    if (advanceTimerRef.current !== null) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
    setPhase('DONE');
  };

  // לולאת התנועה - בעצם לא "נופל", אלא מקפץ בתוך קופסה סגורה בגבולותיה (כמו כדור כלוא)
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    const w = containerRef.current?.clientWidth || 320;
    posRef.current = items.map(() => {
      const speed = SPEED_RANGE[0] + Math.random() * (SPEED_RANGE[1] - SPEED_RANGE[0]);
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * (w - ITEM_W),
        y: Math.random() * (CONTAINER_H - ITEM_H),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      };
    });
    lastTsRef.current = null;

    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      const w2 = containerRef.current?.clientWidth || w;
      posRef.current.forEach((p, i) => {
        if (resolvedRef.current.has(items[i].id)) return; // פריט שנפתר (נתפס) - קפוא במקום
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > w2 - ITEM_W) { p.x = w2 - ITEM_W; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > CONTAINER_H - ITEM_H) { p.y = CONTAINER_H - ITEM_H; p.vy *= -1; }
        const el = elRefs.current[i];
        if (el) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [phase, items]);

  // שעון הסבב - 30 שניות, מסתיים אוטומטית ב-0
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    countdownTimerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (countdownTimerRef.current !== null) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
          finishRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownTimerRef.current !== null) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const beginRound = () => {
    setTimeLeft(ROUND_SECONDS);
    setPhase('PLAYING');
  };

  const handleTap = (item: BounceItem) => {
    if (resolvedRef.current.has(item.id)) return;
    if (item.isTarget) {
      resolvedRef.current.set(item.id, 'caught');
      speak(item.word);
      setRenderTick(t => t + 1);
      // כל המטרות נתפסו לפני תום הזמן - מסיימים מוקדם (זה המקבילה ל"או לבחור פחות")
      const newCaught = [...resolvedRef.current.values()].filter(v => v === 'caught').length;
      if (newCaught === targetCount) {
        advanceTimerRef.current = window.setTimeout(() => { advanceTimerRef.current = null; finishRound(); }, 900);
      }
    } else {
      setWrongTaps(w => w + 1);
      const existing = flashTimersRef.current.get(item.id);
      if (existing !== undefined) clearTimeout(existing);
      resolvedRef.current.set(item.id, 'wrong');
      setRenderTick(t => t + 1);
      const t = window.setTimeout(() => {
        flashTimersRef.current.delete(item.id);
        resolvedRef.current.delete(item.id); // טעות היא זמנית - הפריט ממשיך לקפוץ, לא קפוא
        setRenderTick(v => v + 1);
      }, 450);
      flashTimersRef.current.set(item.id, t);
    }
  };

  const missedWords = items.filter(it => it.isTarget && resolvedRef.current.get(it.id) !== 'caught').map(it => it.word);
  const foundWords = items.filter(it => it.isTarget && resolvedRef.current.get(it.id) === 'caught').map(it => it.word);

  const completeAndReport = () => {
    onFinish(foundWords.length * 100, wrongTaps + missedWords.length, missedWords, targetCount, 0);
  };

  if (phase === 'MODE_SELECT') {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <h2 className="text-3xl sm:text-4xl gaming-font text-white">תופס הצלילים 🎣</h2>
        <p className="text-base sm:text-lg text-slate-200 leading-relaxed" dir="rtl">מילים מקפצות על הלוח - תפסו רק את אלה עם הצליל המבוקש, לפני שהזמן נגמר!</p>
        <div className="w-full grid grid-cols-1 gap-3">
          <button onClick={() => startMode('VOWELS')} className="roblox-btn bg-cyan-500 border-cyan-700 py-4 text-xl text-white">צלילי תנועות 🔊</button>
          <button onClick={() => startMode('FP')} className="roblox-btn bg-lime-500 border-lime-700 py-4 text-xl text-white">הבדלה f / p 👂</button>
        </div>
      </div>
    );
  }

  const bigLabel = subMode === 'VOWELS' ? `הצליל: ${targetLabel}` : `מילים שמתחילות ב-${targetLabel}`;

  if (phase === 'READY') {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center gap-6 animate-float">
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm self-start">🏠</button>
        <p className="text-lg sm:text-xl font-bold text-slate-200" dir="rtl">תפסו את כל המילים עם</p>
        <p className="text-5xl sm:text-6xl font-black text-cyan-300 gaming-font" dir="ltr">{bigLabel}</p>
        <p className="text-sm text-slate-300" dir="rtl">יש לכם {ROUND_SECONDS} שניות. בהצלחה!</p>
        <button onClick={beginRound} className="roblox-btn bg-green-500 border-green-700 px-10 py-4 text-xl text-white w-full">
          להתחיל! ▶️
        </button>
      </div>
    );
  }

  if (phase === 'DONE') {
    return (
      <div className="max-w-lg mx-auto p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center gap-5 text-center">
        <h2 className="text-2xl sm:text-3xl gaming-font text-white">התוצאות שלך 🏁</h2>
        <div className="w-full word-card p-5 flex flex-col gap-3">
          <div>
            <p className="text-green-600 font-black mb-1" dir="rtl">מצאת ({foundWords.length}/{targetCount}):</p>
            <div className="flex flex-wrap gap-2 justify-center" dir="ltr">
              {foundWords.length > 0 ? foundWords.map(w => (
                <span key={w} className="bg-green-100 text-green-700 font-black px-3 py-1 rounded-full text-sm en-font">{w}</span>
              )) : <span className="text-slate-400 text-sm">-</span>}
            </div>
          </div>
          {missedWords.length > 0 && (
            <div>
              <p className="text-red-500 font-black mb-1" dir="rtl">החמצת:</p>
              <div className="flex flex-wrap gap-2 justify-center" dir="ltr">
                {missedWords.map(w => (
                  <span key={w} className="bg-red-100 text-red-600 font-black px-3 py-1 rounded-full text-sm en-font">{w}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <button onClick={completeAndReport} className="roblox-btn w-full bg-cyan-500 border-cyan-700 py-4 text-xl text-white">
          המשך ✅
        </button>
      </div>
    );
  }

  // PLAYING
  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6 glass-panel rounded-3xl shadow-2xl flex flex-col items-center gap-3">
      <div className="w-full flex items-center justify-between gap-2">
        <button onClick={onExit} className="roblox-btn bg-slate-700 border-slate-900 px-4 py-2 text-white font-black text-sm">🏠</button>
        <div className="flex gap-2">
          <div className="result-badge px-3 py-2 font-black en-font text-sky-300 text-sm">{caughtCount}/{targetCount}</div>
          <div className={`result-badge px-3 py-2 font-black en-font text-sm ${timeLeft <= 8 ? 'text-red-400 animate-pulse' : 'text-yellow-300'}`}>⏱️ {timeLeft}</div>
        </div>
      </div>
      <p className="text-lg sm:text-xl font-black text-cyan-200 text-center" dir="ltr">{bigLabel}</p>

      <div ref={containerRef} className="relative w-full overflow-hidden rounded-2xl bg-sky-950/40 border-2 border-white/10" style={{ height: CONTAINER_H }}>
        {items.map((item, i) => {
          const resolution = resolvedRef.current.get(item.id);
          return (
            <button
              key={item.id}
              ref={el => { elRefs.current[i] = el; }}
              onClick={() => handleTap(item)}
              // top/left:0 מפורש בכוונה: position:absolute בלי inset מחושב לפי ה"מיקום הסטטי"
              // שלו, ותחת dir="rtl" של הדף זה מתחיל מהקצה הימני, לא משמאל - בלי זה ה-translate()
              // שמחשב את מיקום הקפיצה (מניח התחלה מ-0,0) מצטבר על ההיסט הזה והפריט בורח מהקופסה
              className={`absolute flex items-center justify-center rounded-xl text-sm sm:text-base font-black en-font transition-colors ${
                resolution === 'caught' ? 'bg-green-500 text-white' :
                resolution === 'wrong' ? 'bg-red-500 text-white' :
                'bg-white text-slate-900'
              }`}
              style={{ width: ITEM_W, height: ITEM_H, top: 0, left: 0, willChange: 'transform' }}
              dir="ltr"
            >
              {item.word}
            </button>
          );
        })}
      </div>
    </div>
  );
};
