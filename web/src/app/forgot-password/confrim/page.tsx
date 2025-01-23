'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface FormData {
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

interface FormErrors {
  otp?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export default function ForgotPasswordConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  const [formData, setFormData] = useState<FormData>({
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!email) {
      router.push('/forgot-password');
    }
  }, [email, router]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.otp) {
      newErrors.otp = 'Verification code is required';
    } else if (formData.otp.length !== 6) {
      newErrors.otp = 'Invalid verification code';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 5) {
      newErrors.newPassword = 'Password must be at least 5 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      setIsLoading(true);
      try {
        // Here you would make your API call with email, otp, and new password
        console.log('Resetting password for:', email, formData);
        
        // On success, redirect to login
        router.push('/login');
      } catch (error) {
        console.error('Error:', error);
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

      {/* Form */}
      <div className="relative pt-20">
        {/* Gradient Orb Background */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>

        <div className="relative min-h-[90vh] flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <h2 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-purple-500 to-cyan-500 text-transparent bg-clip-text">
              Reset Password
            </h2>
            
            <p className="text-gray-400 text-center mb-8">
              Enter the verification code sent to<br />
              <span className="text-purple-500">{email}</span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Verification Code
                </label>
                <input 
                  type="text"
                  name="otp"
                  value={formData.otp}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-gray-900 border ${
                    errors.otp ? 'border-red-500' : 'border-gray-800'
                  } rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-100`}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
                {errors.otp && (
                  <p className="mt-1 text-sm text-red-500">{errors.otp}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  New Password
                </label>
                <input 
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-gray-900 border ${
                    errors.newPassword ? 'border-red-500' : 'border-gray-800'
                  } rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-100`}
                  placeholder="Enter new password"
                />
                {errors.newPassword && (
                  <p className="mt-1 text-sm text-red-500">{errors.newPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Confirm Password
                </label>
                <input 
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-gray-900 border ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-800'
                  } rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-100`}
                  placeholder="Confirm new password"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
                )}
              </div>

              <button 
                type="submit" 
                className="w-full btn bg-gradient-to-r from-purple-500 to-cyan-500 border-0 text-white hover:opacity-90 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link 
                href="/login" 
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                Back to Login
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
  )
}