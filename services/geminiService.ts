
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractWordsFromInput = async (input: string | { data: string, mimeType: string }) => {
  const model = 'gemini-2.5-flash';
  
  const prompt = `
    You are analyzing a school English vocabulary worksheet or image.
    Your task: extract ONLY the vocabulary words that students need to learn — English words paired with their Hebrew translation.

    INCLUDE:
    - English words that appear in a vocabulary list, word bank, or glossary
    - English words that have a Hebrew translation written next to them (or vice versa)
    - Single English words or short phrases that are clearly vocabulary items

    DO NOT INCLUDE:
    - Page titles, unit titles, chapter names (e.g. "Unit 3", "My Family")
    - Exercise instructions or directions (e.g. "Write the word", "Match the words", "Circle the correct answer")
    - Sentence examples that demonstrate word usage
    - Names of people, cities, or schools
    - Numbers, dates, or punctuation alone
    - Words that appear only in context (inside a sentence) without a translation

    If a Hebrew translation is not visible in the image, use your knowledge to provide the correct Hebrew translation for elementary school level (ages 6–14).

    Return a JSON array with objects containing 'english' (the English word) and 'hebrew' (the Hebrew translation).
    If no vocabulary words are found, return an empty array [].
  `;

  let contents;
  if (typeof input === 'string') {
    contents = { parts: [{ text: input }, { text: prompt }] };
  } else {
    contents = {
      parts: [
        { inlineData: input },
        { text: prompt }
      ]
    };
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            hebrew: { type: Type.STRING }
          },
          required: ['english', 'hebrew']
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

interface RawGrammarExercise {
  sentence: string;
  options: string[];
  correctAnswer: string;
  hebrewHint?: string;
}

export const generateGrammarExercises = async (
  topicInput: string | { data: string; mimeType: string },
  childAge: number,
  existingWords: string[] = []
): Promise<{ displayNameHe: string; exercises: RawGrammarExercise[] }> => {
  const model = 'gemini-2.5-flash';

  const vocabHint = existingWords.length > 0
    ? `Where natural, reuse some of these familiar English words the child already knows: ${existingWords.slice(0, 30).join(', ')}.`
    : '';

  const isImage = typeof topicInput !== 'string';
  const topicDescription = isImage
    ? `Look at the attached photo of the child's notebook/worksheet page and FIRST figure out what specific English grammar point is being taught there (look at the page title, the examples, any underlined/highlighted/boxed words, and the exercise instructions). Base the whole exercise set on that identified grammar point.`
    : `The grammar point being studied in class right now is: "${topicInput}".`;

  const prompt = `
    You are creating English grammar practice exercises for a Hebrew-speaking elementary school child, age ${childAge}.

    ${topicDescription}

    First, normalize the grammar point into a short, clear Hebrew phrase (displayNameHe) describing what's being practiced (e.g. for "a/an" -> "a/an - תווית לא מיודעת", for "he/she/it" -> "he/she/it - כינויי גוף"). If it's identified from a photo, base displayNameHe on what you actually found on the page, in your own words.

    Then generate 15 varied fill-in-the-blank sentence exercises that practice EXACTLY this grammar point. Rules for each exercise:
    - The sentence must contain EXACTLY ONE blank, written as "___" (three underscores), replacing the word being practiced.
    - Provide 2 to 4 short answer options (single words only, e.g. "a" / "an", or "he" / "she" / "it"), where exactly one is correct.
    - Use simple vocabulary and short sentences (5-10 words) appropriate for a ${childAge}-year-old beginner.
    - Vary the nouns, subjects, and contexts across the 15 sentences so it doesn't feel repetitive.
    - Optionally include a short Hebrew hint (hebrewHint) translating the sentence, to help the child understand context.
    ${vocabHint}

    Return a JSON object with 'displayNameHe' (string) and 'exercises' (array of 15 items, each with 'sentence', 'options', 'correctAnswer', and optional 'hebrewHint'). If a photo was provided and you genuinely cannot tell what grammar point it covers, return an empty exercises array.
  `;

  const contents = isImage
    ? { parts: [{ inlineData: topicInput as { data: string; mimeType: string } }, { text: prompt }] }
    : { parts: [{ text: prompt }] };

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          displayNameHe: { type: Type.STRING },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sentence: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                hebrewHint: { type: Type.STRING }
              },
              required: ['sentence', 'options', 'correctAnswer']
            }
          }
        },
        required: ['displayNameHe', 'exercises']
      }
    }
  });

  const parsed = JSON.parse(response.text || '{"displayNameHe":"","exercises":[]}');

  // ולידציה בצד הלקוח: לא סומכים על הסכמה בלבד כדי להבטיח תרגילים תקינים
  const seenSentences = new Set<string>();
  const validExercises: RawGrammarExercise[] = (parsed.exercises || []).filter((ex: RawGrammarExercise) => {
    if (!ex.sentence || !ex.correctAnswer || !Array.isArray(ex.options) || ex.options.length < 2) return false;
    const blankCount = (ex.sentence.match(/___/g) || []).length;
    if (blankCount !== 1) return false;
    if (!ex.options.includes(ex.correctAnswer)) return false;
    const key = ex.sentence.trim().toLowerCase();
    if (seenSentences.has(key)) return false;
    seenSentences.add(key);
    return true;
  });

  return { displayNameHe: parsed.displayNameHe || (isImage ? 'מהמחברת' : topicInput as string), exercises: validExercises };
};

export const generateExampleSentence = async (englishWord: string, hebrewWord: string, childAge: number): Promise<{ sentence: string; hebrew: string } | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write ONE very simple example sentence in English using the word "${englishWord}" (Hebrew: "${hebrewWord}"), appropriate for a ${childAge}-year-old beginner Hebrew-speaking child learning English. Keep it short (4-8 words) and clear. Also give its Hebrew translation.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentence: { type: Type.STRING },
            hebrew: { type: Type.STRING }
          },
          required: ['sentence', 'hebrew']
        }
      }
    });
    const parsed = JSON.parse(response.text || 'null');
    if (!parsed?.sentence || !parsed?.hebrew) return null;
    return parsed;
  } catch (e) {
    return null;
  }
};
