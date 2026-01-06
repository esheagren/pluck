import { useState, useEffect } from 'react'
import SandAnimation from '../components/SandAnimation'

export default function LandingPage({ onSignIn }) {
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    // Delay content appearance for dramatic effect
    const timer = setTimeout(() => setShowContent(true), 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-stone-100 relative overflow-hidden">
      {/* Sand animation - full screen */}
      <div className="absolute inset-0">
        <SandAnimation />
      </div>

      {/* Hero content - positioned on the right side (the "filtered" zone) */}
      <div className="relative z-10 min-h-screen flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-12 gap-8 items-center min-h-screen py-16">
            {/* Left side - mostly empty, where particles flow */}
            <div className="lg:col-span-7 hidden lg:block" />

            {/* Right side - the filtered zone with dramatic copy */}
            <div
              className={`lg:col-span-5 transition-all duration-1000 ${
                showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              {/* Dramatic statement */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <p className="text-stone-400 text-sm tracking-widest uppercase">
                    The problem
                  </p>
                  <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-stone-800 leading-[1.1] tracking-tight">
                    You forget
                    <br />
                    <span className="text-stone-400">almost everything</span>
                    <br />
                    you read.
                  </h1>
                </div>

                <div className="h-px bg-stone-300 w-24" />

                <p className="text-lg text-stone-500 leading-relaxed max-w-md">
                  Research shows we retain only 10-20% of what we read after a week.
                  All that time spent learning—gone.
                </p>

                <p className="text-lg text-stone-600 leading-relaxed max-w-md font-medium">
                  Unless you have a system.
                </p>

                {/* CTA */}
                <div className="pt-4 space-y-4">
                  <button
                    onClick={onSignIn}
                    className="group inline-flex items-center gap-3 px-8 py-4 bg-stone-900 text-white font-medium rounded-lg hover:bg-stone-800 transition-all hover:shadow-xl hover:shadow-stone-400/20"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Start remembering
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:translate-x-0.5 transition-transform">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>

                  <p className="text-sm text-stone-400">
                    Free to start. No credit card required.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-1000 delay-1000 ${
          showContent ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex flex-col items-center gap-2 text-stone-400">
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-bounce">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </div>
      </div>

      {/* Second section - The solution */}
      <section className="relative z-10 min-h-screen bg-stone-900 text-white flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <p className="text-stone-500 text-sm tracking-widest uppercase">
                The solution
              </p>
              <h2 className="text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight">
                Capture knowledge
                <br />
                <span className="text-stone-400">as you discover it.</span>
              </h2>

              <p className="text-lg text-stone-400 leading-relaxed max-w-lg">
                Pluckk turns any highlighted text into spaced repetition flashcards—
                the scientifically proven method to move information into long-term memory.
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-medium">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Highlight anything</p>
                    <p className="text-stone-500 text-sm">On any webpage. Articles, docs, conversations.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-medium">2</span>
                  </div>
                  <div>
                    <p className="font-medium">AI generates flashcards</p>
                    <p className="text-stone-500 text-sm">Context-aware cards you can edit or accept.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-medium">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Review & remember</p>
                    <p className="text-stone-500 text-sm">Spaced repetition makes it stick—permanently.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual demo area */}
            <div className="relative">
              <div className="bg-stone-800 rounded-2xl p-8 border border-stone-700">
                <div className="space-y-6">
                  {/* Simulated highlight */}
                  <div className="bg-stone-900 rounded-lg p-6">
                    <p className="text-stone-400 text-sm mb-3 font-mono">wikipedia.org</p>
                    <p className="text-stone-300 leading-relaxed">
                      The spacing effect demonstrates that{' '}
                      <span className="bg-amber-500/30 px-1 rounded">
                        learning is more effective when study sessions are spaced out
                      </span>{' '}
                      over time rather than concentrated in a single session.
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-600">
                      <path d="M12 5v14M5 12l7 7 7-7"/>
                    </svg>
                  </div>

                  {/* Generated card */}
                  <div className="bg-white rounded-lg p-6 text-stone-900">
                    <p className="text-xs text-stone-500 uppercase tracking-wide mb-3">Generated card</p>
                    <p className="font-medium mb-2">What does the spacing effect demonstrate?</p>
                    <p className="text-stone-500 text-sm">Learning is more effective when study sessions are spaced out over time.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Third section - CTA */}
      <section className="relative z-10 bg-stone-100 py-24">
        <div className="w-full max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-stone-800 mb-6">
            Stop losing what you learn.
          </h2>
          <p className="text-lg text-stone-500 mb-10 max-w-xl mx-auto">
            Join readers who've turned passive browsing into active knowledge building.
          </p>
          <button
            onClick={onSignIn}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-stone-900 text-white text-lg font-medium rounded-lg hover:bg-stone-800 transition-all hover:shadow-xl hover:shadow-stone-400/20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Get started free
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:translate-x-1 transition-transform">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          <p className="mt-4 text-sm text-stone-400">
            Free tier includes 20 cards/month
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-stone-100 border-t border-stone-200 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-stone-400">
            <img src="/logo.png" alt="Pluckk" className="w-6 h-6 rounded opacity-60" />
            <span className="text-sm font-medium">Pluckk</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-stone-400">
            <a href="/privacy.html" className="hover:text-stone-600 transition-colors">Privacy</a>
            <a href="mailto:support@pluckk.app" className="hover:text-stone-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
