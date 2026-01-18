"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export interface User {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  tenant_id: string;
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
      
      // Debug login response
      console.log('DEBUG: Login Response:', response);
      
      // Destructure fields from response
      // Casting to any to handle dynamic API response fields
      const { token, user_id, username, tenant_id, full_name } = response as any;
      
      // Use full_name from response if available, otherwise fallback to payload username
      const fullName = full_name || payload.username;
      const validUsername = username || payload.username;
      
      // Ensure user_id is mapped to User.id
      const userObj: User = { 
        id: user_id,
        user_id: user_id,
        username: validUsername, 
        full_name: fullName,
        tenant_id: tenant_id
      };

      // Store ALL fields in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userObj));
      
      if (user_id) localStorage.setItem('user_id', user_id);
      if (tenant_id) localStorage.setItem('tenant_id', tenant_id);
      if (validUsername) localStorage.setItem('username', validUsername);
      
      setToken(token);
      setUser(userObj);
      
      router.push('/'); // Redirect to dashboard
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      // 1. Call register API
      await api.register(
        payload.username, 
        payload.email, 
        payload.password, 
        payload.full_name, 
        payload.company_name
      );
      
      // 2. Immediately login to establish session
      await login({ 
        username: payload.username, 
        password: payload.password 
      });
    } catch (error) {
      console.error("Registration failed", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_id');
    localStorage.removeItem('tenant_id');
    localStorage.removeItem('username');
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
