
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, WordEntry, GameState, TranslationDirection, GameActivity, GrammarTopic } from './types';
import { WordUploader } from './components/WordUploader';
import { GameArea } from './components/GameArea';
import { GrammarGameArea } from './components/GrammarGameArea';
import { StoryGame } from './components/StoryGame';
import { SentenceGame } from './components/SentenceGame';
import { PhonicsGame } from './components/PhonicsGame';
import { ColorLabGame } from './components/ColorLabGame';
import { SentenceBuilderGame } from './components/SentenceBuilderGame';
import { WordHuntGame } from './components/WordHuntGame';
import { SoundCatcherGame } from './components/SoundCatcherGame';
import { generateGrammarExercises } from './services/geminiService';
import { CURRICULUM_VOCAB, NAMES } from './data/curriculum';
import { computeDifficultyAdjustment, suggestVarietyGame } from './data/adaptiveLogic';

const INITIAL_WORDS_LIST: WordEntry[] = [
  { id: '1', english: 'Apple', hebrew: 'תפוח', masteryLevel: 0, lastSeen: Date.now(), createdAt: Date.now(), tags: [] },
  { id: '2', english: 'Dog', hebrew: 'כלב', masteryLevel: 0, lastSeen: Date.now(), createdAt: Date.now(), tags: [] },
  { id: '3', english: 'Sun', hebrew: 'שמש', masteryLevel: 0, lastSeen: Date.now(), createdAt: Date.now(), tags: [] },
  { id: '4', english: 'School', hebrew: 'בית ספר', masteryLevel: 0, lastSeen: Date.now(), createdAt: Date.now(), tags: [] },
  { id: '5', english: 'Book', hebrew: 'ספר', masteryLevel: 0, lastSeen: Date.now(), createdAt: Date.now(), tags: [] },
];

const DAILY_GOAL = 10;
const WRITING_TAG = 'needs-writing';
const REVIEW_TAG = 'needs-review';

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const applyStreakUpdate = (user: UserProfile): UserProfile => {
  const today = todayStr();
  if (user.lastActiveDate === today) return user;
  const newStreak = user.lastActiveDate === yesterdayStr() ? (user.currentStreak || 0) + 1 : 1;
  return { ...user, currentStreak: newStreak, lastActiveDate: today };
};

type AppStage = 'LOGGED_OUT' | 'ONBOARDING' | 'DASHBOARD';
type AppTab = 'HOME' | 'PROFILE';

const GAME_COLORS: Record<string, string> = {
  FLASHCARDS: 'bg-sky-500 border-sky-700',
  QUIZ: 'bg-pink-500 border-pink-700',
  SPELLING: 'bg-green-500 border-green-700',
  MEMORY: 'bg-purple-500 border-purple-700',
};

const GAME_LABELS: Record<string, string> = {
  FLASHCARDS: 'כרטיסיות', QUIZ: 'חידון', SPELLING: 'איות', MEMORY: 'זיכרון', GRAMMAR: 'דקדוק',
  STORY: 'סיפור', SENTENCES: 'משפטים', PHONICS: 'צלילים', NAMES: 'שמות',
  COLORLAB: 'מעבדת צבעים', SENTENCEBUILDER: 'סדר משפט', WORDHUNT: 'ציד מילים',
  SOUNDCATCHER: 'תופס צלילים', NAMEMATCH: 'התאמת שמות', QUIZRACE: 'מרוץ חידון',
};

