import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { QueryProvider } from '../shared/lib/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Green Shopping', template: '%s | Green Shopping' },
  description: 'Sàn thương mại điện tử dành cho sản phẩm xanh',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <QueryProvider>
          {children}
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}
