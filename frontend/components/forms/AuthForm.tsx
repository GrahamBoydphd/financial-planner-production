"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import InfoTag from '@/components/ui/InfoTag';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (data: any) => Promise<void>;
}

export default function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isStudent, setIsStudent] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsStudent(checked);
    if (checked) {
      setCompanyName('Individual');
    } else {
      setCompanyName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }

    if (mode === 'register') {
      if (!fullName) {
        setError('Full Name is required.');
        return;
      }
      if (!email) {
        setError('Email is required.');
        return;
      }
      if (!companyName) {
        setError('Company / Organization Name is required.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await onSubmit({ username, email, password, full_name: fullName, company_name: companyName });
      } else {
        await onSubmit({ username, password });
      }
    } catch (err: any) {
      console.error(err);
      
      // Debugging 422: Show raw JSON
      setError(JSON.stringify(err.response?.data) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4">
      
      {/* Branding Logo */}
      <img 
        src="/logo.png" 
        alt="Logo" 
        className="h-16 w-auto mb-8 mx-auto block" 
      />

      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-md md:flex-row">
        
        {/* Left Column: Marketing & Disclaimer (Visible on md+) */}
        <div className="hidden w-full flex-col bg-indigo-700 p-10 text-white md:flex md:w-1/2">
          <h2 className="mb-6 text-3xl font-bold">Master Your Financial Future</h2>
          <div className="space-y-4 text-indigo-100">
            <p>
              A sophisticated simulation tool designed to model the survival and growth of startups, SMEs, 
              and the funds that invest in them. Replaces your conventional business / portfolio planning, 
              because standard business / portfolio planning tools are blind to the
              losses caused by volatility drag and all other forms of non-ergodic dynamics. This software
              does capture the non-ergodic dynamics, and uses Monte Carlo simulations to give you a far 
              superior way of assessing if your venture / fund is likely to succeed. Or not. Because you now 
              account for real-world volatility, and so can identify and remedy risks standard tools hide.
            </p>
            <p className="text-sm opacity-80">
              This app is based on the book <i>The Ergodic Investor and Entrepreneur</i> by Graham Boyd and 
              Jack Reardon. 
            </p>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="w-full p-8 md:w-1/2">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          
          {error && (
            <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-500 border border-red-200 break-words whitespace-pre-wrap">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your username"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="fullName">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="companyName">
                  Company / Organization Name
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isStudent}
                  className={`w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isStudent ? 'bg-gray-100 text-gray-500' : ''}`}
                  placeholder={isStudent ? "Individual" : "Enter company name"}
                  required={!isStudent}
                />
                <div className="mt-2 flex items-center">
                  <input
                    id="isStudent"
                    type="checkbox"
                    checked={isStudent}
                    onChange={handleStudentChange}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isStudent" className="ml-2 block text-sm text-gray-900">
                    I am a student / individual
                  </label>
                  <InfoTag content="Automatically sets Company Name to 'Individual' and disables the field. Use this if you don't have a registered business entity." />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter your password"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Confirm your password"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-blue-600 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <Link href="/register" className="font-medium text-blue-600 hover:underline">
                  Register
                </Link>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-blue-600 hover:underline">
                  Login
                </Link>
              </p>
            )}
          </div>

          {/* Alpha Disclaimer (Bottom of White Card) */}
          <div className="mt-8 border-t border-gray-100 pt-4 text-xs text-gray-400">
            <p className="font-semibold uppercase tracking-wider text-gray-500 mb-1">Disclaimer</p>
            <p>
              This app is provided for educational purposes only. The output is not advice in any form, 
              certainly neither investment nor legal advice. To the fullest extent of the law, no liability 
              will be accepted, neither by Evolutesix nor the author(s) for any loss related to this content. 
              This is an alpha release for early developmental testing, feedback, and educational purposes only.
              We may at any stage need to do a complete clean reset, at which point all of your data and 
              login details may be lost.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
