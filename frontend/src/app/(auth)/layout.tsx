import { Leaf } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary-50 via-earth-50 to-primary-100">
      <header className="px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2 text-primary-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white">
            <Leaf className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight">Green Shopping</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md rounded-2xl border border-primary-100 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </main>
      <footer className="pb-6 text-center text-xs text-gray-500">
        Mua sắm xanh — vì một hành tinh bền vững 🌱
      </footer>
    </div>
  );
}
