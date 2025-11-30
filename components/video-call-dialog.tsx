'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Camera, CameraOff } from 'lucide-react';

// Если у тебя уже есть типы для сообщений — можешь удалить этот интерфейс
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
}

interface VideoAssistantProps {
  isOpen: boolean;
  onClose: () => void;

  // язык интерфейса / речи, можно пробросить 'uk' | 'ru' | 'en'
  language?: 'uk' | 'ru' | 'en';

  // опционально: id пользователя для n8n
  userId?: string;

  // URL вебхука n8n; если у тебя уже есть ready-функция, просто проигнорируй это и вставь свою реализацию в sendToAssistant
  n8nEndpoint?: string;
}

type SpeechRecognitionLike = any;

const resolveRecognitionLang = (lang?: 'uk' | 'ru' | 'en'): string => {
  switch (lang) {
    case 'uk':
      return 'uk-UA';
    case 'ru':
      return 'ru-RU';
    default:
      return 'en-US';
  }
};

const resolveUiLangLabel = (lang?: 'uk' | 'ru' | 'en'): string => {
  switch (lang) {
    case 'uk':
      return 'Українська';
    case 'ru':
      return 'Русский';
    default:
      return 'English';
  }
};

const INITIAL_GREETING =
  'Hello! How are you feeling today? Is there anything specific you would like to talk about or explore together?';

