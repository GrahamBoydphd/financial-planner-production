"use client";

import { useRouter } from 'next/navigation';
import AuthForm from '@/components/forms/AuthForm';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (data: any) => {
    // The AuthForm component handles the try/catch block to display errors inline.
    // We just need to await the action and redirect on success.
    await login(data);
    router.push('/');
  };

  return <AuthForm mode="login" onSubmit={handleLogin} />;
}
