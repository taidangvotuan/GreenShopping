import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '../../../features/auth-user';

export const metadata: Metadata = { title: 'Đăng ký' };

export default function RegisterPage() {
  return (
    <>
      <div className="mb-6 space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900">Tạo tài khoản xanh</h1>
        <p className="text-sm text-gray-700">
          Đã có tài khoản?{' '}
          <Link href="/login" className="font-medium text-primary-900 hover:underline">
            Đăng nhập →
          </Link>
        </p>
      </div>
      <RegisterForm />
    </>
  );
}
