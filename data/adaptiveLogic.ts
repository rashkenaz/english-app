// לוגיקת קושי אדפטיבי + הצעת גיוון - פונקציות טהורות (ניתנות לבדיקה בבידוד),
// נגזרות כולן מ-history הקיים בלי תשתית מעקב חדשה.

import { GameActivity, GameState } from '../types';

// משפחות משחקים: NAMES/QUIZRACE הן בעצם עוד QUIZ, NAMEMATCH היא עוד MEMORY -
// בלי זה "תקוע על אותו דבר" לא היה מזהה ילד שמחליף בין וריאנטים של אותו תרגיל.
const GAME_FAMILY: Record<string, string> = {
  QUIZ: 'QUIZ', QUIZRACE: 'QUIZ', NAMES: 'QUIZ',
  MEMORY: 'MEMORY', NAMEMATCH: 'MEMORY',
};
const familyOf = (gameType: string) => GAME_FAMILY[gameType] || gameType;

const sessionAccuracy = (h: GameActivity): number => {
  if (h.totalItems <= 0) return 1;
  const missed = h.missedCount ?? h.mistakes;
  return 1 - missed / h.totalItems;
};

// סשן "מזכה" לשינוי קושי - פסיבי (FLASHCARDS) או סשן תרגול-טעויות/כתיבה ממוקד
// (שבמכוון מרוכז במילים קשות) לא אמור למשוך את הרמה כלפי מטה.
const isQualifyingSession = (h: GameActivity): boolean =>
  h.gameType !== 'FLASHCARDS' && h.totalItems >= 5 && !h.isTargetedReview;

export interface DifficultyAdjustment {
  to: number;
  direction: 'up' | 'down';
}

// history חייב להיות הגרסה המקומית העדכנית (כולל הסשן שהסתיים הרגע כראשון) -
// לא currentUser.history הישן, כדי לא ליפול שוב בבאג ה-stale-closure שכבר תפסנו.
export const computeDifficultyAdjustment = (
  history: GameActivity[],
  currentDifficulty: number,
  sinceTs: number | undefined
): DifficultyAdjustment | null => {
  const qualifying = history
    .filter(h => isQualifyingSession(h) && (sinceTs === undefined || h.timestamp > sinceTs))
    .slice(0, 3); // newest-first

  if (qualifying.length >= 3 && currentDifficulty < 5 && qualifying.every(h => sessionAccuracy(h) >= 0.9)) {
    return { to: currentDifficulty + 1, direction: 'up' };
  }
  if (qualifying.length >= 2 && currentDifficulty > 1 && qualifying.slice(0, 2).every(h => sessionAccuracy(h) < 0.5)) {
    return { to: currentDifficulty - 1, direction: 'down' };
  }
  return null;
};

// משחקים שנפתחים ב-setActiveGame(type) פשוט בלבד (בלי פונקציית start ייעודית
// כמו startNamesGame/startQuizRace) - כדי שה-CTA של ההצעה יהיה תמיד תקין.
const VARIETY_CANDIDATES: GameState['type'][] = ['SPELLING', 'STORY', 'SENTENCEBUILDER', 'QUIZ', 'MEMORY', 'PHONICS', 'WORDHUNT'];

const todayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

// מחזיר משחק מוצע אם 3 הסשנים האחרונים של היום כולם מאותה משפחה, אחרת null.
export const suggestVarietyGame = (history: GameActivity[]): GameState['type'] | null => {
  const today = todayKey(Date.now());
  const todaysSessions = history.filter(h => todayKey(h.timestamp) === today);
  if (todaysSessions.length < 3) return null;

  const lastThree = todaysSessions.slice(0, 3);
  const family = familyOf(lastThree[0].gameType);
  if (!lastThree.every(h => familyOf(h.gameType) === family)) return null;

  const candidates = VARIETY_CANDIDATES.filter(c => familyOf(c) !== family);
  const neverPlayed = candidates.find(c => !history.some(h => h.gameType === c));
  if (neverPlayed) return neverPlayed;

  // כולם שוחקו - מציעים את מי שהכי מזמן לא שוחק (timestamp אחרון הישן ביותר)
  let oldest: GameState['type'] = candidates[0];
  let oldestTs = Infinity;
  for (const c of candidates) {
    const last = history.find(h => h.gameType === c);
    const ts = last ? last.timestamp : 0;
    if (ts < oldestTs) { oldestTs = ts; oldest = c; }
  }
  return oldest;
};
