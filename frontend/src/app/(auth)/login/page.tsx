import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from '../../../features/auth-user';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default function LoginPage() {
  return (
    <>
      <div className="mb-6 space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900">Đăng nhập</h1>
        <p className="text-sm text-gray-700">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="font-medium text-primary-900 hover:underline">
            Tạo tài khoản xanh →
          </Link>
        </p>
      </div>
      {/* useSearchParams trong LoginForm cần Suspense boundary */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </>
  );
}
