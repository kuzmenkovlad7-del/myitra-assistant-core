"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  X,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
// подстрой эти хуки под свой проект, если пути отличаются
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

type MessageRole = "user" | "assistant";

interface ChatMessage {
  id: number;
  role: MessageRole;
  text: string;
}

interface VideoCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * URL твоего n8n / backend-вебхука.
   * Он должен принимать JSON { message, language, userEmail } и
   * возвращать либо { reply: string }, либо текст.
   */
  webhookUrl?: string;
  onError?: (message: string) => void;
}

const ASSISTANT_NAME = "Dr. Sophia";
const ASSISTANT_TITLE = "AI psychologist";

function getSpeechLang(languageCode?: string): string {
  switch (languageCode) {
    case "uk":
    case "uk-UA":
      return "uk-UA";
    case "ru":
    case "ru-RU":
      return "ru-RU";
    default:
      return "en-US";
  }
}

function cleanResponseText(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();

  // Если backend вернул JSON со свойством reply
  try {
    if (text.startsWith("{") || text.startsWith("[")) {
      const parsed = JSON.parse(text);
      if (typeof parsed?.reply === "string") {
        text = parsed.reply;
      } else if (typeof parsed?.message === "string") {
        text = parsed.message;
      }
    }
  } catch {
    // игнорируем ошибку парсинга и работаем с обычным текстом
  }

  // Убираем markdown-жирный и лишние переносы
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");
  text = text.replace(/\n{2,}/g, "\n").trim();

  return text;
}

