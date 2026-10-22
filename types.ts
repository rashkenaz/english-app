
export enum LearningGoal {
  READING = 'קריאה',
  LISTENING = 'שמיעה',
  WRITING = 'כתיבה',
  ALL = 'הכל'
}

export type TranslationDirection = 'EN_TO_HE' | 'HE_TO_EN';

export interface GameActivity {
  id: string;
  timestamp: number;
  gameType: string;
  score: number;
  mistakes: number;
  xpEarned: number;
  totalItems: number;
  missedCount: number;
  isTargetedReview?: boolean; // true אם הסשן היה תרגול-טעויות/כתיבה ממוקד - לא נספר כסיגנל לקושי אדפטיבי
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  age: number; // גיל הילד
  picture?: string;
  xp: number;
  level: number;
  difficulty: number; // 1 to 5
  history: GameActivity[];
  currentStreak: number; // ימי רצף
  lastActiveDate: string; // YYYY-MM-DD, לחישוב הרצף
  lastDifficultyChangeAt?: number; // היסטרזיס - שינוי קושי (אוטומטי או ידני) הבא דורש סשנים טריים אחרי זה
}

export interface WordEntry {
  id: string;
  english: string;
  hebrew: string;
  example?: string;
  exampleHebrew?: string;
  masteryLevel: number; // 0 to 100
  lastSeen: number;
  createdAt: number;
  tags: string[];
}

export interface GameState {
  isActive: boolean;
  type: 'FLASHCARDS' | 'SPELLING' | 'QUIZ' | 'MEMORY' | 'GRAMMAR' | 'STORY' | 'SENTENCES' | 'PHONICS' | 'NAMES' | 'COLORLAB' | 'SENTENCEBUILDER' | 'WORDHUNT' | 'SOUNDCATCHER' | 'NAMEMATCH' | 'QUIZRACE' | 'IDLE';
  score: number;
  currentWordIndex: number;
  mistakes: number;
}

export interface GrammarExercise {
  id: string;
  sentence: string; // משפט עם "___" אחד במקום המילה החסרה
  options: string[];
  correctAnswer: string;
  hebrewHint?: string;
  masteryLevel: number;
  lastSeen: number;
  createdAt: number;
}

export interface GrammarTopic {
  id: string;
  name: string; // כפי שהוקלד ע"י ההורה, למשל "a/an"
  displayNameHe: string; // נירמול בעברית מג'מיני
  createdAt: number;
  isCurrentFocus: boolean;
  exercises: GrammarExercise[];
}
