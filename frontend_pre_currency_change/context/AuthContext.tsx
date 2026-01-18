"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export interface User {
  username: string;
  full_name: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  full_name: string;
  company_name: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Initialize token and user from localStorage on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken) {
      setToken(storedToken);
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (payload: LoginPayload) => {
    try {
      const response = await api.login(payload.username, payload.password);
      const newToken = response.token;
      
      // Use full_name from response if available, otherwise fallback to username
      // Casting to any to avoid TS errors if api types aren't updated yet
      const fullName = (response as any).full_name || payload.username;
      const userObj: User = { username: payload.username, full_name: fullName };

      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userObj));
      
      setToken(newToken);
      setUser(userObj);
      
      router.push('/'); // Redirect to dashboard
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      const response = await api.register(payload.username, payload.email, payload.password, payload.full_name, payload.company_name);
      const newToken = response.token;
      
      // Use full_name from response if available, otherwise fallback to username
      const fullName = (response as any).full_name || payload.username;
      const userObj: User = { username: payload.username, full_name: fullName };

      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userObj));
      
      setToken(newToken);
      setUser(userObj);
      
      router.push('/'); // Redirect to dashboard
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: !!token, 
      token, 
      user,
      login, 
      register, 
      logout, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
