"use client";

import { useEffect, useRef } from 'react';

type Props = {
  onDetected: (value: string) => void;
};

export function QrScanner({ onDetected }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let scanner: { start: Function; stop: Function; clear: Function } | null = null;

    const boot = async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!containerRef.current || !mounted) {
        return;
      }

      scanner = new Html5Qrcode(containerRef.current.id);
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 }
        },
        (decodedText: string) => {
          onDetected(decodedText);
        },
        () => undefined
      );
    };

    void boot();

    return () => {
      mounted = false;
      if (scanner) {
        void scanner
          .stop()
          .then(() => scanner?.clear())
          .catch(() => undefined);
      }
    };
  }, [onDetected]);

  return <div id="scan-reader" ref={containerRef} className="min-h-[280px] w-full" />;
}
