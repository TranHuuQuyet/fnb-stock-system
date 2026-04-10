"use client";

import React, { useEffect, useId, useRef } from 'react';

type Props = {
  onDetected: (value: string) => void;
  onError?: (message: string) => void;
};

type ScannerInstance = {
  start: (
    cameraConfig: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (decodedText: string) => void,
    onError: (errorMessage: string) => void
  ) => Promise<unknown>;
  stop: () => Promise<unknown>;
  clear: () => void | Promise<unknown>;
};

const SCAN_DEBOUNCE_MS = 1200;

export function QrScanner({ onDetected, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onDetectedRef = useRef(onDetected);
  const onErrorRef = useRef(onError);
  const lastDetectedRef = useRef<{ value: string; at: number } | null>(null);
  const scannerId = useId().replace(/:/g, '');

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let active = true;
    let started = false;
    let scanner: ScannerInstance | null = null;

    const boot = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!containerRef.current || !active) {
          return;
        }

        scanner = new Html5Qrcode(scannerId) as ScannerInstance;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 }
          },
          (decodedText: string) => {
            const lastDetected = lastDetectedRef.current;
            const now = Date.now();

            if (
              lastDetected &&
              lastDetected.value === decodedText &&
              now - lastDetected.at < SCAN_DEBOUNCE_MS
            ) {
              return;
            }

            lastDetectedRef.current = {
              value: decodedText,
              at: now
            };
            onDetectedRef.current(decodedText);
          },
          () => undefined
        );
        started = true;
      } catch {
        if (!active) {
          return;
        }

        onErrorRef.current?.(
          'Không thể khởi động camera quét. Bạn có thể chuyển sang nhập tay để tiếp tục.'
        );
      }
    };

    void boot();

    return () => {
      active = false;
      if (!scanner) {
        return;
      }

      if (started) {
        void scanner
          .stop()
          .then(() => scanner?.clear())
          .catch(() => undefined);
        return;
      }

      try {
        void scanner.clear();
      } catch {
        // Ignore cleanup errors when the scanner failed before starting.
      }
    };
  }, [scannerId]);

  return <div id={scannerId} ref={containerRef} className="min-h-[280px] w-full" />;
}
