import React, { useEffect, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type VideoAssistantModalProps = {
  isOpen: boolean;
  onClose: () => void;
  // язык можно прокинуть пропсом при необходимости
  languageCode?: string; // "en", "uk", "ru" и т.д.
  languageLabel?: string; // "English", "Українська" и т.п.
  flagEmoji?: string; // "🇬🇧", "🇺🇦" и т.п.
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

const INITIAL_GREETING =
  "Hello! How are you feeling today? If there's anything you'd like to talk about or any topic on your mind, feel free to share.";

export const VideoAssistantModal: React.FC<VideoAssistantModalProps> = ({
  isOpen,
  onClose,
  languageCode = "en",
  languageLabel = "English",
  flagEmoji = "🇬🇧",
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: INITIAL_GREETING,
    },
  ]);

  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [micEnabled, setMicEnabled] = useState<boolean>(true);
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(true);
  const [cameraEnabled, setCameraEnabled] = useState<boolean>(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Прокрутка чата вниз при новом сообщении
  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages]);

  // Инициализация камеры при открытии
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined" || !navigator.mediaDevices) return;

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    setupCamera();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [isOpen]);

  // Инициализация SpeechRecognition
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined") return;
    if (recognitionRef.current) return;

    const SRConstructor =
      (window.SpeechRecognition ||
        window.webkitSpeechRecognition) as typeof SpeechRecognition;

    if (!SRConstructor) {
      console.warn("SpeechRecognition is not supported in this browser.");
      return;
    }

    const recognition = new SRConstructor();
    recognition.lang = languageCode === "uk" ? "uk-UA" : languageCode === "ru" ? "ru-RU" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Если модалка ещё открыта, микрофон включен и ассистент сейчас не говорит — запускаем снова
      if (isOpen && micEnabled && !isSpeaking) {
        try {
          recognition.start();
        } catch {
          /* ignore */
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("SpeechRecognition error:", event);
      setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!micEnabled) return;

      const result = event.results[0];
      const transcript = result[0]?.transcript?.trim();
      if (!transcript) return;

      // Добавляем сообщение пользователя отдельным сообщением
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: transcript,
      };
      setMessages((prev) => [...prev, userMessage]);

      // Останавливаем слушание — ждём ответ ассистента
      recognition.stop();
      setIsListening(false);

      // Отправляем запрос ассистенту
      void handleAssistantResponse(transcript);
    };

    recognitionRef.current = recognition;

    // Стартуем первый раз
    if (micEnabled && !isSpeaking) {
      try {
        recognition.start();
      } catch {
        /* ignore */
      }
    }

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, micEnabled, languageCode]);

  // Озвучка текста браузерным TTS
  const speakText = (text: string) => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    if (!speakerEnabled) return;

    // Пока ассистент говорит — не слушаем
    setIsSpeaking(true);
    setIsListening(false);

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang =
      languageCode === "uk" ? "uk-UA" : languageCode === "ru" ? "ru-RU" : "en-US";

    utterance.onend = () => {
      setIsSpeaking(false);
      // После ответа ассистента снова включаем распознавание
      if (recognitionRef.current && micEnabled && isOpen) {
        try {
          recognitionRef.current.start();
        } catch {
          /* ignore */
        }
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      if (recognitionRef.current && micEnabled && isOpen) {
        try {
          recognitionRef.current.start();
        } catch {
          /* ignore */
        }
      }
    };

    synth.speak(utterance);
  };

  // Ответ ассистента (вместо Google Cloud и т.п. — используем тот же API, что и голосовой ассистент)
  const handleAssistantResponse = async (userText: string) => {
    try {
      // Замените URL и payload на тот же, что используется в голосовом ассистенте
      const res = await fetch("/api/psychologist-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: messages.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });

      const data = await res.json();
      const replyText: string =
        data?.reply || data?.message || data?.content || "I’m here with you.";

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: replyText,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Озвучиваем ответ ассистента (и только его, чтобы не ловить "самого себя")
      speakText(replyText);
    } catch (err) {
      console.error("Assistant request error:", err);
    }
  };

  const handleMicToggle = () => {
    setMicEnabled((prev) => {
      const next = !prev;

      if (!next) {
        // Выключаем микрофон
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        setIsListening(false);
      } else {
        // Включаем микрофон
        if (recognitionRef.current && !isSpeaking && isOpen) {
          try {
            recognitionRef.current.start();
          } catch {
            /* ignore */
          }
        }
      }

      return next;
    });
  };

  const handleSpeakerToggle = () => {
    setSpeakerEnabled((prev) => {
      const next = !prev;
      if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const handleCameraToggle = () => {
    setCameraEnabled((prev) => {
      const next = !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = next;
        });
      }
      return next;
    });
  };

  const handleHangUp = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setIsSpeaking(false);
    onClose();
  };

  if (!isOpen) return null;

  const bottomStatus = isSpeaking
    ? "Assistant is responding..."
    : micEnabled
    ? "Listening... you can speak."
    : "Microphone is muted.";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-slate-950 text-slate-50 shadow-2xl">
        {/* ШАПКА */}
        <div className="flex items-center justify-between bg-gradient-to-r from-violet-500 via-sky-500 to-cyan-400 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <span className="text-lg">📹</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                AI Psychologist Video Call
              </span>
              <span className="text-xs opacity-85">
                Video session in {languageLabel} · {flagEmoji}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-emerald-200/60 bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-50">
              <span className="mr-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Video assistant online
            </span>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm hover:bg-white/25"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <div className="flex flex-1 flex-col bg-slate-950/95 lg:flex-row">
          {/* ВИДЕО/АВАТАР */}
          <div className="flex flex-1 items-center justify-center bg-slate-900">
            <div className="relative h-full w-full max-h-full max-w-full">
              <img
                src="/img/video-assistant/sophia.jpg"
                alt="Dr. Sophia"
                className="h-full w-full object-cover"
              />

              {/* Превью пользователя в углу */}
              <div className="absolute bottom-4 right-4 h-28 w-40 overflow-hidden rounded-2xl border border-white/15 bg-black/70">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`h-full w-full object-cover ${
                    cameraEnabled ? "" : "opacity-20"
                  }`}
                />
                {!cameraEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-200">
                    Camera off
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ЧАТ */}
          <div className="flex w-full max-w-md flex-col border-t border-slate-800/80 bg-slate-950/95 lg:border-l lg:border-t-0">
            <div
              ref={chatScrollRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-3"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      msg.role === "user"
                        ? "rounded-br-md bg-violet-500 text-white"
                        : "rounded-bl-md bg-slate-800 text-slate-50"
                    }`}
                  >
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {msg.role === "user" ? "You said" : "Dr. Sophia"}
                    </div>
                    <div className="whitespace-pre-line">{msg.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Единственный статус */}
            <div className="flex items-center gap-2 border-t border-slate-800 px-4 py-2 text-xs text-slate-400">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  isSpeaking
                    ? "bg-amber-400"
                    : micEnabled
                    ? "bg-emerald-400"
                    : "bg-slate-500"
                }`}
              />
              <span>{bottomStatus}</span>
            </div>
          </div>
        </div>

        {/* НИЖНЯЯ ПАНЕЛЬ КНОПОК */}
        <div className="flex items-center justify-center gap-6 border-t border-slate-800 bg-slate-950/98 px-6 py-4">
          {/* МИКРОФОН */}
          <button
            onClick={handleMicToggle}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-md transition ${
              micEnabled
                ? "bg-emerald-500 text-white hover:bg-emerald-400"
                : "bg-slate-700 text-slate-200 hover:bg-slate-600"
            }`}
          >
            {micEnabled ? "🎙" : "🔇"}
          </button>

          {/* КАМЕРА */}
          <button
            onClick={handleCameraToggle}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-md transition ${
              cameraEnabled
                ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {cameraEnabled ? "📷" : "🚫"}
          </button>

          {/* ГРОМКОГОВОРИТЕЛЬ */}
          <button
            onClick={handleSpeakerToggle}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-md transition ${
              speakerEnabled
                ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {speakerEnabled ? "🔊" : "🔈"}
          </button>

          {/* ЗАВЕРШИТЬ ЗВОНОК */}
          <button
            onClick={handleHangUp}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-lg text-white shadow-md transition hover:bg-red-400"
          >
            📞
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoAssistantModal;
