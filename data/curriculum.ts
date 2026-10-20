// תוכן קבוע שנגזר ישירות ממחברת הלימוד של הילד (ראו english-app-system-spec.md).
// זהו מידע סטטי - תרגילים נבנים ממנו, לא "קשיחים" בתוך קומפוננטות המשחק.

export interface CurriculumWord {
  en: string;
  he: string;
  cat: string;
  emoji?: string;
  unit: string;
  vowel?: string;
  hex?: string;
  value?: number;
  also?: string;
}

export const CURRICULUM_VOCAB: CurriculumWord[] = [
  { en: 'pen', he: 'עט', cat: 'school', emoji: '🖊️', unit: 'U2', vowel: 'e', also: 'לא לבלבל עם pencil (טעות נפוצה)' },
  { en: 'pencil', he: 'עיפרון', cat: 'school', emoji: '✏️', unit: 'U2' },
  { en: 'bag', he: 'תיק', cat: 'school', emoji: '🎒', unit: 'U1', vowel: 'a' },
  { en: 'ruler', he: 'סרגל', cat: 'school', emoji: '📏', unit: 'U2' },
  { en: 'marker', he: 'טוש', cat: 'school', emoji: '🖍️', unit: 'U2' },
  { en: 'notebook', he: 'מחברת', cat: 'school', emoji: '📓', unit: 'U2' },
  { en: 'book', he: 'ספר', cat: 'school', emoji: '📕', unit: 'U2' },
  { en: 'glue', he: 'דבק', cat: 'school', emoji: '🧴', unit: 'U2' },
  { en: 'desk', he: 'שולחן כתיבה', cat: 'school', emoji: '🗄️', unit: 'U2' },
  { en: 'chair', he: 'כיסא', cat: 'school', emoji: '🪑', unit: 'U2' },
  { en: 'table', he: 'שולחן', cat: 'school', emoji: '🍽️', unit: 'U2' },
  { en: 'window', he: 'חלון', cat: 'home', emoji: '🪟', unit: 'U2' },
  { en: 'door', he: 'דלת', cat: 'home', emoji: '🚪', unit: 'U2' },
  { en: 'room', he: 'חדר', cat: 'home', emoji: '🏠', unit: 'U2' },
  { en: 'mat', he: 'שטיח', cat: 'home', emoji: '🟫', unit: 'U2', vowel: 'a' },
  { en: 'bed', he: 'מיטה', cat: 'home', emoji: '🛏️', unit: 'U3', vowel: 'e' },
  { en: 'lamp', he: 'מנורה', cat: 'home', emoji: '💡', unit: 'U3' },
  { en: 'sofa', he: 'ספה', cat: 'home', emoji: '🛋️', unit: 'U3' },
  { en: 'radio', he: 'רדיו', cat: 'home', emoji: '📻', unit: 'U3' },
  { en: 'camera', he: 'מצלמה', cat: 'home', emoji: '📷', unit: 'U6' },
  { en: 'box', he: 'קופסה', cat: 'things', emoji: '📦', unit: 'U6' },
  { en: 'ball', he: 'כדור', cat: 'things', emoji: '⚽', unit: 'U3' },
  { en: 'hat', he: 'כובע', cat: 'things', emoji: '👒', unit: 'U1', vowel: 'a' },
  { en: 'van', he: 'טנדר', cat: 'things', emoji: '🚐', unit: 'U6', vowel: 'a' },
  { en: 'igloo', he: 'איגלו', cat: 'things', emoji: '🧊', unit: 'U6' },
  { en: 'tree', he: 'עץ', cat: 'things', emoji: '🌳', unit: 'U3' },
  { en: 'sun', he: 'שמש', cat: 'things', emoji: '☀️', unit: 'U6', vowel: 'u' },
  { en: 'robot', he: 'רובוט', cat: 'things', emoji: '🤖', unit: 'U3' },
  { en: 'pizza', he: 'פיצה', cat: 'food', emoji: '🍕', unit: 'U6' },
  { en: 'apple', he: 'תפוח', cat: 'food', emoji: '🍎', unit: 'U3' },
  { en: 'lemon', he: 'לימון', cat: 'food', emoji: '🍋', unit: 'U3' },
  { en: 'banana', he: 'בננה', cat: 'food', emoji: '🍌', unit: 'U3' },
  { en: 'orange', he: 'תפוז', cat: 'food', emoji: '🍊', unit: 'U6', also: 'גם צבע כתום (נפרד ברשימת הצבעים)' },
  { en: 'cat', he: 'חתול', cat: 'animals', emoji: '🐱', unit: 'U1', vowel: 'a' },
  { en: 'dog', he: 'כלב', cat: 'animals', emoji: '🐶', unit: 'U3', vowel: 'o' },
  { en: 'frog', he: 'צפרדע', cat: 'animals', emoji: '🐸', unit: 'U3', vowel: 'o' },
  { en: 'hippo', he: 'היפופוטם', cat: 'animals', emoji: '🦛', unit: 'U3' },
  { en: 'panda', he: 'פנדה', cat: 'animals', emoji: '🐼', unit: 'U3' },
  { en: 'horse', he: 'סוס', cat: 'animals', emoji: '🐴', unit: 'U3' },
  { en: 'koala', he: 'קואלה', cat: 'animals', emoji: '🐨', unit: 'U3' },
  { en: 'fish', he: 'דג', cat: 'animals', emoji: '🐟', unit: 'U3' },
  { en: 'fox', he: 'שועל', cat: 'animals', emoji: '🦊', unit: 'U3', vowel: 'o' },
  { en: 'zebra', he: 'זברה', cat: 'animals', emoji: '🦓', unit: 'U6' },
  { en: 'rabbit', he: 'ארנב', cat: 'animals', emoji: '🐰', unit: 'U6' },
  { en: 'gorilla', he: 'גורילה', cat: 'animals', emoji: '🦍', unit: 'U6' },
  { en: 'bat', he: 'עטלף', cat: 'animals', emoji: '🦇', unit: 'U2', vowel: 'a', also: 'בדפי העבודה זה העטלף (חיה)' },
  { en: 'bug', he: 'חרק', cat: 'animals', emoji: '🐛', unit: 'U7', vowel: 'u' },
  { en: 'hen', he: 'תרנגולת', cat: 'animals', emoji: '🐔', unit: 'U7', vowel: 'e' },
  { en: 'pet', he: 'חיית מחמד', cat: 'animals', emoji: '🐕', unit: 'U7', vowel: 'e' },
  { en: 'man', he: 'איש', cat: 'people', emoji: '👨', unit: 'U1', vowel: 'a', also: 'לא לבלבל עם boy (טעות נפוצה)' },
  { en: 'boy', he: 'ילד', cat: 'people', emoji: '👦', unit: 'U1' },
  { en: 'girl', he: 'ילדה', cat: 'people', emoji: '👧', unit: 'U1' },
  { en: 'king', he: 'מלך', cat: 'people', emoji: '🤴', unit: 'U6' },
  { en: 'eyes', he: 'עיניים', cat: 'body', emoji: '👀', unit: 'U1' },
  { en: 'hair', he: 'שיער', cat: 'body', emoji: '💇', unit: 'U1' },
  { en: 'red', he: 'אדום', cat: 'colors', hex: '#E53935', unit: 'U2' },
  { en: 'blue', he: 'כחול', cat: 'colors', hex: '#1E88E5', unit: 'U2' },
  { en: 'pink', he: 'ורוד', cat: 'colors', hex: '#F48FB1', unit: 'U2' },
  { en: 'white', he: 'לבן', cat: 'colors', hex: '#FFFFFF', unit: 'U4' },
  { en: 'brown', he: 'חום', cat: 'colors', hex: '#795548', unit: 'U1' },
  { en: 'grey', he: 'אפור', cat: 'colors', hex: '#9E9E9E', unit: 'U2' },
  { en: 'orange', he: 'כתום', cat: 'colors', hex: '#FB8C00', unit: 'U2' },
  { en: 'yellow', he: 'צהוב', cat: 'colors', hex: '#FDD835', unit: 'U1' },
  { en: 'purple', he: 'סגול', cat: 'colors', hex: '#8E24AA', unit: 'U4' },
  { en: 'green', he: 'ירוק', cat: 'colors', hex: '#43A047', unit: 'U4' },
  { en: 'black', he: 'שחור', cat: 'colors', hex: '#212121', unit: 'U1' },
  { en: 'two', he: '2', cat: 'numbers', value: 2, unit: 'U4' },
  { en: 'three', he: '3', cat: 'numbers', value: 3, unit: 'U4' },
  { en: 'four', he: '4', cat: 'numbers', value: 4, unit: 'U4' },
  { en: 'five', he: '5', cat: 'numbers', value: 5, unit: 'U4' },
  { en: 'six', he: '6', cat: 'numbers', value: 6, unit: 'U4', vowel: 'i' },
  { en: 'seven', he: '7', cat: 'numbers', value: 7, unit: 'U4' },
  { en: 'nine', he: '9', cat: 'numbers', value: 9, unit: 'U4' },
  { en: 'ten', he: '10', cat: 'numbers', value: 10, unit: 'U1', vowel: 'e' },
  { en: 'big', he: 'גדול', cat: 'adjectives', unit: 'U3', vowel: 'i' },
  { en: 'long', he: 'ארוך', cat: 'adjectives', unit: 'U3' },
  { en: 'small', he: 'קטן', cat: 'adjectives', unit: 'U3' },
  { en: 'tall', he: 'גבוה', cat: 'adjectives', unit: 'U3' },
  { en: 'fat', he: 'שמן', cat: 'adjectives', unit: 'U3', vowel: 'a' },
  { en: 'short', he: 'קצר / נמוך', cat: 'adjectives', unit: 'U3' },
  { en: 'good', he: 'טוב', cat: 'adjectives', unit: 'U3' },
  { en: 'sad', he: 'עצוב', cat: 'adjectives', unit: 'U7', vowel: 'a' },
  { en: 'mad', he: 'כועס', cat: 'adjectives', unit: 'U7', vowel: 'a' },
  { en: 'hot', he: 'חם', cat: 'adjectives', unit: 'U7', vowel: 'o' },
  { en: 'fun', he: 'כיף', cat: 'adjectives', unit: 'U7', vowel: 'u' },
];

