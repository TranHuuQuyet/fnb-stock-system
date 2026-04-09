import type { Metadata } from 'next';
import './globals.css';

import { Providers } from '@/components/providers';
import { PwaBootstrap } from '@/components/pwa-bootstrap';

export const metadata: Metadata = {
  title: 'FNB Stock Control',
  description: 'Batch-based ingredient control for F&B stores',
  manifest: '/manifest.json'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <Providers>
          <PwaBootstrap />
          {children}
        </Providers>
      </body>
    </html>
  );
}
