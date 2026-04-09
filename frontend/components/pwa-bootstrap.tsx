"use client";

import { useEffect } from 'react';

import { getDeviceId } from '@/lib/auth';
import { registerServiceWorker } from '@/lib/pwa';

export function PwaBootstrap() {
  useEffect(() => {
    getDeviceId();
    void registerServiceWorker();
  }, []);

  return null;
}
