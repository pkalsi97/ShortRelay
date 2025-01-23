'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FormData {
  email: string;
}

interface FormErrors {
  email?: string;
}

export default function ForgotPassword() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({ email: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      setIsLoading(true);
      try {
        // Here you would typically make an API call to send OTP
        // For now, we'll just simulate it
        console.log('Sending OTP to:', formData.email);
        
        // Redirect to confirm page with email
        router.push(`/forgot-password/confirm?email=${encodeURIComponent(formData.email)}`);
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
              Enter your email address and we will send you a verification code
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Email Address
                </label>
                <input 
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-gray-900 border ${
                    errors.email ? 'border-red-500' : 'border-gray-800'
                  } rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-100`}
                  placeholder="Enter your registered email"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <button 
                type="submit" 
                className="w-full btn bg-gradient-to-r from-purple-500 to-cyan-500 border-0 text-white hover:opacity-90 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Verification Code'}
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