import type { ReactNode } from 'react';
import { MainFooter } from '../../shared/components/layout/main-footer';
import { MainHeader } from '../../shared/components/layout/main-header';

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7f8]">
      <MainHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <MainFooter />
    </div>
  );
}