const AiPsychologistVideoCall: React.FC<VideoAssistantProps> = ({
  isOpen,
  onClose,
  language = 'en',
  userId = 'guest@example.com',
  n8nEndpoint,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'greeting-1',
      role: 'assistant',
      text: INITIAL_GREETING,
      createdAt: Date.now(),
    },
  ]);

  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);

  const [assistantVoice, setAssistantVoice] = useState<SpeechSynthesisVoice | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // ---------- SPEECH SYNTHESIS (браузерный голос, как в голосовом ассистенте) ----------

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      const targetLang = resolveRecognitionLang(language).slice(0, 2); // 'en', 'uk', 'ru'

      // пробуем подобрать женский голос на нужном языке
      const preferred =
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith(targetLang) &&
            v.name.toLowerCase().includes('female'),
        ) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(targetLang)) ||
        voices[0];

      setAssistantVoice(preferred);
    };

    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;

    return () => {
      if (window.speechSynthesis.onvoiceschanged === pickVoice) {
        // @ts-ignore
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [language]);

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      if (isMuted) return;

      // на время озвучки — не слушаем микрофон, чтобы ассистент не слышал сам себя
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      setIsAssistantSpeaking(true);

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = resolveRecognitionLang(language);
      if (assistantVoice) {
        utterance.voice = assistantVoice;
      }

      utterance.onend = () => {
        setIsAssistantSpeaking(false);
        // пользователь сам снова жмёт на микрофон, авто-перезапуска нет
      };

      window.speechSynthesis.speak(utterance);
    },
    [assistantVoice, isMuted, language],
  );

  // ---------- SPEECH RECOGNITION (Web Speech API) ----------

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // @ts-ignore
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn('SpeechRecognition API is not available in this browser');
      return;
    }

    const recognition = new SR();
    recognition.lang = resolveRecognitionLang(language);
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(' ')
        .trim();

      if (!transcript) return;

      // каждое распознанное высказывание — отдельное сообщение
      handleUserTranscript(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      // просто фиксим состояние, чтобы второй раз тоже можно было включить микрофон
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]); // пересоздаём при смене языка

  const toggleMic = () => {
    if (!recognitionRef.current) {
      return;
    }

    // нельзя говорить, пока ассистент сам говорит — иначе он слушает себя
    if (isAssistantSpeaking) {
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      setIsMicOn(false);
    } else {
      recognitionRef.current.lang = resolveRecognitionLang(language);
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setIsMicOn(true);
      } catch {
        // иногда баг браузера "start called twice" — просто игнорим
      }
    }
  };

  const toggleCamera = () => {
    setIsCameraOn((prev) => !prev);
    // Если у тебя уже есть реализация getUserMedia — можешь здесь
    // включать/выключать трек камеры. Сейчас это чисто UI-переключатель.
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (!isMuted) {
      // если только что выключили звук — останавливаем текущую озвучку
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  };

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // автоскролл только внутри блока чата, модалка сама по себе не скроллится вверх,
  // так что при открытии видно в основном видео
  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  // ---------- ОТПРАВКА В N8N / ассистент ----------

  const sendToAssistant = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const endpoint =
        n8nEndpoint ||
        process.env.NEXT_PUBLIC_TURBOTA_PSYCHOLOGIST_WEBHOOK ||
        'https://YOUR-N8N-DOMAIN/webhook/turbotaai-agent';

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: {
              user: userId,
              text,
              body: {
                language,
                query: text,
              },
            },
          }),
        });

        const data = await res.json();

        // здесь подстрой структуру под свой н8n-ответ если нужно
        const assistantText =
          data?.data?.answer ||
          data?.answer ||
          data?.result ||
          data?.[0]?.json?.answer ||
          data?.[0]?.json?.result ||
          '';

        if (!assistantText) return;

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: assistantText,
          createdAt: Date.now(),
        };

        addMessage(assistantMessage);
        speakText(assistantText);
      } catch (error) {
        console.error('Error sending to assistant', error);
      }
    },
    [addMessage, language, speakText, userId, n8nEndpoint],
  );

  const handleUserTranscript = useCallback(
    (text: string) => {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text,
        createdAt: Date.now(),
      };

      addMessage(userMessage);
      sendToAssistant(text);
    },
    [addMessage, sendToAssistant],
  );

  // ---------- Локальная камера (мини-окно в углу) ----------

  useEffect(() => {
    if (!isOpen || !isCameraOn) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

    let stream: MediaStream | null = null;

    const enableCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Cannot access camera', err);
      }
    };

    enableCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (localVideoRef.current) {
        (localVideoRef.current as any).srcObject = null;
      }
    };
  }, [isOpen, isCameraOn]);

  if (!isOpen) return null;

  const langLabel = resolveUiLangLabel(language);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-slate-950 text-slate-50 shadow-2xl border border-slate-800">
        {/* HEADER */}
        <div className="flex items-center justify-between rounded-t-3xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              {/* иконка волны / сигнал */}
              <span className="h-4 w-4 rounded-full border border-white/70 border-dashed" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">AI Psychologist Video Call</span>
              <span className="text-xs text-white/80">
                Video session · {langLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
              TurbotaAI · Video assistant online
            </span>
            <button
              onClick={onClose}
              className="rounded-full bg-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/30 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="px-6 pb-6 pt-4">
          {/* ВИДЕО-БЛОК — делаем выше, без чёрных полос, object-cover */}
          <div className="relative w-full overflow-hidden rounded-3xl bg-black aspect-[16/9] min-h-[60vh]">
            {/* Видео/аватар ассистента (сюда поставь свой mp4 или stream) */}
            <video
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              // сюда свой src, сейчас просто заглушка
              src="/video/psychologist-sophia.mp4"
            />

            {/* мини-окно пользователя внизу справа */}
            {isCameraOn && (
              <div className="pointer-events-none absolute bottom-4 right-4 h-32 w-40 overflow-hidden rounded-2xl border border-white/30 bg-black/40">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* бейдж Listening Mode внизу слева */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-slate-50">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/90 text-[10px]">
                🎧
              </span>
              <span>
                {isAssistantSpeaking
                  ? 'Assistant is speaking...'
                  : isListening
                  ? 'Listening mode'
                  : 'Tap the mic to speak'}
              </span>
            </div>
          </div>

          {/* ПАНЕЛЬ УПРАВЛЕНИЯ — закреплена сразу под видео, всегда видна */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-4">
              {/* Mic */}
              <button
                onClick={toggleMic}
                className={`flex h-12 w-12 items-center justify-center rounded-full text-slate-50 transition shadow-lg shadow-emerald-500/20 ${
                  isListening
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>

              {/* Camera */}
              <button
                onClick={toggleCamera}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-50 transition hover:bg-slate-700 shadow-lg shadow-slate-900/40"
              >
                {isCameraOn ? (
                  <Camera className="h-5 w-5" />
                ) : (
                  <CameraOff className="h-5 w-5" />
                )}
              </button>

              {/* Mute */}
              <button
                onClick={toggleMute}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-50 transition hover:bg-slate-700 shadow-lg shadow-slate-900/40"
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>

              {/* Hang up */}
              <button
                onClick={onClose}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400 shadow-lg shadow-red-500/40"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>

            {/* ОДИН статус (без дублей в шапке и над аватаром) */}
            <div className="text-xs text-slate-400">
              {isAssistantSpeaking
                ? 'Assistant is speaking. Please wait.'
                : isListening
                ? 'Listening… you can speak.'
                : 'Tap the microphone to start speaking.'}
            </div>
          </div>

          {/* ЧАТ — ниже, появляется только при скролле вниз */}
          <div className="mt-8">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Conversation history
            </div>
            <div
              ref={chatRef}
              className="max-h-[40vh] w-full overflow-y-auto rounded-2xl bg-slate-900/60 p-3 border border-slate-800"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-3 flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                      msg.role === 'user'
                        ? 'bg-indigo-500/90 text-white rounded-br-sm'
                        : 'bg-emerald-900/60 text-emerald-50 rounded-bl-sm'
                    }`}
                  >
                    <div className="mb-1 text-[10px] font-semibold opacity-70">
                      {msg.role === 'user' ? 'You said' : 'Dr. Sophia'}
                    </div>
                    <div>{msg.text}</div>
                  </div>
                </div>
              ))}

              {messages.length === 0 && (
                <div className="text-xs text-slate-500">No messages yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiPsychologistVideoCall;
