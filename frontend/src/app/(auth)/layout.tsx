'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ShopIcon } from '../../shared/components/ui/shop-icon';

/** Nội dung cột trái theo Figma: Screens/Auth/Login & Screens/Auth/Register (Desktop1440). */
const INTRO = {
  login: {
    title: 'Chào mừng bạn trở lại.',
    lead: 'Tiếp tục những lựa chọn có ý thức. Đơn hàng, lịch sử và Green Coins luôn ở đây khi bạn cần.',
  },
  register: {
    title: 'Bắt đầu một thói quen xanh.',
    lead: 'Một tài khoản để mua sắm an tâm, theo dõi đơn hàng và tích lũy những lựa chọn tốt mỗi ngày.',
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const intro = pathname.startsWith('/register') ? INTRO.register : INTRO.login;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <div className="bg-primary-100 px-3 py-1.5 text-center text-xs text-primary-900">
        Chọn tốt cho bạn. Nhẹ hơn cho hành tinh. • Thông tin xanh minh bạch, mua sắm an tâm.
      </div>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1050px] items-center justify-between px-4 py-5 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl font-semibold text-primary-900"
          >
            <ShopIcon name="brand" /> green shopping
          </Link>
          <Link href="/" className="text-sm text-primary-900 hover:underline">
            ← Về cửa hàng
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1050px] flex-1 items-start gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="hidden space-y-5 lg:block" aria-hidden>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-700">
            Tài khoản xanh
          </p>
          <h1 className="text-3xl font-bold leading-tight">{intro.title}</h1>
          <p className="text-gray-700">{intro.lead}</p>
          <img
            src="/shopping/bottle-side.png"
            alt=""
            className="aspect-[3/2] w-full rounded-xl object-cover"
          />
          <div className="flex gap-3 rounded-lg bg-primary-100 p-4 text-sm text-primary-900">
            <ShopIcon name="shield" />
            <div>
              <p className="font-semibold">An tâm từ những điều nhỏ</p>
              <p className="mt-1 text-gray-700">
                Thông tin của bạn được bảo vệ. Cam kết xanh có căn cứ, quyền lợi mua hàng rõ ràng.
              </p>
            </div>
          </div>
        </section>

        <div className="w-full rounded-2xl border border-gray-300 bg-white p-6 sm:p-10">
          {children}
        </div>
      </main>

      <footer className="bg-primary-100 px-4 py-6 text-sm text-gray-700">
        <div className="mx-auto max-w-[1050px] sm:px-2">
          © 2026 Green Shopping · Mua có ý thức, sống xanh mỗi ngày.
        </div>
      </footer>
    </div>
  );
}
