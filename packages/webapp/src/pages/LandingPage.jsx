import { useState, useEffect } from 'react'

// Animated highlight demo component
function HighlightDemo() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setStage(s => (s + 1) % 4)
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  const text = "The spacing effect demonstrates that learning is more effective when study sessions are spaced out over time rather than concentrated in a single session."
  const highlightStart = 4
  const highlightEnd = 18

  const words = text.split(' ')

  return (
    <div className="relative">
      {/* Browser mockup */}
      <div className="bg-white rounded-2xl shadow-2xl shadow-stone-300/50 overflow-hidden border border-stone-200">
        {/* Browser chrome */}
        <div className="bg-stone-100 px-4 py-3 flex items-center gap-2 border-b border-stone-200">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-stone-300"></div>
            <div className="w-3 h-3 rounded-full bg-stone-300"></div>
            <div className="w-3 h-3 rounded-full bg-stone-300"></div>
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-white rounded-md px-3 py-1.5 text-xs text-stone-400 font-mono">
              wikipedia.org/wiki/Spacing_effect
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="p-8 min-h-[180px]">
          <p className="text-stone-700 leading-relaxed font-serif text-lg">
            {words.map((word, i) => {
              const isHighlighted = i >= highlightStart && i < highlightEnd
              const showHighlight = stage >= 1 && isHighlighted

              return (
                <span key={i}>
                  <span
                    className={`transition-all duration-500 ${
                      showHighlight
                        ? 'bg-amber-200 px-0.5 -mx-0.5 rounded'
                        : ''
                    }`}
                  >
                    {word}
                  </span>
                  {' '}
                </span>
              )
            })}
          </p>
        </div>
      </div>

      {/* Floating card preview */}
      <div
        className={`absolute -bottom-6 -right-6 w-72 transition-all duration-700 ${
          stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="bg-white rounded-xl shadow-xl shadow-stone-300/40 border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Generated Card</span>
          </div>
          <p className="text-stone-800 font-medium mb-2">What does the spacing effect demonstrate about learning?</p>
          <p className="text-stone-500 text-sm">Learning is more effective when study sessions are spaced out over time.</p>
        </div>
      </div>

      {/* Cursor */}
      <div
        className={`absolute transition-all duration-1000 ${
          stage === 0 ? 'top-24 left-12 opacity-100' :
          stage === 1 ? 'top-24 left-[320px] opacity-100' :
          'top-24 left-[320px] opacity-0'
        }`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-md">
          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z" fill="#1a1a1a"/>
        </svg>
      </div>
    </div>
  )
}

// Feature card component
function FeatureCard({ icon, title, description, delay }) {
  return (
    <div
      className="group p-6 rounded-2xl bg-white border border-stone-200 hover:border-stone-300 hover:shadow-lg hover:shadow-stone-200/50 transition-all duration-300"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-4 group-hover:bg-stone-800 group-hover:text-white transition-colors duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-stone-800 mb-2">{title}</h3>
      <p className="text-stone-500 leading-relaxed">{description}</p>
    </div>
  )
}

// Step indicator
function StepIndicator({ number, label, isActive }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
        isActive ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-400'
      }`}>
        {number}
      </div>
      <span className={`font-medium transition-colors ${isActive ? 'text-stone-800' : 'text-stone-400'}`}>
        {label}
      </span>
    </div>
  )
}

