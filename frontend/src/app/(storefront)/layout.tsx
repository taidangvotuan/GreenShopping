import type { ReactNode } from 'react';

// TODO(storefront): thay bằng MainHeader/MainFooter thật.
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
