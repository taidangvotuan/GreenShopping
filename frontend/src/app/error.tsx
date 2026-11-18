'use client';

import { Button } from '../shared/components/ui/button';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-primary-900">Đã xảy ra lỗi</h1>
      <p className="text-sm text-gray-600">Xin lỗi, có sự cố khi tải trang. Vui lòng thử lại.</p>
      <Button onClick={reset}>Thử lại</Button>
    </main>
  );
}
