import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-3xl font-bold text-primary-900">404</h1>
      <p className="text-sm text-gray-600">Không tìm thấy trang bạn yêu cầu.</p>
      <Link href="/" className="text-sm font-medium text-primary-700 hover:underline">
        Về trang chủ
      </Link>
    </main>
  );
}