// מילים שלא מתאימות לתרגילי תמונה/זיכרון (מילות פונקציה) - שימושיות רק במשפטים
export const FUNCTION_WORDS = ['I', 'see', 'have', 'need', 'want', 'my', 'a', 'the', 'is', 'has', 'and', 'too', 'this'];

export interface SentencePattern {
  id: string;
  pattern: string;
  he: string;
  slotCategories: string[];
  examples: string[];
}

export const SENTENCE_PATTERNS: SentencePattern[] = [
  { id: 'P1', pattern: 'I see a {thing}', he: 'אני רואה {thing}', slotCategories: ['school', 'home', 'things', 'animals', 'food', 'people'], examples: ['I see a bag.', 'I see a fox.'] },
  { id: 'P2', pattern: 'I have a {thing}', he: 'יש לי {thing}', slotCategories: ['school', 'home', 'things'], examples: ['I have a book.', 'I have a radio.'] },
  { id: 'P3', pattern: 'My {thing} is {color}', he: 'ה{thing} שלי {color}', slotCategories: ['school'], examples: ['My pen is yellow.'] },
  { id: 'P4', pattern: 'I need a {thing}', he: 'אני צריך {thing}', slotCategories: ['school', 'things'], examples: ['I need a hat.'] },
  { id: 'P5', pattern: 'I want a {thing}', he: 'אני רוצה {thing}', slotCategories: ['things', 'animals', 'food'], examples: ['I want a ball.'] },
  // רק animals/people בכוונה: שם תואר כמו fat/sad/mad/fun הגיוני על בעל-חיים/אדם,
  // אבל יוצר משפטים חסרי היגיון על חפצים (למשל "The hat is fat") - תוקן לפי משוב מהשטח
  { id: 'P6', pattern: 'The {thing} is {adjective}', he: 'ה{thing} {adjective}', slotCategories: ['animals', 'people'], examples: ['The dog is big.', 'The boy is tall.'] },
  { id: 'P7', pattern: 'The {thing} is {color}', he: 'ה{thing} {color}', slotCategories: ['school', 'home'], examples: ['The window is red.', 'The chair is pink.'] },
];

