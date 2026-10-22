export interface Character {
  id: string;
  name: string;
  img: string;
}

// תמונות מקור: "cartoon game character/" (6 קבצים, ~2.5MB כל אחד) - נדחסו
// ל-public/characters/*.jpg (480x480, ~35-45KB) כדי לא להכביד על הטעינה בנייד.
export const CHARACTERS: Character[] = [
  { id: 'mia', name: 'Mia', img: '/characters/mia.jpg' },
  { id: 'leo', name: 'Leo', img: '/characters/leo.jpg' },
  { id: 'max', name: 'Max', img: '/characters/max.jpg' },
  { id: 'zoe', name: 'Zoe', img: '/characters/zoe.jpg' },
  { id: 'ava', name: 'Ava', img: '/characters/ava.jpg' },
  { id: 'theo', name: 'Theo', img: '/characters/theo.jpg' },
];
