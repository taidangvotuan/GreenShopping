import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '../../../features/auth-user';

export const metadata: Metadata = { title: 'Đăng nhập' };

export default function LoginPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary-900">Đăng nhập</h1>
        <p className="mt-1 text-sm text-gray-600">Chào mừng bạn quay lại Green Shopping</p>
      </div>
      {/* useSearchParams trong LoginForm cần Suspense boundary */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </>
  );
}
