'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { texts } from '@/lib/texts';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as Record<string, SpeechRecognitionConstructor>)
      .SpeechRecognition ??
    (window as unknown as Record<string, SpeechRecognitionConstructor>)
      .webkitSpeechRecognition ??
    null
  );
}

interface DictationButtonProps {
  onTranscript: (text: string) => void;
  language?: string;
  className?: string;
}

export function DictationButton({
  onTranscript,
  language = 'de-DE',
  className,
}: DictationButtonProps): React.ReactNode {
  const t = texts.communication.dictation;
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    if (!getSpeechRecognition()) setSupported(false);
  }, []);

  const start = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    transcriptRef.current = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        }
      }
      if (final) {
        transcriptRef.current += final;
      }
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
      if (transcriptRef.current.trim()) {
        onTranscript(transcriptRef.current.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [language, onTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  if (!supported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled
        title={t.notSupported}
        className={cn('h-9 w-9', className)}
      >
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  if (recording) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="icon"
        onClick={stop}
        title={t.stop}
        className={cn('h-9 w-9 animate-pulse', className)}
      >
        <Square className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={start}
      title={t.start}
      className={cn('h-9 w-9', className)}
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}
