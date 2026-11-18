'use client';

import { LogOut } from 'lucide-react';
import { Button, type ButtonProps } from '../../../shared/components/ui/button';
import { useLogout } from '../hooks/use-auth';

export function LogoutButton(props: Omit<ButtonProps, 'onClick' | 'isLoading'>) {
  const logout = useLogout();
  return (
    <Button variant="outline" size="sm" {...props} isLoading={logout.isPending} onClick={() => logout.mutate()}>
      <LogOut className="h-4 w-4" aria-hidden />
      Đăng xuất
    </Button>
  );
}