export function VideoCallDialog({
  isOpen,
  onClose,
  webhookUrl,
  onError,
}: VideoCallDialogProps) {
  const { currentLanguage } = useLanguage();
  const { user } = useAuth();

  const [isCallActive, setIsCallActive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastUserText, setLastUserText] = useState("");
  const [lastAssistantResponse, setLastAssistantResponse] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>(
    "Нажми на микрофон, чтобы начать говорить."
  );

  const recognitionRef = useRef<any | null>(null);
  const autoRestartRecognitionRef = useRef(true);
  const isAiSpeakingRef = useRef(false);
  const isCallActiveRef = useRef(false);
  const isMicMutedRef = useRef(true);
  const messageIdRef = useRef(1);
  const lastFinalTextRef = useRef<string>("");

  // следим, чтобы асинхронные callbacks знали актуальное состояние
  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // При открытии модалки начинаем с приветствия ассистента
  useEffect(() => {
    if (!isOpen) {
      stopAllAudio();
      resetState();
      return;
    }

    setIsCallActive(true);
    setIsMicMuted(true); // микрофон по умолчанию выключен

    const greeting =
      "Hello! How are you doing today? If there's anything you'd like to talk about or any topic on your mind, feel free to share.";
    const firstMessage: ChatMessage = {
      id: messageIdRef.current++,
      role: "assistant",
      text: greeting,
    };

    setMessages([firstMessage]);
    setLastAssistantResponse(greeting);
    setStatusMessage("Ассистент говорит. Подожди, пожалуйста…");
    speakText(greeting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAllAudio() {
    try {
      if (recognitionRef.current) {
        autoRestartRecognitionRef.current = false;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } catch {
      // ignore
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsListening(false);
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
  }

  function resetState() {
    setIsCallActive(false);
    setIsMicMuted(true);
    setMessages([]);
    setInterimTranscript("");
    setLastUserText("");
    setLastAssistantResponse("");
    setStatusMessage("Нажми на микрофон, чтобы начать говорить.");
    lastFinalTextRef.current = "";
    messageIdRef.current = 1;
  }

  function handleClose() {
    stopAllAudio();
    resetState();
    onClose();
  }

  function toggleSound() {
    setIsSoundEnabled((prev) => !prev);
  }

  function startRecognition() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusMessage(
        "Браузер не поддерживает распознавание речи. Попробуй Chrome или Edge."
      );
      return;
    }

    // Останавливаем предыдущий инстанс, если вдруг остался
    try {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      }
    } catch {
      // ignore
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getSpeechLang(currentLanguage?.code);

    recognition.onstart = () => {
      setIsListening(true);
      setStatusMessage("Слушаю… можешь говорить.");
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        // пользователь молчал — просто выключаем микрофон
        autoRestartRecognitionRef.current = false;
        setIsListening(false);
        setIsMicMuted(true);
        setStatusMessage("Микрофон выключен. Включи его, чтобы говорить.");
        return;
      }

      setIsListening(false);
      setStatusMessage("Ошибка микрофона. Попробуй ещё раз.");
      setIsMicMuted(true);
      if (onError) {
        onError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);

      if (!autoRestartRecognitionRef.current) {
        autoRestartRecognitionRef.current = true;
        return;
      }

      // Авто-перезапуск, если звонок ещё идёт, микрофон включен
      // и ассистент сейчас не говорит
      if (
        isCallActiveRef.current &&
        !isMicMutedRef.current &&
        !isAiSpeakingRef.current
      ) {
        try {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }, 250);
        } catch {
          // ignore
        }
      }
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;

        if (result.isFinal) {
          // фильтр от повторов и артефактов
          if (
            !text ||
            text === lastFinalTextRef.current ||
            text.length < 2
          ) {
            continue;
          }

          lastFinalTextRef.current = text;
          setInterimTranscript("");
          setLastUserText(text);
          handleUserText(text);
        } else {
          interim += text + " ";
        }
      }

      setInterimTranscript(interim.trim());
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (error) {
      setIsListening(false);
      setIsMicMuted(true);
      setStatusMessage("Не удалось запустить микрофон.");
      if (onError) {
        onError("Failed to start speech recognition");
      }
    }
  }

  function speakText(text: string) {
    if (!text || !text.trim()) return;
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    if (!isSoundEnabled) return;

    const synth = window.speechSynthesis;
    try {
      synth.cancel();
    } catch {
      // ignore
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLang(currentLanguage?.code);
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsAiSpeaking(true);
      isAiSpeakingRef.current = true;
      setStatusMessage("Ассистент говорит. Подожди, пожалуйста…");

      // На время речи ассистента глушим распознавание,
      // чтобы он не «слушал сам себя».
      try {
        if (recognitionRef.current) {
          autoRestartRecognitionRef.current = false;
          recognitionRef.current.stop();
        }
      } catch {
        // ignore
      }
    };

    utterance.onend = () => {
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;

      if (!isCallActiveRef.current) return;
      if (isMicMutedRef.current) {
        setStatusMessage("Микрофон выключен. Включи его, чтобы говорить.");
        return;
      }

      setStatusMessage("Слушаю… можешь говорить.");
      startRecognition();
    };

    utterance.onerror = () => {
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      setStatusMessage("Ошибка при озвучивании ответа.");
    };

    try {
      synth.speak(utterance);
    } catch {
      // ignore
    }
  }

  async function handleUserText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const myMessage: ChatMessage = {
      id: messageIdRef.current++,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, myMessage]);

    setStatusMessage("Ассистент думает…");

    try {
      let replyText = "";

      if (!webhookUrl) {
        // fallback на случай, если вебхук ещё не настроен
        replyText = `You said: ${trimmed}`;
      } else {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmed,
            language: currentLanguage?.code ?? "en",
            userEmail: user?.email ?? null,
            assistant: ASSISTANT_NAME,
            source: "video_call",
          }),
        });

        if (!response.ok) {
          throw new Error(`Bad response: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          replyText =
            data.reply ||
            data.message ||
            data.text ||
            JSON.stringify(data, null, 2);
        } else {
          replyText = await response.text();
        }
      }

      const cleaned = cleanResponseText(replyText);
      if (!cleaned) {
        setStatusMessage("Ассистент не смог сформулировать ответ.");
        return;
      }

      const assistantMessage: ChatMessage = {
        id: messageIdRef.current++,
        role: "assistant",
        text: cleaned,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setLastAssistantResponse(cleaned);
      speakText(cleaned);
    } catch (error: any) {
      console.error("Video assistant error:", error);
      setStatusMessage("Произошла ошибка. Попробуй сказать ещё раз.");
      if (onError) {
        onError("Video assistant backend error");
      }
    }
  }

  function toggleMic() {
    // выключаем микрофон
    if (!isCallActive) return;

    if (!isMicMuted) {
      setIsMicMuted(true);
      setIsListening(false);
      setStatusMessage("Микрофон выключен. Включи его, чтобы говорить.");
      autoRestartRecognitionRef.current = false;
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      } catch {
        // ignore
      }
      return;
    }

    // включаем микрофон
    setIsMicMuted(false);
    setStatusMessage("Слушаю… можешь говорить.");
    autoRestartRecognitionRef.current = true;
    startRecognition();
  }

  // Единое место, где рисуем статус
  useEffect(() => {
    if (!isCallActive) {
      setStatusMessage("Нажми на микрофон, чтобы начать говорить.");
      return;
    }

    if (isAiSpeaking) {
      setStatusMessage("Ассистент говорит. Подожди, пожалуйста…");
      return;
    }

    if (isMicMuted) {
      setStatusMessage("Микрофон выключен. Включи его, чтобы говорить.");
      return;
    }

    if (isListening) {
      setStatusMessage("Слушаю… можешь говорить.");
      return;
    }
  }, [isCallActive, isAiSpeaking, isMicMuted, isListening]);

  if (!isOpen) return null;

  const languageLabel =
    currentLanguage?.label ||
    currentLanguage?.name ||
    "English";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2 py-4 md:px-4">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-indigo-500/25 via-indigo-500/10 to-transparent px-4 py-3">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-200">
              AI Psychologist Video Call
            </span>
            <span className="mt-1 text-xs text-slate-300">
              Language:{" "}
              <span className="font-medium text-slate-50">
                {languageLabel}
              </span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-300 hover:bg-slate-800"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col md:flex-row">
          {/* Left: видео / аватар ассистента */}
          <div className="flex-1 border-b border-slate-800 bg-black md:border-b-0 md:border-r">
            <div className="relative h-64 w-full md:h-full">
              <Image
                src="/images/ai-psychologist.jpg"
                alt={ASSISTANT_NAME}
                fill
                className="object-cover"
                priority
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-indigo-400/60 bg-slate-900/80">
                    <Image
                      src="/images/ai-psychologist-avatar.jpg"
                      alt={ASSISTANT_NAME}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-50">
                      {ASSISTANT_NAME}
                    </span>
                    <span className="text-xs text-slate-300">
                      {ASSISTANT_TITLE}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: чат + управление */}
          <div className="flex h-[320px] w-full flex-col bg-slate-950 md:h-auto md:max-w-md">
            {/* Чат */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 pt-3 pb-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-indigo-600 text-white shadow-sm"
                        : "rounded-bl-sm bg-slate-800 text-slate-50"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {interimTranscript && (
                <div className="flex justify-end">
                  <div className="max-w-[90%] rounded-2xl border border-indigo-400/60 bg-indigo-500/20 px-3 py-2 text-sm text-indigo-100">
                    {interimTranscript}
                  </div>
                </div>
              )}
            </div>

            {/* Блок "твоя речь" */}
            <div className="px-4 pb-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Your speech
                </p>
                <p className="min-h-[1.5rem] text-sm text-slate-100">
                  {interimTranscript ||
                    lastUserText ||
                    "Нажми на микрофон и начни говорить, чтобы твой текст появился здесь."}
                </p>
              </div>
            </div>

            {/* Статус + кнопки — один общий блок, всегда виден */}
            <div className="border-t border-slate-800 bg-slate-950/95 px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-400">
                <span>{statusMessage}</span>
              </div>

              <div className="flex items-center justify-center gap-3">
                {/* Микрофон */}
                <Button
                  size="icon"
                  variant={isMicMuted ? "outline" : "default"}
                  className={`h-11 w-11 rounded-full border-slate-700 ${
                    isMicMuted
                      ? "bg-slate-900 text-slate-200 hover:bg-slate-800"
                      : "bg-emerald-500 text-white hover:bg-emerald-400"
                  }`}
                  onClick={toggleMic}
                >
                  {isMicMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                {/* Звук ассистента */}
                <Button
                  size="icon"
                  variant="outline"
                  className={`h-11 w-11 rounded-full border-slate-700 ${
                    isSoundEnabled
                      ? "bg-slate-900 text-slate-100 hover:bg-slate-800"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                  }`}
                  onClick={toggleSound}
                >
                  {isSoundEnabled ? (
                    <Volume2 className="h-5 w-5" />
                  ) : (
                    <VolumeX className="h-5 w-5" />
                  )}
                </Button>

                {/* Завершить звонок */}
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-11 w-11 rounded-full bg-rose-600 text-white hover:bg-rose-500"
                  onClick={handleClose}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
