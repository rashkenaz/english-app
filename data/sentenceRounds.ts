// לוגיקת בניית סבב משפט משותפת ל-SentenceGame (השלמת מקום חסר) ו-SentenceBuilderGame
// (סידור מילים לפי סדר) - שני המשחקים חיים על אותן תבניות P1-P7, אין סיבה לשכפל.

import { CURRICULUM_VOCAB, SENTENCE_PATTERNS, A_AN_EXCEPTIONS, SentencePattern } from './curriculum';

export interface SentenceRound {
  pattern: SentencePattern;
  targetWord: { en: string; he: string; emoji?: string };
  secondWord?: { en: string };
  options: string[];
}

const wordsInCategories = (cats: string[]) =>
  CURRICULUM_VOCAB.filter(w => cats.includes(w.cat) && !A_AN_EXCEPTIONS.includes(w.en));

export const buildSentenceRound = (): SentenceRound => {
  const pattern = SENTENCE_PATTERNS[Math.floor(Math.random() * SENTENCE_PATTERNS.length)];
  const pool = wordsInCategories(pattern.slotCategories);
  const target = pool[Math.floor(Math.random() * pool.length)];
  const distractors = pool.filter(w => w.en !== target.en).sort(() => 0.5 - Math.random()).slice(0, 3);
  const options = [target.en, ...distractors.map(w => w.en)].sort(() => 0.5 - Math.random());

  let secondWord: { en: string } | undefined;
  if (pattern.id === 'P3' || pattern.id === 'P7') {
    const colors = CURRICULUM_VOCAB.filter(w => w.cat === 'colors');
    secondWord = { en: colors[Math.floor(Math.random() * colors.length)].en };
  } else if (pattern.id === 'P6') {
    const adjectives = CURRICULUM_VOCAB.filter(w => w.cat === 'adjectives');
    secondWord = { en: adjectives[Math.floor(Math.random() * adjectives.length)].en };
  }

  return { pattern, targetWord: { en: target.en, he: target.he, emoji: target.emoji }, secondWord, options };
};

// המשפט המלא (לא רק מה שבתבנית) - משמש גם להקראה וגם ל-Build-a-Sentence (היעד לסידור)
export const resolveFullSentence = (round: SentenceRound, wordEn: string): string => {
  let s = round.pattern.pattern.replace('{thing}', wordEn);
  if (round.secondWord) s = s.replace(/\{color\}|\{adjective\}/, round.secondWord.en);
  return s + '.';
};

// פירוק המשפט המלא לטוקנים (מילים + נקודה כטוקן נפרד) - לצורך משחק סידור מילים
export const tokenizeSentence = (sentence: string): string[] => {
  const withoutDot = sentence.replace(/\.$/, '');
  return [...withoutDot.split(' '), '.'];
};
