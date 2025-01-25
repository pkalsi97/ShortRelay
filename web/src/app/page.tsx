import Link from 'next/link';

export default function Home() {
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
        <div className="flex-none gap-2">
          <a 
            href="https://github.com/pkalsi97/ShortRelay" 
            className="btn btn-sm px-4 bg-gradient-to-r from-purple-500 to-cyan-500 border-0 text-white"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          <Link 
            href="/login" 
            className="btn btn-sm px-4 bg-gradient-to-r from-purple-500 to-cyan-500 border-0 text-white"
          >
            Login
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative pt-20">
        {/* Gradient Orb Background */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

        <div className="relative min-h-[90vh] flex items-center justify-center px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-12 bg-gradient-to-r from-purple-500 to-cyan-500 text-transparent bg-clip-text">
              ShortRelay
            </h1>
            <div className="space-y-6">
              <p className="text-lg md:text-xl leading-relaxed text-gray-300">
                ShortRelay is a serverless video processing pipeline that leverages event-driven 
                architecture to deliver efficient, scalable short-form videos.
                Its loosely coupled design ensures seamless video processing and delivery.
              </p>
            </div>
            <div className="flex justify-center mt-16">
              <Link 
                href="/signup" 
                className="btn btn-lg px-8 bg-gradient-to-r from-purple-500 to-cyan-500 border-0 text-white hover:opacity-90"
              >
                Get Started
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