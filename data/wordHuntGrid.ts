// יצירת גריד חיפוש-מילים (Word Hunt) - פונקציה טהורה כדי שאפשר לבדוק אותה
// בבדיקת שפיות נפרדת (node) בלי להריץ את כל האפליקציה.
// במכוון: רק אופקי (שמאל-ימין) ואנכי (מלמעלה-למטה), בלי אלכסונים ובלי הפוך -
// ילד שלומד לקרוא אנגלית לא צריך לקרוא הפוך, וזה גם מצמצם את מרחב החיפוש.

export interface WordPlacement {
  word: string;
  cells: [number, number][]; // [row, col] לפי סדר האותיות במילה
}

export interface WordHuntGrid {
  grid: string[][];
  placements: WordPlacement[];
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateWordHuntGrid(words: string[], size = 8): WordHuntGrid {
  const candidates = [...new Set(words.map(w => w.toUpperCase()))]
    .filter(w => w.length >= 2 && w.length <= size)
    .sort((a, b) => b.length - a.length);

  for (let attempt = 0; attempt < 20; attempt++) {
    const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    const placements: WordPlacement[] = [];
    let allPlaced = true;

    for (const word of candidates) {
      let placed = false;
      for (let t = 0; t < 50 && !placed; t++) {
        const horizontal = Math.random() < 0.5;
        const row = Math.floor(Math.random() * (horizontal ? size : size - word.length + 1));
        const col = Math.floor(Math.random() * (horizontal ? size - word.length + 1 : size));
        const cells: [number, number][] = [];
        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const r = horizontal ? row : row + i;
          const c = horizontal ? col + i : col;
          const existing = grid[r][c];
          if (existing !== null && existing !== word[i]) { fits = false; break; }
          cells.push([r, c]);
        }
        if (fits) {
          cells.forEach(([r, c], i) => { grid[r][c] = word[i]; });
          placements.push({ word, cells });
          placed = true;
        }
      }
      if (!placed) { allPlaced = false; break; }
    }

    if (allPlaced) {
      const filled = grid.map(row => row.map(cell => cell ?? ALPHABET[Math.floor(Math.random() * 26)]));
      return { grid: filled, placements };
    }
  }

  // לא הצליח להשים את כל המילים ב-20 ניסיונות - מפילים את המילה הכי קשה להשמה
  // (הכי ארוכה, בראש הרשימה הממוינת) וממשיכים עם פחות מילים, במקום להיתקע.
  if (candidates.length > 1) return generateWordHuntGrid(candidates.slice(1), size);

  const filled = Array.from({ length: size }, () => Array.from({ length: size }, () => ALPHABET[Math.floor(Math.random() * 26)]));
  return { grid: filled, placements: [] };
}
