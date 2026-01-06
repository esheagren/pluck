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
        <SandAnimation speed={0.6} />
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
                  Articles, documentation, AI conversations—knowledge slips away
                  within days. All that insight, gone.
                </p>

                <p className="text-2xl text-stone-800 leading-relaxed max-w-md font-semibold">
                  Choose to remember.
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

      {/* Second section - Why it matters */}
      <section className="relative z-10 bg-white py-24">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-3xl">
            <p className="text-stone-400 text-sm tracking-widest uppercase mb-4">
              Why it matters
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-stone-800 leading-[1.2] mb-8">
              In your career—and in life—it pays to actually know things.
            </h2>
            <div className="space-y-6 text-lg text-stone-600 leading-relaxed">
              <p>
                You're constantly learning. Reading documentation, researching solutions,
                having conversations with AI. But how much of it sticks?
              </p>
              <p>
                The best professionals aren't just good at finding information—they
                <span className="font-semibold text-stone-800"> retain it</span>.
                They build a foundation of knowledge that compounds over time.
              </p>
              <p className="text-stone-800 font-medium">
                Pluckk helps you become that person.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Third section - Capture from AI */}
      <section className="relative z-10 min-h-screen bg-stone-900 text-white flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <p className="text-stone-500 text-sm tracking-widest uppercase">
                Capture from anywhere
              </p>
              <h2 className="text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight">
                Turn AI conversations
                <br />
                <span className="text-stone-400">into lasting knowledge.</span>
              </h2>

              <p className="text-lg text-stone-400 leading-relaxed max-w-lg">
                ChatGPT and Claude give you incredible insights—then they vanish into chat history.
                Pluckk captures what matters and makes it yours forever.
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-medium">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Highlight in any AI chat</p>
                    <p className="text-stone-500 text-sm">Works with ChatGPT, Claude, and any webpage.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-medium">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Get smart flashcards instantly</p>
                    <p className="text-stone-500 text-sm">AI generates context-aware cards you can edit.</p>
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

            {/* Visual demo - ChatGPT conversation */}
            <div className="relative">
              <div className="bg-stone-800 rounded-2xl p-6 border border-stone-700">
                <div className="space-y-4">
                  {/* ChatGPT header */}
                  <div className="flex items-center gap-2 pb-4 border-b border-stone-700">
                    <div className="w-6 h-6 rounded-sm bg-[#10a37f] flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
                      </svg>
                    </div>
                    <span className="text-stone-400 text-sm font-mono">ChatGPT</span>
                  </div>

                  {/* Conversation */}
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-stone-600 flex-shrink-0" />
                      <p className="text-stone-400 text-sm">What's the difference between useMemo and useCallback in React?</p>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-sm bg-[#10a37f] flex-shrink-0" />
                      <div className="text-stone-300 text-sm leading-relaxed">
                        <p className="mb-2">Great question! Both are React hooks for optimization:</p>
                        <p>
                          <span className="bg-amber-500/30 px-1 rounded">
                            useMemo memoizes a computed value, while useCallback memoizes a function definition. Use useMemo when you have an expensive calculation, and useCallback when passing callbacks to optimized child components.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center py-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-600">
                      <path d="M12 5v14M5 12l7 7 7-7"/>
                    </svg>
                  </div>

                  {/* Generated card */}
                  <div className="bg-white rounded-lg p-5 text-stone-900">
                    <p className="text-xs text-stone-500 uppercase tracking-wide mb-2">Your card</p>
                    <p className="font-medium mb-2">What's the difference between useMemo and useCallback?</p>
                    <p className="text-stone-500 text-sm">useMemo memoizes a computed value; useCallback memoizes a function definition. Use useMemo for expensive calculations, useCallback for callbacks to child components.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fourth section - Your data, your knowledge */}
      <section className="relative z-10 bg-stone-100 py-24">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-stone-200 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-700">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-stone-800">Your cards are yours</h3>
              <p className="text-stone-500 leading-relaxed">
                Everything you create belongs to you. Export anytime, delete anytime.
                We're not building on your data—we're helping you build your knowledge.
              </p>
            </div>

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-stone-200 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-700">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-stone-800">Private & secure</h3>
              <p className="text-stone-500 leading-relaxed">
                Your cards are encrypted and private. We don't sell your data or use it
                for training. Your knowledge stays yours.
              </p>
            </div>

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-stone-200 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-700">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-stone-800">Works with Mochi</h3>
              <p className="text-stone-500 leading-relaxed">
                Already use Mochi for spaced repetition? Cards sync directly to your decks.
                Or review right here—your choice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fifth section - For who */}
      <section className="relative z-10 bg-white py-24">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-stone-800 mb-4">
              For professionals and lifetime learners
            </h2>
            <p className="text-lg text-stone-500 max-w-2xl mx-auto">
              Whether you're advancing your career or pursuing knowledge for its own sake.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-8 rounded-2xl bg-stone-50 border border-stone-200">
              <p className="text-sm text-stone-400 uppercase tracking-wide mb-4">At work</p>
              <ul className="space-y-3 text-stone-600">
                <li className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 flex-shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Remember technical documentation</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 flex-shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Retain insights from AI research sessions</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 flex-shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Build domain expertise that compounds</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-2xl bg-stone-50 border border-stone-200">
              <p className="text-sm text-stone-400 uppercase tracking-wide mb-4">In life</p>
              <ul className="space-y-3 text-stone-600">
                <li className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 flex-shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Learn languages, history, science</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 flex-shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Remember what you read in books and articles</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 flex-shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Become the person who actually knows things</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 bg-stone-900 py-24">
        <div className="w-full max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Stop losing what you learn.
          </h2>
          <p className="text-lg text-stone-400 mb-10 max-w-xl mx-auto">
            Start building a knowledge base that grows with you—for work, for life, forever.
          </p>
          <button
            onClick={onSignIn}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-stone-900 text-lg font-medium rounded-lg hover:bg-stone-100 transition-all hover:shadow-xl"
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
          <p className="mt-4 text-sm text-stone-500">
            Free tier includes 20 cards/month. No credit card required.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-stone-900 border-t border-stone-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-stone-500">
            <img src="/logo.png" alt="Pluckk" className="w-6 h-6 rounded opacity-60" />
            <span className="text-sm font-medium">Pluckk</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <a href="/privacy.html" className="hover:text-stone-300 transition-colors">Privacy</a>
            <a href="mailto:support@pluckk.app" className="hover:text-stone-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
