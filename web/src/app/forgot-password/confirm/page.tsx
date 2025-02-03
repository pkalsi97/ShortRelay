// src/app/forgot-password/confirm/page.tsx
'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ForgotPasswordConfirmComponent = dynamic(
  () => import('@/components/ForgotPasswordConfirm'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="loading loading-spinner loading-lg text-purple-500"></div>
      </div>
    ),
  }
);

export default function ForgotPasswordConfirmPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="loading loading-spinner loading-lg text-purple-500"></div>
        </div>
      }
    >
      <ForgotPasswordConfirmComponent />
    </Suspense>
  );
}