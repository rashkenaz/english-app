
import React, { useState, useRef } from 'react';
import mammoth from 'mammoth';
import { extractWordsFromInput } from '../services/geminiService';

interface WordUploaderProps {
  onWordsAdded: (newWords: { english: string; hebrew: string }[]) => void;
}

export const WordUploader: React.FC<WordUploaderProps> = ({ onWordsAdded }) => {
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const MIME_BY_EXTENSION: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    heic: 'image/heic', heif: 'image/heif', gif: 'image/gif', bmp: 'image/bmp', pdf: 'application/pdf',
  };

  // בחלק מהדפדפנים/קבצים (למשל HEIC מאייפון) ה-file.type מגיע ריק - אז מנחשים לפי סיומת,
  // כי ג'מיני דוחה בקשה עם mimeType ריק.
  const resolveMimeType = (file: File): string => {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return (ext && MIME_BY_EXTENSION[ext]) || 'image/jpeg';
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    try {
      const words = await extractWordsFromInput(textInput);
      onWordsAdded(words);
      setTextInput('');
    } catch (error) {
      alert('אופס! משהו השתבש בניתוח הטקסט.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      let words;
      const isWord = file.name.endsWith('.docx') || file.name.endsWith('.doc') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword';

      if (isWord) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (!result.value.trim()) throw new Error('הקובץ ריק');
        words = await extractWordsFromInput(result.value);
      } else {
        const base64Data = await blobToBase64(file);
        words = await extractWordsFromInput({ data: base64Data, mimeType: resolveMimeType(file) });
      }

      onWordsAdded(words);
    } catch (error: any) {
      console.error(error);
      alert('לא הצלחנו לקרוא את המילים מהקובץ.\n' + (error?.message || 'נסה שוב!'));
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAudioExtract = async () => {
    if (!recordedBlob) return;
    setLoading(true);
    try {
      const base64Data = await blobToBase64(recordedBlob);
      const words = await extractWordsFromInput({
        data: base64Data,
        mimeType: 'audio/webm'
      });
      onWordsAdded(words);
      setAudioUrl(null);
      setRecordedBlob(null);
    } catch (error) {
      alert('הקול לא היה ברור מספיק. נסו להקליט שוב!');
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          setRecordedBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        };
        mediaRecorder.start();
        setRecording(true);
      } catch (err) { 
        alert('גישה למיקרופון נדחתה! בדקו את ההגדרות.'); 
      }
    }
  };

  return (
    <div className="glass-panel p-8 rounded-[40px] shadow-2xl relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 shimmer-card opacity-5 pointer-events-none" />
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-3xl gaming-font text-white drop-shadow-md">מעבדת מילים 🧪</h2>
        <span className="bg-white text-sky-600 text-[10px] font-black px-2 py-1 rounded-full">חדש!</span>
      </div>

      <div className="space-y-6 relative z-10">
        <div className="space-y-3">
          <textarea
            className="w-full p-5 bg-black/20 border-2 border-white/20 rounded-3xl focus:border-sky-400 outline-none transition-all text-slate-100 text-lg shadow-inner"
            placeholder="הדביקו מילים לתרגום..."
            rows={2}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={handleTextSubmit}
            disabled={loading || !textInput.trim()}
            className="roblox-btn w-full bg-sky-500 border-sky-700 text-white py-4 text-xl glow-cyan flex items-center justify-center gap-2"
          >
            {loading ? <span className="animate-spin text-2xl">🌀</span> : <span>✨</span>}
            {loading ? 'מנתח טקסט...' : 'סרוק טקסט'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={toggleRecording}
            disabled={loading}
            className={`roblox-btn flex flex-col items-center justify-center p-6 transition-all ${
              recording ? 'bg-red-500 border-red-700 animate-pulse' : 'bg-white/10 border-black/20'
            } text-white`}
          >
            <span className="text-4xl mb-2">{recording ? '⏹️' : '🎤'}</span>
            <span className="text-xs font-black tracking-tight">{recording ? 'עצור' : 'הקלט'}</span>
          </button>

          <label className={`roblox-btn flex flex-col items-center justify-center p-6 bg-white/10 border-black/20 cursor-pointer text-white ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            <span className="text-4xl mb-2">📸</span>
            <span className="text-xs font-black tracking-tight">תמונה / PDF / Word</span>
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {audioUrl && !recording && (
          <div className="p-5 glass-panel rounded-3xl animate-slide-in flex flex-col gap-4">
            <audio src={audioUrl} controls className="w-full h-10" />
            <button
              onClick={handleAudioExtract}
              disabled={loading}
              className="roblox-btn w-full bg-purple-500 border-purple-700 text-white py-3 text-lg flex items-center justify-center gap-2"
            >
              {loading ? <span className="animate-spin">🌀</span> : 'חלץ מילים מהקול ✨'}
            </button>
          </div>
        )}

        {loading && !audioUrl && (
          <div className="flex flex-col items-center gap-2 animate-pulse">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
              <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            </div>
            <span className="text-sky-300 text-xs font-bold">מנתח את המידע...</span>
          </div>
        )}
      </div>
    </div>
  );
};
