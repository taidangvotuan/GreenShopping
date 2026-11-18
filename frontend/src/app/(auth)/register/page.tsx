import type { Metadata } from 'next';
import { RegisterForm } from '../../../features/auth-user';

export const metadata: Metadata = { title: 'Đăng ký' };

export default function RegisterPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary-900">Tạo tài khoản</h1>
        <p className="mt-1 text-sm text-gray-600">
          Tham gia cộng đồng mua sắm xanh và tích điểm Green Point
        </p>
      </div>
      <RegisterForm />
    </>
  );
}
