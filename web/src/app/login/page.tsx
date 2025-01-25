'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import { authApi } from '@/utils/api-client';
import { StandardResponse } from '@/types/api.types';
import { API_ROUTES } from '@/config/api.config';
import { authService } from '@/utils/auth.service';

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

interface LoginResponse {
  IdToken: string;
  AccessToken: string;
  ExpiresIn: number;
  TokenType: string;
}

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 5) {
      newErrors.password = 'Password must be at least 5 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
        try {
            setIsLoading(true);
            const response = await authApi.post<StandardResponse<LoginResponse>>(
                API_ROUTES.auth.login(),
                formData
            );

            if (response.success) {
                authService.setTokens(response.data);
                toast.success(response.message);
                router.push('/dashboard');
            } else {
                toast.error(response.message);
                setErrors({
                    email: response.message
                });
            }
        } catch (error) {
            console.log(error);
            toast.error('Unable to connect to the server. Please check your internet connection.');
            setErrors({
                email: 'Connection failed. Please try again.'
            });
        } finally {
            setIsLoading(false);
        }
    }
};

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  return (
    <main className="min-h-screen bg-black overflow-x-hidden">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* Navbar */}
      <div className="navbar bg-black/50 backdrop-blur-sm fixed top-0 z-50 px-4">
        <div className="flex-1">
          <Link 
            href="/" 
            className="text-xl font-bold bg-gradient-to-r from-purple-500 to-cyan-500 text-transparent bg-clip-text"
          >
            ShortRelay
          </Link>
        </div>
      </div>

      {/* Login Form */}
      <div className="relative pt-20">
        {/* Gradient Orb Background */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>

        <div className="relative min-h-[90vh] flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <h2 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-purple-500 to-cyan-500 text-transparent bg-clip-text">
              Welcome Back
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Email
                </label>
                <input 
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                  className={`w-full px-4 py-3 bg-gray-900 border ${
                    errors.email ? 'border-red-500' : 'border-gray-800'
                  } rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-100 disabled:opacity-50`}
                  placeholder="Enter your email"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Password
                </label>
                <input 
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  className={`w-full px-4 py-3 bg-gray-900 border ${
                    errors.password ? 'border-red-500' : 'border-gray-800'
                  } rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-100 disabled:opacity-50`}
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              <button 
                type="submit" 
                className="w-full btn bg-gradient-to-r from-purple-500 to-cyan-500 border-0 text-white hover:opacity-90 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-black text-sm text-gray-500">or</span>
                </div>
              </div>
              
              <p className="mt-6 text-gray-400">
                Dont have an account?{' '}
                <Link 
                  href="/signup" 
                  className="font-medium text-purple-500 hover:text-purple-400 transition-colors"
                >
                  Sign up here
                </Link>
              </p>

              <Link 
                href="/forgot-password" 
                className="mt-4 inline-block text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer footer-center p-4 text-gray-500 border-t border-gray-800">
        <div>
          <p>Open Source Project - ShortRelay</p>
        </div>
      </footer>
    </main>
  );
}