// מילים שמתחילות בתנועה - הילד עוד לא למד "an", לכן לא נשתמש בהן בתבניות "a ___"
export const A_AN_EXCEPTIONS = ['apple', 'orange', 'igloo'];

export interface StoryYesNo {
  q: string;
  a: 'YES' | 'NO';
}

export const STORY = {
  id: 'story_dan_tami',
  text: ['This is Dan.', 'Dan is a boy.', 'Dan is ten.', 'Dan has blue eyes and brown hair.', 'Dan has a yellow hat and a red bag.', 'Tami is a girl.', 'Tami is ten too.', 'Tami has a black cat.'],
  he: ['זה דן.', 'דן הוא ילד.', 'דן בן עשר.', 'לדן יש עיניים כחולות ושיער חום.', 'לדן יש כובע צהוב ותיק אדום.', 'תמי היא ילדה.', 'תמי גם בת עשר.', 'לתמי יש חתול שחור.'],
  yesNo: [
    { q: 'Dan is a man.', a: 'NO' },
    { q: 'Dan is seven.', a: 'NO' },
    { q: 'Dan has blue eyes.', a: 'YES' },
    { q: 'Tami has a cat.', a: 'YES' },
    { q: 'Tami is six.', a: 'NO' },
    { q: 'Dan has a red hat.', a: 'NO' },
  ] as StoryYesNo[],
  classifyWords: {
    'Colors': ['blue', 'brown', 'yellow', 'red', 'black'],
    'Numbers': ['ten'],
    'People': ['boy', 'girl'],
    'Body': ['eyes', 'hair'],
    'Things': ['hat', 'bag', 'cat'],
    'Names': ['Dan', 'Tami'],
  } as Record<string, string[]>,
};