const CURRICULUM_IMPORT_VERSION = 'v1';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('eq_active_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [stage, setStage] = useState<AppStage>(() => {
    const session = localStorage.getItem('eq_active_session');
    if (!session) return 'LOGGED_OUT';
    const user = JSON.parse(session);
    // אם המשתמש קיים אך אין לו גיל מוגדר, נשלח אותו ל-Onboarding
    return user.age ? 'DASHBOARD' : 'ONBOARDING';
  });

  const [activeTab, setActiveTab] = useState<AppTab>('HOME');
  const [words, setWords] = useState<WordEntry[]>([]);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [favoriteWordIds, setFavoriteWordIds] = useState<Set<string>>(new Set());
  const [struggledWordIds, setStruggledWordIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'SELECTED' | 'NEW' | 'STRUGGLED' | 'FAVORITES' | 'WRITING' | 'REVIEW'>('ALL');
  const [translationDirection, setTranslationDirection] = useState<TranslationDirection>('EN_TO_HE');
  const [activeGame, setActiveGame] = useState<GameState['type']>('IDLE');
  const [gameResults, setGameResults] = useState<{score: number, mistakes: number, xpEarned: number, missedIds: string[], totalItems: number, maxCombo: number, accuracy: number, stars: number, difficultyChange?: { from: number, to: number, direction: 'up' | 'down' }} | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const [grammarTopics, setGrammarTopics] = useState<GrammarTopic[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const grammarPhotoInputRef = useRef<HTMLInputElement>(null);
  const grammarSectionRef = useRef<HTMLDivElement>(null);
  const currentFocusTopic = grammarTopics.find(t => t.isCurrentFocus) || null;

  const openGrammarPractice = () => {
    if (currentFocusTopic) {
      setActiveGame('GRAMMAR');
    } else {
      // אין עדיין נושא דקדוק פעיל - גוללים לכרטיס ההוספה במקום לפתוח משחק ריק
      grammarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const speak = useCallback((text: string, lang: 'he' | 'en' = 'en') => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'he' ? 'he-IL' : 'en-US';
    utterance.pitch = 1.2; // Friendly, child-like pitch
    utterance.rate = 0.7;  // איטי ומדוד, כדי שילד שלומד אנגלית יספיק להבין
    window.speechSynthesis.speak(utterance);
  }, []);

  // עדכון רצף הימים פעם אחת בטעינת האפליקציה (אם המשתמש כבר מחובר)
  useEffect(() => {
    setCurrentUser(prev => (prev ? applyStreakUpdate(prev) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // טעינת מילים ונתונים בעת שינוי משתמש
  useEffect(() => {
    if (currentUser) {
      const savedWords = localStorage.getItem(`eq_words_${currentUser.id}`);
      const parsed: WordEntry[] = savedWords ? JSON.parse(savedWords) : [];
      let loadedWords = parsed.length > 0 ? parsed : INITIAL_WORDS_LIST;

      // ייבוא חד-פעמי של אוצר המילים מהמחברת (curriculum.ts) - מתווסף למילים הקיימות,
      // לא דורס אותן, ולא רץ שוב ברגע שכבר יובא פעם אחת למשתמש הזה.
      const importFlagKey = `eq_curriculum_imported_${currentUser.id}`;
      if (localStorage.getItem(importFlagKey) !== CURRICULUM_IMPORT_VERSION) {
        const existingEnglish = new Set(loadedWords.map(w => w.english.toLowerCase()));
        const newEntries: WordEntry[] = CURRICULUM_VOCAB
          .filter(cw => !existingEnglish.has(cw.en.toLowerCase()))
          .map(cw => ({
            // "orange" מופיעה גם כפרי וגם כצבע במפרט בכוונה - המזהה כולל קטגוריה כדי לא להתנגש
            id: 'curr_' + cw.cat + '_' + cw.en.toLowerCase().replace(/[^a-z]/g, ''),
            english: cw.en.charAt(0).toUpperCase() + cw.en.slice(1),
            hebrew: cw.he,
            masteryLevel: 0,
            lastSeen: Date.now(),
            createdAt: Date.now(),
            tags: [`unit:${cw.unit}`, `cat:${cw.cat}`],
          }));
        loadedWords = [...loadedWords, ...newEntries];
        localStorage.setItem(importFlagKey, CURRICULUM_IMPORT_VERSION);
      }
      setWords(loadedWords);

      const savedFavs = localStorage.getItem(`eq_favs_${currentUser.id}`);
      setFavoriteWordIds(new Set(savedFavs ? JSON.parse(savedFavs) : []));

      const savedTopics = localStorage.getItem(`eq_grammar_${currentUser.id}`);
      setGrammarTopics(savedTopics ? JSON.parse(savedTopics) : []);
    }
    // תלות רק ב-id (לא באובייקט currentUser כולו) בכוונה: האפקט הזה אמור לרוץ
    // כשמתחלף המשתמש (התחברות/התנתקות), לא בכל עדכון XP/היסטוריה/סטריק.
    // תלות באובייקט המלא גרמה לבאג אמיתי: כל קריאה ל-setCurrentUser (כמו בסיום
    // משחק) הייתה מפעילה מחדש את האפקט הזה, שטוען את רשימת המילים מה-localStorage
    // הישן ודורס בשקט כל setWords שרץ באותה הפעולה (למשל תיוג "תרגול טעויות").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // שמירת פרופיל המשתמש (eq_active_session) בנפרד - בכוונה על כל שינוי באובייקט
  // currentUser (לא רק id), כדי ש-XP/גיל שהוגדר ב-onboarding/סטריק/קושי יישמרו
  // ויחזרו נכון בפתיחה הבאה. בלי זה (כשהיה מאוחד עם האפקט שמעליו) - restart של
  // האתר אחרי סיום Onboarding היה מחזיר את הילד שוב למסך "מי הגיבור החדש?" כי
  // eq_active_session נשאר עם הגרסה הישנה (age:0) שנכתבה לפני שה-onboarding הסתיים.
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('eq_active_session', JSON.stringify(currentUser));
      localStorage.setItem(`eq_user_profile_${currentUser.email}`, JSON.stringify(currentUser));
    }
  }, [currentUser]);

  // שמירת מילים בנפרד
  useEffect(() => {
    if (currentUser && words.length > 0) {
      localStorage.setItem(`eq_words_${currentUser.id}`, JSON.stringify(words));
    }
  }, [words, currentUser]);

  // שמירת נושאי הדקדוק של "השיעור של היום"
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`eq_grammar_${currentUser.id}`, JSON.stringify(grammarTopics));
    }
  }, [grammarTopics, currentUser]);

  const simulateGoogleLogin = () => {
    const mockEmail = "hero_gamer@gmail.com";
    const existingProfile = localStorage.getItem(`eq_user_profile_${mockEmail}`);
    if (existingProfile) {
      const user = applyStreakUpdate(JSON.parse(existingProfile));
      setCurrentUser(user);
      setStage(user.age ? 'DASHBOARD' : 'ONBOARDING');
      speak(`Welcome back, ${user.name}!`);
    } else {
      const newUser: UserProfile = {
        id: "user_" + Math.random().toString(36).substr(2, 9),
        email: mockEmail,
        name: 'אלוף האנגלית',
        age: 0,
        picture: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${Math.random()}`,
        xp: 0,
        level: 1,
        difficulty: 2,
        history: [],
        currentStreak: 1,
        lastActiveDate: todayStr(),
        dailyGoalCount: DAILY_GOAL,
        dailyProgressDate: todayStr(),
        dailyProgressCount: 0,
      };
      setCurrentUser(newUser);
      setStage('ONBOARDING');
    }
  };

  const finishOnboarding = (name: string, ageStr: string) => {
    if (!currentUser) return;
    const age = parseInt(ageStr) || 8;
    const heroName = name.trim() || 'אלוף';

    // חישוב רמת קושי לפי גיל: 6-7 = 1, 8-9 = 2, 10-11 = 3, 12-13 = 4, 14+ = 5
    const calculatedDifficulty = Math.min(5, Math.max(1, Math.floor((age - 5) / 2) + 1));

    const updated = {
      ...currentUser,
      name: heroName,
      age: age,
      difficulty: calculatedDifficulty
    };

    setCurrentUser(updated);
    setStage('DASHBOARD');
    speak(`Hello ${heroName}! You are ${age} years old, so I've set your difficulty to level ${calculatedDifficulty}. Let's play!`);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('eq_active_session');
    setStage('LOGGED_OUT');
    setActiveGame('IDLE');
    setGameResults(null);
    setActiveTab('HOME');
  };

  const handleShare = async (customText?: string) => {
    if (!currentUser) return;
    const text = customText || `הגעתי לרמה ${currentUser.level} ב-My English Teacher! 🛡️ יש לי ${currentUser.xp} XP. בואו ללמוד איתי! 🎮`;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'My English Teacher', text, url }); } catch (err) {}
    } else {
      try { await navigator.clipboard.writeText(`${text}\n${url}`); alert('התוצאות הועתקו ללוח! ✨'); } catch (err) { alert('שיתוף נכשל.'); }
    }
  };

  const handleAddWords = (newWords: { english: string; hebrew: string }[]) => {
    const entries: WordEntry[] = newWords.map(w => ({
      id: Math.random().toString(36).substr(2, 9),
      english: w.english,
      hebrew: w.hebrew,
      masteryLevel: 0,
      lastSeen: Date.now(),
      createdAt: Date.now(),
      tags: []
    }));
    setWords(prev => [...entries, ...prev]);
    speak("Words added to the lab!");
  };

  const toggleWordSelection = (id: string) => {
    const next = new Set(selectedWordIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedWordIds(next);
  };

  const toggleFavorite = (id: string) => {
    const next = new Set(favoriteWordIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFavoriteWordIds(next);
    if (currentUser) {
      localStorage.setItem(`eq_favs_${currentUser.id}`, JSON.stringify(Array.from(next)));
    }
  };

  const toggleWritingTag = (id: string) => {
    setWords(prev => prev.map(w => {
      if (w.id !== id) return w;
      const hasTag = w.tags.includes(WRITING_TAG);
      return { ...w, tags: hasTag ? w.tags.filter(t => t !== WRITING_TAG) : [...w.tags, WRITING_TAG] };
    }));
  };

  const writingWordIds = words.filter(w => w.tags.includes(WRITING_TAG)).map(w => w.id);
  const reviewWordIds = words.filter(w => w.tags.includes(REVIEW_TAG)).map(w => w.id);

  const startMistakeReview = () => {
    setFilterMode('REVIEW');
    setTranslationDirection('EN_TO_HE');
    setActiveGame('QUIZ');
  };

  const handleExampleGenerated = (wordId: string, example: string, exampleHebrew: string) => {
    setWords(prev => prev.map(w => (w.id === wordId ? { ...w, example, exampleHebrew } : w)));
  };

  const startWritingPractice = () => {
    setFilterMode('WRITING');
    setTranslationDirection('EN_TO_HE');
    setActiveGame('SPELLING');
  };

  const [namesAsWords, setNamesAsWords] = useState<WordEntry[]>([]);
  const startNamesGame = () => {
    const shuffled = [...NAMES].sort(() => 0.5 - Math.random()).slice(0, 10);
    setNamesAsWords(shuffled.map(([en, he], i) => ({
      id: 'name_' + i, english: en, hebrew: he, masteryLevel: 0, lastSeen: Date.now(), createdAt: Date.now(), tags: ['names'],
    })));
    setActiveGame('NAMES');
  };

  const [nameMatchWords, setNameMatchWords] = useState<WordEntry[]>([]);
  const startNameMatchGame = () => {
    // מערבבים לפני החיתוך - GameArea.initializeMemoryGame לוקח words.slice(0,6),
    // כך שכל סבב מקבל 6 שמות אקראיים שונים במקום תמיד את אותם 6 הראשונים
    const shuffled = [...NAMES].sort(() => 0.5 - Math.random()).slice(0, 12);
    setNameMatchWords(shuffled.map(([en, he], i) => ({
      id: 'namematch_' + i, english: en, hebrew: he, masteryLevel: 0, lastSeen: Date.now(), createdAt: Date.now(), tags: ['names'],
    })));
    setActiveGame('NAMEMATCH');
  };

  const startQuizRace = () => {
    setFilterMode('ALL');
    setTranslationDirection('EN_TO_HE');
    setActiveGame('QUIZRACE');
  };

  const MIME_BY_EXTENSION: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    heic: 'image/heic', heif: 'image/heif', gif: 'image/gif', bmp: 'image/bmp',
  };

  // בחלק מהדפדפנים/קבצים (למשל HEIC מאייפון) ה-file.type מגיע ריק - אז מנחשים לפי סיומת,
  // כי ג'מיני דוחה בקשה עם mimeType ריק.
  const resolveImageMimeType = (file: File): string => {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return (ext && MIME_BY_EXTENSION[ext]) || 'image/jpeg';
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const buildGrammarTopic = (source: string, displayNameHe: string, exercises: { sentence: string; options: string[]; correctAnswer: string; hebrewHint?: string }[]): GrammarTopic => ({
    id: 'topic_' + Math.random().toString(36).substr(2, 9),
    name: source,
    displayNameHe,
    createdAt: Date.now(),
    isCurrentFocus: true,
    exercises: exercises.map(ex => ({
      id: Math.random().toString(36).substr(2, 9),
      sentence: ex.sentence,
      options: ex.options,
      correctAnswer: ex.correctAnswer,
      hebrewHint: ex.hebrewHint,
      masteryLevel: 0,
      lastSeen: Date.now(),
      createdAt: Date.now(),
    })),
  });

  const createGrammarTopic = async () => {
    if (!topicInput.trim() || !currentUser) return;
    setCreatingTopic(true);
    try {
      const existingWords = words.slice(0, 30).map(w => w.english);
      const { displayNameHe, exercises } = await generateGrammarExercises(topicInput.trim(), currentUser.age || 8, existingWords);
      if (exercises.length === 0) {
        alert('לא הצלחנו ליצור תרגילים לנושא הזה. נסו לנסח אחרת (למשל "a/an" או "he/she/it").');
        return;
      }
      const newTopic = buildGrammarTopic(topicInput.trim(), displayNameHe, exercises);
      setGrammarTopics(prev => [newTopic, ...prev.map(t => ({ ...t, isCurrentFocus: false }))]);
      setTopicInput('');
      speak(`Great! Let's practice ${displayNameHe}!`);
    } catch (error) {
      console.error(error);
      alert('אופס! משהו השתבש ביצירת התרגילים. נסו שוב.');
    } finally {
      setCreatingTopic(false);
    }
  };

  const createGrammarTopicFromPhoto = async (file: File) => {
    if (!currentUser) return;
    setCreatingTopic(true);
    try {
      const base64Data = await blobToBase64(file);
      const mimeType = resolveImageMimeType(file);
      const existingWords = words.slice(0, 30).map(w => w.english);
      const { displayNameHe, exercises } = await generateGrammarExercises({ data: base64Data, mimeType }, currentUser.age || 8, existingWords);
      if (exercises.length === 0) {
        alert('לא הצלחנו לזהות מה לומדים בתמונה. נסו צילום ברור יותר, או הקלידו את הנושא ידנית.');
        return;
      }
      const newTopic = buildGrammarTopic('מצילום מחברת', displayNameHe, exercises);
      setGrammarTopics(prev => [newTopic, ...prev.map(t => ({ ...t, isCurrentFocus: false }))]);
      speak(`Great! Let's practice ${displayNameHe}!`);
    } catch (error: any) {
      console.error(error);
      alert('אופס! משהו השתבש בניתוח התמונה.\n' + (error?.message || 'נסו שוב.'));
    } finally {
      setCreatingTopic(false);
    }
  };

  const setFocusTopic = (id: string) => {
    setGrammarTopics(prev => prev.map(t => ({ ...t, isCurrentFocus: t.id === id })));
  };

  const handleFinishGame = (score: number, mistakes: number, missedIds: string[], totalItems: number, maxCombo: number) => {
    if (!currentUser) return;
    const earnedXp = Math.max(0, score - (mistakes * 20));
    const newXp = currentUser.xp + earnedXp;
    const today = todayStr();
    const isNewDay = currentUser.dailyProgressDate !== today;
    // סשן תרגול-טעויות/כתיבה ממוקד במכוון מרוכז במילים קשות - לא אמור למשוך
    // את הקושי האדפטיבי כלפי מטה כאילו זו רמת היכולת הכללית של הילד
    const isTargetedReview = filterMode === 'REVIEW' || filterMode === 'WRITING';

    const newHistory: GameActivity[] = [{
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      gameType: activeGame,
      score, mistakes, xpEarned: earnedXp,
      totalItems, missedCount: missedIds.length,
      isTargetedReview,
    }, ...currentUser.history].slice(0, 50);

    const difficultyAdjustment = computeDifficultyAdjustment(newHistory, currentUser.difficulty, currentUser.lastDifficultyChangeAt);

    const updatedUser: UserProfile = {
      ...currentUser,
      xp: newXp,
      level: Math.floor(newXp / 1000) + 1,
      dailyProgressDate: today,
      // תרומת סשן בודד למשימה היומית מוגבלת ל-DAILY_GOAL: בלי זה, משחק אחד "גדול"
      // כמו הסיפור (6 שאלות נכון/לא נכון + 15 מילים למיון = 21 פריטים בסשן אחד!)
      // היה ממלא את כל היעד היומי (10) בבת אחת, אחרי פעילות אחת קצרה - לא זה הרעיון.
      dailyProgressCount: (isNewDay ? 0 : currentUser.dailyProgressCount) + Math.min(totalItems, DAILY_GOAL),
      history: newHistory,
      ...(difficultyAdjustment ? { difficulty: difficultyAdjustment.to, lastDifficultyChangeAt: Date.now() } : {}),
    };
    setCurrentUser(updatedUser);

    // מילים/תרגילים שהיו בהם טעויות מתויגות ל"תרגול טעויות" כדי שהילד יוכל לחזור אליהן
    // בפעם אחרת - ההתאמה היא לפי מזהה מילה (למשחקי המילים) או לפי הטקסט באנגלית
    // (למשחקי סיפור/משפטים/צלילים, ששם ה-missedIds הם מילים ולא מזהי WordEntry).
    // מילה שתורגלה בסשן "תרגול טעויות" עצמו וענו עליה נכון - מורידים ממנה את התיוג.
    const missedLower = missedIds.map(m => m.toLowerCase());
    const reviewSessionIds = filterMode === 'REVIEW' ? new Set(filteredWords.map(w => w.id)) : null;
    setWords(prev => prev.map(w => {
      const wasMissed = missedIds.includes(w.id) || missedLower.includes(w.english.toLowerCase());
      if (wasMissed) {
        return w.tags.includes(REVIEW_TAG) ? w : { ...w, tags: [...w.tags, REVIEW_TAG] };
      }
      if (reviewSessionIds?.has(w.id) && w.tags.includes(REVIEW_TAG)) {
        return { ...w, tags: w.tags.filter(t => t !== REVIEW_TAG) };
      }
      return w;
    }));

    const accuracy = totalItems > 0 ? Math.round(((totalItems - missedIds.length) / totalItems) * 100) : 100;
    const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;
    setGameResults({
      score, mistakes, xpEarned: earnedXp, missedIds, totalItems, maxCombo, accuracy, stars,
      difficultyChange: difficultyAdjustment ? { from: currentUser.difficulty, to: difficultyAdjustment.to, direction: difficultyAdjustment.direction } : undefined,
    });
    setStruggledWordIds(missedIds);
    setActiveGame('IDLE');
    speak(`Finished! You earned ${earnedXp} XP.`);
  };

  const adjustDifficulty = (delta: number) => {
    if (!currentUser) return;
    const newDiff = Math.max(1, Math.min(5, currentUser.difficulty + delta));
    // גם שינוי ידני מאפס את ההיסטרזיס - כך שהמערכת לא "נלחמת" מיד בבחירה של ההורה/ילד
    setCurrentUser({ ...currentUser, difficulty: newDiff, lastDifficultyChangeAt: Date.now() });
  };

  const filteredWords = words.filter(w => {
    if (filterMode === 'SELECTED') return selectedWordIds.has(w.id);
    if (filterMode === 'FAVORITES') return favoriteWordIds.has(w.id);
    if (filterMode === 'STRUGGLED') return struggledWordIds.includes(w.id);
    if (filterMode === 'NEW') return Date.now() - w.createdAt < 86400000;
    if (filterMode === 'WRITING') return w.tags.includes(WRITING_TAG);
    if (filterMode === 'REVIEW') return w.tags.includes(REVIEW_TAG);
    return true;
  });

  // סטטיסטיקות אמיתיות (לא בדויות) לפרופיל ולהישגים
  const totalAttempted = currentUser?.history.reduce((s, h) => s + (h.totalItems || 0), 0) || 0;
  const totalMissed = currentUser?.history.reduce((s, h) => s + (h.missedCount ?? h.mistakes), 0) || 0;
  const overallAccuracy = totalAttempted > 0 ? Math.max(0, Math.round(((totalAttempted - totalMissed) / totalAttempted) * 100)) : 0;
  const varietySuggestion = currentUser ? suggestVarietyGame(currentUser.history) : null;

  const badges = currentUser ? [
    { icon: '🎯', label: 'חידון מושלם', earned: currentUser.history.some(h => h.gameType === 'QUIZ' && h.mistakes === 0 && h.totalItems > 0) },
    { icon: '📚', label: '100 מילים', earned: words.length >= 100 },
    { icon: '🔥', label: 'רצף 7 ימים', earned: currentUser.currentStreak >= 7 },
    { icon: '⌨️', label: 'איות מושלם', earned: currentUser.history.some(h => h.gameType === 'SPELLING' && h.mistakes === 0 && h.totalItems > 0) },
    { icon: '🧠', label: 'מאסטר הזיכרון', earned: currentUser.history.some(h => h.gameType === 'MEMORY' && h.mistakes === 0 && h.totalItems > 0) },
    { icon: '📝', label: 'תלמיד דקדוק', earned: currentUser.history.some(h => h.gameType === 'GRAMMAR') },
  ] : [];

  if (stage === 'LOGGED_OUT') {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full glass-panel p-8 rounded-3xl text-center space-y-5 animate-float">
          <img src="/logo.png" alt="My English Teacher" className="w-32 h-32 mx-auto rounded-3xl shadow-2xl" />
          <h1 className="text-3xl sm:text-4xl en-font text-white drop-shadow-lg">MY ENGLISH TEACHER</h1>
          <p className="text-base text-slate-200">הפוך למאסטר באנגלית דרך הרפתקאות!</p>
          <button onClick={simulateGoogleLogin} className="roblox-btn w-full bg-white text-slate-900 py-4 text-xl flex items-center justify-center gap-3 hover:bg-slate-100">
            <span className="text-2xl">🎮</span> כניסה מהירה
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'ONBOARDING') {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full glass-panel p-6 rounded-3xl space-y-5">
          <h2 className="text-3xl gaming-font text-white text-center">מי הגיבור החדש? ⚔️</h2>
          <div className="space-y-3">
            <input id="name-input" autoFocus type="text" placeholder="שם הגיבור..."
              className="w-full bg-white/10 border-2 border-white/20 p-4 rounded-2xl text-xl text-center outline-none focus:border-sky-400 text-white placeholder-slate-400" />
            <input id="age-input" type="number" placeholder="גיל הילד..."
              className="w-full bg-white/10 border-2 border-white/20 p-4 rounded-2xl text-xl text-center outline-none focus:border-sky-400 text-white placeholder-slate-400" />
          </div>
          <button
            onClick={() => {
              const name = (document.getElementById('name-input') as HTMLInputElement).value;
              const age = (document.getElementById('age-input') as HTMLInputElement).value;
              finishOnboarding(name, age);
            }}
            className="roblox-btn w-full bg-sky-500 border-sky-700 text-white py-4 text-xl">
            בוא נצא לדרך! 🏹
          </button>
        </div>
      </div>
    );
  }

  if (activeGame === 'GRAMMAR' && currentFocusTopic) {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <GrammarGameArea
          topicDisplayName={currentFocusTopic.displayNameHe}
          exercises={currentFocusTopic.exercises}
          onExit={() => setActiveGame('IDLE')}
          onFinish={handleFinishGame}
        />
      </div>
    );
  }

  if (activeGame === 'STORY') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <StoryGame onExit={() => setActiveGame('IDLE')} onFinish={handleFinishGame} />
      </div>
    );
  }

  if (activeGame === 'SENTENCES') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <SentenceGame onExit={() => setActiveGame('IDLE')} onFinish={handleFinishGame} />
      </div>
    );
  }

  if (activeGame === 'PHONICS') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <PhonicsGame onExit={() => setActiveGame('IDLE')} onFinish={handleFinishGame} />
      </div>
    );
  }

  if (activeGame === 'NAMES') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <GameArea
          words={namesAsWords}
          gameType="QUIZ"
          direction="EN_TO_HE"
          difficulty={currentUser?.difficulty || 2}
          onExit={() => setActiveGame('IDLE')}
          onFinish={handleFinishGame}
          silent
        />
      </div>
    );
  }

  if (activeGame === 'NAMEMATCH') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <GameArea
          words={nameMatchWords}
          gameType="MEMORY"
          direction="EN_TO_HE"
          difficulty={currentUser?.difficulty || 2}
          onExit={() => setActiveGame('IDLE')}
          onFinish={handleFinishGame}
          silent
        />
      </div>
    );
  }

  if (activeGame === 'QUIZRACE') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <GameArea
          words={words}
          gameType="QUIZ"
          direction={translationDirection}
          difficulty={currentUser?.difficulty || 2}
          onExit={() => setActiveGame('IDLE')}
          onFinish={handleFinishGame}
          timedSeconds={(currentUser?.difficulty || 2) >= 4 ? 60 : (currentUser?.difficulty || 2) === 3 ? 75 : 90}
        />
      </div>
    );
  }

  if (activeGame === 'COLORLAB') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <ColorLabGame onExit={() => setActiveGame('IDLE')} onFinish={handleFinishGame} />
      </div>
    );
  }

  if (activeGame === 'SENTENCEBUILDER') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <SentenceBuilderGame onExit={() => setActiveGame('IDLE')} onFinish={handleFinishGame} />
      </div>
    );
  }

  if (activeGame === 'WORDHUNT') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <WordHuntGame onExit={() => setActiveGame('IDLE')} onFinish={handleFinishGame} />
      </div>
    );
  }

  if (activeGame === 'SOUNDCATCHER') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <SoundCatcherGame onExit={() => setActiveGame('IDLE')} onFinish={handleFinishGame} />
      </div>
    );
  }

  if (activeGame !== 'IDLE') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <GameArea
          words={filteredWords.length > 0 ? filteredWords : words}
          gameType={activeGame as 'FLASHCARDS' | 'SPELLING' | 'QUIZ' | 'MEMORY'}
          direction={translationDirection}
          difficulty={currentUser?.difficulty || 2}
          onExit={() => setActiveGame('IDLE')}
          onFinish={handleFinishGame}
          onExampleGenerated={handleExampleGenerated}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100 pb-28" dir="rtl">

      {/* Header */}
      <div className="p-3 sm:p-6 flex justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {/* הלוגו המלא (public/logo.png) כולל טקסט וסצנה - בלי כלי חיתוך תמונה זמין במכונה הזו,
                מתמקדים בפרצוף של הקמע דרך CSS (object-position + scale) בתוך מסגרת עגולה שחותכת */}
            <div className="w-14 h-14 rounded-full border-2 border-sky-400 shadow-lg overflow-hidden">
              <img src="/logo.png" alt="Avatar" className="w-full h-full object-cover" style={{ objectPosition: '52% 24%', transform: 'scale(1.8)' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-slate-900 font-black px-2 py-0.5 rounded-full border-2 border-indigo-950 text-xs">רמה {currentUser?.level}</div>
          </div>
          <div>
            <h1 className="text-lg font-black gaming-font text-white leading-tight">היי, {currentUser?.name}! 👋</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-24 sm:w-36 h-3 bg-black/30 rounded-full overflow-hidden border border-white/10">
                <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500" style={{ width: `${(currentUser?.xp || 0) % 1000 / 10}%` }} />
              </div>
              <span className="text-yellow-300 font-bold text-xs en-font">{currentUser?.xp} XP</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowHistory(!showHistory)} className="roblox-btn bg-indigo-600/60 border-indigo-900 text-white px-3 py-2 text-xs">{showHistory ? '🏠' : '📜'}</button>
          <button onClick={logout} className="roblox-btn bg-red-500 border-red-700 text-white px-3 py-2 text-xs">🚪</button>
        </div>
      </div>

      {activeTab === 'HOME' && (
      <div className="p-3 sm:p-6 space-y-4">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="result-badge p-3 text-center"><p className="text-xl font-black en-font">🔥 {currentUser?.currentStreak || 0}</p><p className="text-xs text-slate-300">ימי רצף</p></div>
          <div className="result-badge p-3 text-center"><p className="text-xl font-black en-font">📚 {words.length}</p><p className="text-xs text-slate-300">מילים</p></div>
          <div className="result-badge p-3 text-center"><p className="text-xl font-black en-font">🎯 {overallAccuracy}%</p><p className="text-xs text-slate-300">דיוק</p></div>
        </div>

        {/* Game results - victory screen */}
        {gameResults && !showHistory && (
          <div className="glass-panel p-6 rounded-3xl animate-slide-in text-center space-y-3 relative overflow-hidden">
            <div className="flex justify-center gap-1 text-5xl">
              {[1, 2, 3].map(i => <span key={i}>{i <= gameResults.stars ? '⭐' : '☆'}</span>)}
            </div>
            <h3 className="text-[clamp(34px,11vw,46px)] gaming-font text-yellow-300">כל הכבוד! 🎉</h3>
            <p className="text-slate-300 text-sm">{gameResults.accuracy}% דיוק{gameResults.maxCombo >= 2 ? ` · קומבו הכי גבוה x${gameResults.maxCombo}` : ''}</p>
            {gameResults.difficultyChange && (
              <div className={`rounded-2xl p-3 border-2 text-sm font-black ${
                gameResults.difficultyChange.direction === 'up' ? 'bg-yellow-400/20 border-yellow-400 text-yellow-200' : 'bg-sky-400/20 border-sky-400 text-sky-200'
              }`} dir="rtl">
                {gameResults.difficultyChange.direction === 'up'
                  ? `⚡ עלית לרמה ${gameResults.difficultyChange.to}! ענית מעולה כמה משחקים ברצף`
                  : `💙 עברנו לרמה ${gameResults.difficultyChange.to} כדי להתאמן בקצב שלך`}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-3 bg-black/20 rounded-2xl"><p className="text-slate-300 font-bold text-xs en-font">XP</p><p className="text-2xl font-black text-sky-300 en-font">+{gameResults.xpEarned}</p></div>
              <div className="text-center p-3 bg-black/20 rounded-2xl"><p className="text-slate-300 font-bold text-xs">ניקוד</p><p className="text-2xl font-black text-white en-font">{gameResults.score}</p></div>
              <div className="text-center p-3 bg-black/20 rounded-2xl"><p className="text-slate-300 font-bold text-xs">טעויות</p><p className="text-2xl font-black text-red-400 en-font">{gameResults.mistakes}</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setGameResults(null)} className="roblox-btn flex-1 bg-indigo-500 border-indigo-700 text-white py-3 text-base">בית 🏠</button>
              <button onClick={() => handleShare()} className="roblox-btn flex-1 bg-sky-500 border-sky-700 text-white py-3 text-base">שתף 📤</button>
            </div>
          </div>
        )}

        {/* History */}
        {showHistory ? (
          <div className="glass-panel p-4 rounded-3xl">
            <h3 className="text-2xl gaming-font text-white mb-4">יומן מסע 🛡️</h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {currentUser?.history.map(activity => (
                <div key={activity.id} className="bg-black/20 p-4 rounded-2xl flex justify-between items-center">
                  <div><p className="font-black text-base text-white">{GAME_LABELS[activity.gameType] || activity.gameType}</p><p className="text-slate-400 text-xs">{new Date(activity.timestamp).toLocaleDateString()}</p></div>
                  <div className="text-right"><p className="text-sky-300 font-black text-sm en-font">+{activity.xpEarned} XP</p><p className="text-slate-400 text-xs">ניקוד: {activity.score}</p></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Daily mission */}
            <div className="rounded-3xl px-5 py-4 flex items-center justify-between gap-3" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}>
              <div className="flex-1">
                <p className="text-base font-black text-amber-900">משימה יומית</p>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{Math.min(currentUser?.dailyProgressCount || 0, DAILY_GOAL)}/{DAILY_GOAL} תרגול מילים היום</p>
                <div className="w-full h-2.5 bg-amber-900/20 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-slate-900/70 transition-all" style={{ width: `${Math.min(100, ((currentUser?.dailyProgressCount || 0) / DAILY_GOAL) * 100)}%` }} />
                </div>
              </div>
              <span className="text-3xl">🏆</span>
            </div>

            {/* הצעת גיוון - מופיעה כשהילד תקוע על אותה "משפחת משחקים" היום, נעלמת
                מעצמה ברגע שהוא משחק את ההצעה (הכלל שוב לא מתקיים) */}
            {varietySuggestion && (
              <div className="rounded-3xl p-4 flex items-center justify-between gap-3" style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }} dir="rtl">
                <div className="flex-1">
                  <p className="text-sm font-black text-white">שיחקת הרבה באותו סוג משחק היום! 🎯</p>
                  <p className="text-xs text-sky-100 mt-0.5">בוא ננסה גם {GAME_LABELS[varietySuggestion]} כדי להשלים את המשימה</p>
                </div>
                <button onClick={() => setActiveGame(varietySuggestion)}
                  className="roblox-btn bg-white text-indigo-700 px-4 py-2 text-sm whitespace-nowrap">
                  בואו! ▶️
                </button>
              </div>
            )}

            {/* Game buttons */}
            <div className="grid grid-cols-2 gap-3">
              {(['FLASHCARDS', 'QUIZ', 'SPELLING', 'MEMORY'] as const).map(type => (
                <button key={type} onClick={() => setActiveGame(type)}
                  className={`roblox-btn ${GAME_COLORS[type]} flex flex-col items-center justify-center p-4 active:scale-95 gap-2 text-white`} style={{ minHeight: 120 }}>
                  <span className="text-[44px] leading-none">{type === 'FLASHCARDS' ? '🎴' : type === 'QUIZ' ? '🎯' : type === 'SPELLING' ? '⌨️' : '🧠'}</span>
                  <span className="font-black text-base text-center leading-tight">{GAME_LABELS[type]}</span>
                </button>
              ))}
            </div>

            {/* משחקים נוספים מהמחברת */}
            <div>
              <h3 className="text-sm font-black text-slate-300 mb-2" dir="rtl">עוד מהמחברת 📒</h3>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { onClick: () => setActiveGame('STORY'), color: 'bg-amber-500 border-amber-700', emoji: '📖', label: 'סיפור' },
                  { onClick: () => setActiveGame('SENTENCES'), color: 'bg-teal-500 border-teal-700', emoji: '✍️', label: 'משפטים' },
                  { onClick: startNamesGame, color: 'bg-fuchsia-500 border-fuchsia-700', emoji: '🏷️', label: 'שמות' },
                  { onClick: () => setActiveGame('PHONICS'), color: 'bg-rose-500 border-rose-700', emoji: '🔤', label: 'צלילים' },
                  { onClick: () => setActiveGame('COLORLAB'), color: 'bg-pink-500 border-pink-700', emoji: '🎨', label: 'צבעים' },
                  { onClick: () => setActiveGame('SENTENCEBUILDER'), color: 'bg-indigo-500 border-indigo-700', emoji: '🧩', label: 'סדר משפט' },
                  { onClick: () => setActiveGame('WORDHUNT'), color: 'bg-red-500 border-red-700', emoji: '🔍', label: 'ציד מילים' },
                  { onClick: () => setActiveGame('SOUNDCATCHER'), color: 'bg-cyan-500 border-cyan-700', emoji: '🎣', label: 'תופס צלילים' },
                  { onClick: startNameMatchGame, color: 'bg-purple-500 border-purple-700', emoji: '🧠', label: 'התאמת שמות' },
                  { onClick: startQuizRace, color: 'bg-orange-500 border-orange-700', emoji: '⏱️', label: 'מרוץ חידון' },
                  { onClick: openGrammarPractice, color: 'bg-violet-500 border-violet-700', emoji: '📝', label: currentFocusTopic ? currentFocusTopic.displayNameHe : 'דקדוק' },
                ].map((g, i) => (
                  <button key={i} onClick={g.onClick} className={`roblox-btn ${g.color} flex flex-col items-center justify-center p-3 gap-1 text-white`}>
                    <span className="text-2xl">{g.emoji}</span>
                    <span className="font-black text-[11px] text-center">{g.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* תרגול טעויות - מילים שהילד טעה בהן בכל משחק, עד שיענה עליהן נכון */}
            {reviewWordIds.length > 0 && (
              <button onClick={startMistakeReview}
                className="roblox-btn w-full bg-orange-500 border-orange-700 text-white py-4 text-lg flex items-center justify-center gap-2">
                ⚠️ תרגול טעויות ({reviewWordIds.length})
              </button>
            )}

            {/* תרגול כתיבה ממוקד */}
            {writingWordIds.length > 0 && (
              <button onClick={startWritingPractice}
                className="roblox-btn w-full bg-rose-500 border-rose-700 text-white py-4 text-lg flex items-center justify-center gap-2">
                ✏️ תרגול כתיבה ({writingWordIds.length})
              </button>
            )}

            {/* מה לומדים היום בכיתה */}
            <div ref={grammarSectionRef} className="glass-panel p-5 rounded-3xl" dir="rtl">
              <h3 className="text-xl gaming-font text-white mb-3">מה לומדים היום בכיתה? 📝</h3>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !creatingTopic && createGrammarTopic()}
                  placeholder='למשל: a/an, או he/she/it'
                  disabled={creatingTopic}
                  className="flex-1 bg-black/20 border-2 border-white/20 rounded-2xl px-4 py-3 text-white outline-none focus:border-purple-400"
                  dir="ltr"
                />
                <button onClick={createGrammarTopic} disabled={creatingTopic || !topicInput.trim()}
                  className="roblox-btn bg-purple-500 border-purple-700 text-white px-5 disabled:opacity-50">
                  {creatingTopic ? <span className="animate-spin inline-block">🌀</span> : 'צור'}
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-white/15" />
                <span className="text-xs text-slate-400">או</span>
                <div className="flex-1 h-px bg-white/15" />
              </div>

              <button onClick={() => grammarPhotoInputRef.current?.click()} disabled={creatingTopic}
                className="roblox-btn w-full bg-white/10 border-black/20 text-white py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {creatingTopic ? <span className="animate-spin">🌀</span> : '📷'} צלמו עמוד מהמחברת - נזהה מה לומדים
              </button>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={grammarPhotoInputRef}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) createGrammarTopicFromPhoto(file);
                  if (grammarPhotoInputRef.current) grammarPhotoInputRef.current.value = '';
                }}
              />

              {currentFocusTopic && (
                <div className="bg-purple-500/15 border-2 border-purple-400/40 rounded-2xl p-4 flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs text-purple-200 font-bold">השיעור הפעיל עכשיו</p>
                    <p className="text-lg font-black text-white">{currentFocusTopic.displayNameHe}</p>
                  </div>
                  <button onClick={() => setActiveGame('GRAMMAR')}
                    className="roblox-btn bg-purple-500 border-purple-700 text-white px-4 py-3 text-sm whitespace-nowrap">
                    תרגול השיעור 🧠
                  </button>
                </div>
              )}

              {grammarTopics.filter(t => !t.isCurrentFocus).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {grammarTopics.filter(t => !t.isCurrentFocus).map(t => (
                    <button key={t.id} onClick={() => setFocusTopic(t.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-black bg-white/10 text-slate-300 hover:bg-white/20">
                      {t.displayNameHe}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Settings row */}
            <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center gap-3 justify-between">
              <div className="flex gap-2">
                <button onClick={() => setTranslationDirection('EN_TO_HE')} className={`px-3 py-2 rounded-xl font-black text-xs transition-all ${translationDirection === 'EN_TO_HE' ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-300'}`}>EN→עב</button>
                <button onClick={() => setTranslationDirection('HE_TO_EN')} className={`px-3 py-2 rounded-xl font-black text-xs transition-all ${translationDirection === 'HE_TO_EN' ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-300'}`}>עב→EN</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => adjustDifficulty(-1)} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg font-black text-white">-</button>
                <div className="flex gap-1">{[1,2,3,4,5].map(i => <div key={i} className={`w-2.5 h-2.5 rounded-full ${i <= (currentUser?.difficulty || 1) ? 'bg-yellow-400' : 'bg-white/20'}`} />)}</div>
                <button onClick={() => adjustDifficulty(1)} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg font-black text-white">+</button>
              </div>
            </div>

            {/* Word uploader */}
            <WordUploader onWordsAdded={handleAddWords} />

            {/* Word list */}
            <div className="glass-panel p-4 rounded-3xl">
              <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h3 className="text-lg gaming-font text-white">מילים {selectedWordIds.size > 0 && `(${selectedWordIds.size}✓)`}</h3>
                <div className="flex flex-wrap gap-1">
                  {(['ALL', 'SELECTED', 'FAVORITES', 'STRUGGLED', 'NEW', 'WRITING'] as const).map(mode => (
                    <button key={mode} onClick={() => setFilterMode(mode)}
                      className={`px-2 py-1 rounded-lg text-xs font-black transition-all ${filterMode === mode ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-300'}`}>
                      {mode === 'ALL' ? 'הכל' : mode === 'SELECTED' ? '✓' : mode === 'FAVORITES' ? '⭐' : mode === 'STRUGGLED' ? '😓' : mode === 'NEW' ? '🆕' : '✏️'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredWords.map(word => (
                  <div key={word.id}
                    className={`p-3 rounded-2xl transition-all cursor-pointer flex justify-between items-center ${selectedWordIds.has(word.id) ? 'bg-sky-500/20 border-2 border-sky-400/50' : 'bg-black/15 border-2 border-transparent'}`}
                    onClick={() => toggleWordSelection(word.id)}>
                    <div>
                      <p className="text-base font-black text-white en-font">{word.english}</p>
                      <p className="text-slate-300 text-sm">{word.hebrew}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={(e) => { e.stopPropagation(); toggleWritingTag(word.id); }}
                        title="צריך תרגול כתיבה"
                        className={`text-xl transition-all ${word.tags.includes(WRITING_TAG) ? '' : 'opacity-30'}`}>✏️</button>
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite(word.id); }}
                        className={`text-xl transition-all ${favoriteWordIds.has(word.id) ? '' : 'opacity-30'}`}>⭐</button>
                      <div className={`w-3.5 h-3.5 rounded-full ${selectedWordIds.has(word.id) ? 'bg-sky-400' : 'bg-white/20'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {activeTab === 'PROFILE' && currentUser && (
        <div className="p-3 sm:p-6 space-y-5 text-center">
          <div className="flex flex-col items-center gap-2">
            <img src={currentUser.picture} alt="Avatar" className="w-28 h-28 rounded-3xl border-4 border-yellow-400 shadow-2xl" />
            <h2 className="text-2xl font-black text-white">{currentUser.name}</h2>
            <p className="text-sm text-slate-300">רמה {currentUser.level} · {words.length} מילים ברשימה</p>
            <div className="w-full max-w-xs flex items-center gap-2">
              <div className="flex-1 h-3 bg-black/30 rounded-full overflow-hidden border border-white/10">
                <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500" style={{ width: `${(currentUser.xp % 1000) / 10}%` }} />
              </div>
              <span className="text-yellow-300 font-bold text-xs en-font">{currentUser.xp % 1000}/1000</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="result-badge p-4"><p className="text-2xl font-black en-font">{overallAccuracy}%</p><p className="text-xs text-slate-300">דיוק</p></div>
            <div className="result-badge p-4"><p className="text-2xl font-black en-font">🔥 {currentUser.currentStreak}</p><p className="text-xs text-slate-300">ימי רצף</p></div>
            <div className="result-badge p-4"><p className="text-2xl font-black en-font">{words.length}</p><p className="text-xs text-slate-300">מילים</p></div>
          </div>

          <div dir="rtl">
            <h3 className="text-lg font-black text-white mb-3 text-right">תגים</h3>
            <div className="grid grid-cols-3 gap-3">
              {badges.map((b, i) => (
                <div key={i} className={`result-badge p-4 flex flex-col items-center gap-1 ${b.earned ? '' : 'opacity-35 grayscale'}`}>
                  <span className="text-3xl">{b.icon}</span>
                  <span className="text-xs font-black text-center">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="fixed bottom-0 inset-x-0 z-40">
        <div className="max-w-lg mx-auto glass-panel rounded-t-3xl flex justify-around items-center py-3 px-4">
          <button onClick={() => setActiveTab('HOME')} className={`flex flex-col items-center gap-1 px-6 py-1 rounded-2xl transition-all ${activeTab === 'HOME' ? 'bg-yellow-400 text-slate-900' : 'text-slate-300'}`}>
            <span className="text-xl">🏠</span>
            <span className="text-[11px] font-black">בית</span>
          </button>
          <button onClick={() => setActiveTab('PROFILE')} className={`flex flex-col items-center gap-1 px-6 py-1 rounded-2xl transition-all ${activeTab === 'PROFILE' ? 'bg-yellow-400 text-slate-900' : 'text-slate-300'}`}>
            <span className="text-xl">👤</span>
            <span className="text-[11px] font-black">פרופיל</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