export default function LandingPage({ onSignIn }) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep(s => (s + 1) % 3)
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Subtle grain texture overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />

      {/* Header */}
      <header className="relative z-10 px-6 py-5">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Pluckk" className="w-8 h-8 rounded-lg" />
            <span className="text-xl font-semibold text-stone-800 tracking-tight">Pluckk</span>
          </div>
          <button
            onClick={onSignIn}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
          >
            Sign in
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="px-6 pt-16 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: Copy */}
              <div>
                <h1 className="text-5xl lg:text-6xl font-bold text-stone-800 leading-[1.1] mb-6 tracking-tight">
                  Turn reading into{' '}
                  <span className="relative">
                    <span className="relative z-10">remembering</span>
                    <span className="absolute bottom-2 left-0 right-0 h-3 bg-amber-200 -z-0 -rotate-1"></span>
                  </span>
                </h1>

                <p className="text-xl text-stone-500 leading-relaxed mb-8 max-w-lg">
                  Highlight any text. Get AI-generated flashcards. Build lasting knowledge with spaced repetition—all without leaving your browser.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={onSignIn}
                    className="group inline-flex items-center gap-3 px-6 py-3.5 bg-stone-800 text-white font-medium rounded-xl hover:bg-stone-900 transition-all hover:shadow-lg hover:shadow-stone-300/30"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Get started with Google
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:translate-x-0.5 transition-transform">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>

                  <a
                    href="https://chrome.google.com/webstore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3.5 text-stone-600 font-medium hover:text-stone-800 transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="4"></circle>
                      <line x1="21.17" y1="8" x2="12" y2="8"></line>
                      <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
                      <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
                    </svg>
                    Install Extension
                  </a>
                </div>

                {/* Social proof */}
                <div className="mt-10 pt-8 border-t border-stone-200">
                  <p className="text-sm text-stone-400 mb-3">Works seamlessly with</p>
                  <div className="flex items-center gap-6 text-stone-400">
                    <span className="font-medium">Mochi</span>
                    <span className="font-medium">ChatGPT</span>
                    <span className="font-medium">Claude</span>
                    <span className="font-medium">Notion</span>
                  </div>
                </div>
              </div>

              {/* Right: Demo */}
              <div className="relative lg:pl-8">
                <HighlightDemo />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-24 bg-white border-y border-stone-200">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-stone-800 mb-4">Three steps to lasting knowledge</h2>
              <p className="text-stone-500 text-lg max-w-2xl mx-auto">
                No context switching. No manual card creation. Just highlight and learn.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                delay={0}
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                }
                title="1. Highlight anything"
                description="Select text on any webpage—articles, documentation, chat conversations, PDFs. Pluckk captures the context automatically."
              />

              <FeatureCard
                delay={100}
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v18M3 12h18" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                }
                title="2. Choose your card"
                description="AI generates 2-3 flashcard options—Q&A, cloze deletion, or conceptual. Pick the one that fits how you want to remember."
              />

              <FeatureCard
                delay={200}
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                }
                title="3. Review & remember"
                description="Cards sync to Mochi for spaced repetition, or review right here. The science-backed method that actually makes knowledge stick."
              />
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="px-6 py-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Smart context */}
              <div className="p-8 rounded-2xl bg-gradient-to-br from-stone-800 to-stone-900 text-white">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3">Smart context awareness</h3>
                <p className="text-stone-300 leading-relaxed">
                  Pluckk doesn't just grab your highlight—it captures surrounding context, page title, and URL. Your cards always include the source for later reference.
                </p>
              </div>

              {/* Keyboard first */}
              <div className="p-8 rounded-2xl bg-stone-100">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-6 shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                    <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M6 16h12"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-stone-800 mb-3">Keyboard-first workflow</h3>
                <p className="text-stone-500 leading-relaxed">
                  <kbd className="px-1.5 py-0.5 bg-white rounded text-xs font-mono shadow-sm">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-white rounded text-xs font-mono shadow-sm">⇧</kbd> + <kbd className="px-1.5 py-0.5 bg-white rounded text-xs font-mono shadow-sm">M</kbd> to open. Number keys to select. Enter to send. Never break your reading flow.
                </p>
              </div>

              {/* Mochi integration */}
              <div className="p-8 rounded-2xl bg-stone-100">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-6 shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-stone-800 mb-3">Mochi integration</h3>
                <p className="text-stone-500 leading-relaxed">
                  Connect your Mochi account and cards flow directly to your decks. Prefer standalone? Cards copy to clipboard in Mochi-ready markdown format.
                </p>
              </div>

              {/* AI powered */}
              <div className="p-8 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-6 shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-stone-800 mb-3">Powered by Claude</h3>
                <p className="text-stone-500 leading-relaxed">
                  Anthropic's Claude generates cards that are atomic, clear, and actually testable. Not just copy-paste—real understanding-focused questions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-stone-800 mb-6">
              Stop forgetting what you read
            </h2>
            <p className="text-xl text-stone-500 mb-10 max-w-xl mx-auto">
              Join readers who've turned their browsing into a knowledge-building habit.
            </p>
            <button
              onClick={onSignIn}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-stone-800 text-white text-lg font-medium rounded-xl hover:bg-stone-900 transition-all hover:shadow-xl hover:shadow-stone-300/30"
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
              Free tier includes 20 cards/month. No credit card required.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-stone-200">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-stone-400">
            <img src="/logo.png" alt="Pluckk" className="w-6 h-6 rounded opacity-60" />
            <span className="text-sm">Pluckk</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-stone-400">
            <a href="/privacy.html" className="hover:text-stone-600 transition-colors">Privacy Policy</a>
            <a href="mailto:support@pluckk.app" className="hover:text-stone-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
