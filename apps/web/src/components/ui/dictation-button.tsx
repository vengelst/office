'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { texts } from '@/lib/texts';

interface DictationButtonProps {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  language?: string;
}

export function DictationButton({
  onTranscript,
  onInterim,
  language = 'de-DE',
}: DictationButtonProps): React.ReactNode {
  const t = texts.communication.dictation;
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setSupported(false);
    }
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript);
      }
      if (interimTranscript && onInterim) {
        onInterim(interimTranscript);
      }
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [language, onTranscript, onInterim]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">{t.notSupported}</p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={listening ? 'destructive' : 'outline'}
        size="sm"
        className={`min-h-[44px] ${listening ? 'animate-pulse' : ''}`}
        onClick={listening ? stop : start}
      >
        {listening ? (
          <>
            <MicOff className="mr-1 h-4 w-4" />
            {t.stop}
          </>
        ) : (
          <>
            <Mic className="mr-1 h-4 w-4" />
            {t.start}
          </>
        )}
      </Button>
      {listening && (
        <span className="text-xs text-red-500 animate-pulse">{t.listening}</span>
      )}
    </div>
  );
}