export const CLASSIFY_CATEGORY_LABELS: Record<string, string> = {
  Colors: 'צבעים', Numbers: 'מספרים', People: 'אנשים', Body: 'גוף', Things: 'חפצים', Names: 'שמות',
};

// 52 שמות מ-Task 92. איות עברי הוא הצעה (לא אומת מול הדף - התא העברי ריק במחברת),
// קל לתקן אחר כך דרך הילד/ה אם יש טעות.
export const NAMES: [string, string][] = [
  ['Mali', 'מלי'], ['Nati', 'נתי'], ['Sarit', 'שרית'], ['Tami', 'תמי'], ['Linda', 'לינדה'], ['Libi', 'ליבי'], ['Loren', 'לורן'], ['Moti', 'מוטי'],
  ['Hila', 'הילה'], ['Tomer', 'תומר'], ['Toni', 'טוני'], ['Ori', 'אורי'], ['Oded', 'עודד'], ['Orit', 'אורית'], ['Gilad', 'גלעד'], ['Iris', 'איריס'],
  ['Nisim', 'נסים'], ['Idan', 'עידן'], ['Fani', 'פני'], ['Adir', 'אדיר'], ['Ron', 'רון'], ['Edna', 'עדנה'], ['Ronen', 'רונן'], ['Sagi', 'שגיא'],
  ['Noga', 'נוגה'], ['Orna', 'אורנה'], ['Rafi', 'רפי'], ['Lidor', 'לידור'], ['Noam', 'נועם'], ['Sapir', 'ספיר'], ['Agam', 'אגם'], ['Doron', 'דורון'],
  ['Liam', 'ליאם'], ['Or', 'אור'], ['Mor', 'מור'], ['Maor', 'מאור'], ['Ido', 'עידו'], ['Miri', 'מירי'], ['Eden', 'עדן'], ['Noa', 'נועה'],
  ['Liron', 'לירון'], ['Daniel', 'דניאל'], ['Didi', 'דידי'], ['Tali', 'טלי'], ['Eli', 'אלי'], ['Assaf', 'אסף'], ['Galit', 'גלית'], ['Harel', 'הראל'],
  ['Tahel', 'טהל'], ['Lian', 'ליאן'], ['Tamir', 'תמיר'], ['Liz', 'ליז'],
];

// חמש התנועות (Task 93) + 25 המילים הקצרות (CVC) שאומתו מול התמונה בפועל
export const VOWEL_GROUPS: Record<string, string[]> = {
  a: ['mad', 'cat', 'mat', 'bag', 'sad'],
  e: ['bed', 'pen', 'ten', 'hen', 'pet'],
  i: ['lit', 'big', 'sit', 'mix', 'six'],
  o: ['pot', 'fox', 'hot', 'dog', 'frog'],
  u: ['sun', 'run', 'fun', 'jump', 'bug'],
};
export const VOWEL_EXAMPLE_WORD: Record<string, { word: string; emoji: string }> = {
  a: { word: 'apple', emoji: '🍎' },
  e: { word: 'egg', emoji: '🥚' },
  i: { word: 'igloo', emoji: '🧊' },
  o: { word: 'orange', emoji: '🍊' },
  u: { word: 'umbrella', emoji: '☂️' },
};

// במקום לבקש מהילד לזהות אות אנגלית (a/e/i/o/u) - מה שדורש שכבר ידע אנגלית כדי
// לענות על שאלה שאמורה ללמד אנגלית - מציגים לו קבוצות צליל בעברית שהוא כבר מכיר,
// והוא בוחר לפי מה שהוא שומע. אושר עם ההורה: u נכנס תחת א (הצליל הקצר קרוב).
export const VOWEL_SOUND_GROUPS: Record<string, string[]> = {
  'א': ['a', 'u'],
  'אי': ['e', 'i'],
  'או': ['o'],
};

// Task 92 חלק 2: הבחנת צלילי f/p
export const FP_GROUPS = {
  f: ['fox', 'fish', 'fun', 'fix', 'fin', 'frog', 'fog', 'fat'],
  p: ['pen', 'pencil', 'pizza', 'panda', 'pig', 'pet', 'pot', 'pink', 'purple'],
};
