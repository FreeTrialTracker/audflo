'use client';

import { useEffect, useRef, useState } from 'react';

export function useCopy(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), timeout);
    });
  };

  return { copied, copy };
}
