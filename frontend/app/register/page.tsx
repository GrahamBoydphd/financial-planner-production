"use client";

import { useRouter } from 'next/navigation';
import AuthForm from '@/components/forms/AuthForm';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async (data: any) => {
    // The AuthForm component handles the try/catch block to display errors inline.
    // We just need to await the action and redirect on success.
    // Passing all 4 required arguments: username, email, password, full_name
    await register(data);
    router.push('/');
  };

  return <AuthForm mode="register" onSubmit={handleRegister} />;
}
