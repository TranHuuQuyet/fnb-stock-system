import type { Metadata } from 'next';
import './globals.css';

import { Providers } from '@/components/providers';
import { PwaBootstrap } from '@/components/pwa-bootstrap';

export const metadata: Metadata = {
  title: 'Quản lý tồn kho F&B',
  description: 'Kiểm soát nguyên liệu theo lô cho cửa hàng F&B',
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
