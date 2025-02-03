import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ShortRelay - Serverless Video Processing Pipeline',
  description: 'ShortRelay is a serverless video processing pipeline that leverages event-driven architecture to deliver efficient, scalable short-form videos.',
  keywords: ['video processing', 'serverless', 'event-driven', 'pipeline'],
  authors: [{ name: 'ShortRelay' }],
  openGraph: {
    title: 'ShortRelay',
    description: 'Serverless Video Processing Pipeline',
    // Remove url or use placeholder
    // url: 'https://future-domain.com',
    siteName: 'ShortRelay',
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}