import { motion } from 'framer-motion'

const EXAMPLE_PROMPTS = [
  "A glassy pricing card for a SaaS product with three horizontal tiers",
  "A minimal user profile card with avatar, name, and stats",
  "A dark-mode notification toast with an icon and dismiss button",
  "A clean testimonial card with a quote, author, and 5 star rating",
  "A glassy login form with email, password, and a sign in button",
  "A medical appointment booking card with date, time, and doctor info",
  "A minimal dashboard stat card showing revenue, growth, and a trend line",
  "A job listing card with company name, role, location, and salary range",
  "A glassy onboarding step card with icon, heading, and progress indicator",
  "A product feature card with icon, title, and short description",
]

// Raised from 400 to 2000 so users can write detailed multi-feature prompts
const MAX_CHARS = 2000

function PromptPanel({ prompt, setPrompt, onGenerate, onClear, loading }) {

  const handleKeyDown = (e) => {
    // Shift+Enter makes a new line. Plain Enter submits.
    // This lets users write multi-line detailed prompts comfortably.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onGenerate()
    }
  }

  const handleSurpriseMe = () => {
    const random = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]
    setPrompt(random)
  }

  const charCount = prompt.length
  // Warning zone starts at 85% of the limit
  const isNearLimit = charCount > MAX_CHARS * 0.85
  const isOverLimit = charCount > MAX_CHARS

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col gap-5 shadow-sm"
    >

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-zinc-700">
            Describe your component
          </label>

          {/* Counter only appears once typing starts */}
          {charCount > 0 && (
            <span className={`text-xs font-mono transition-colors duration-150 ${
              isOverLimit
                ? 'text-red-400'
                : isNearLimit
                  ? 'text-amber-400'
                  : 'text-zinc-400'
            }`}>
              {charCount}/{MAX_CHARS}
            </span>
          )}
        </div>

        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`You can include:\n- Layout: "three horizontal cards"\n- Size: "compact", "wide 600px", "full-width"\n- Colors: "green gradient", "dark background"\n- Interactions: "button that shows text when clicked"\n- Content: specific names, labels, data to display`}
            rows={6}
            maxLength={MAX_CHARS}
            className={`w-full resize-none rounded-xl border px-4 py-3
                       text-sm text-zinc-800 placeholder:text-zinc-400
                       focus:outline-none focus:ring-2 focus:border-transparent
                       transition-all duration-200 bg-zinc-50 leading-relaxed
                       ${isOverLimit
                         ? 'border-red-300 focus:ring-red-200'
                         : 'border-zinc-200 focus:ring-zinc-300'
                       }`}
          />

          {/* Clear button inside textarea corner */}
          {prompt && !loading && (
            <button
              onClick={onClear}
              className="absolute top-3 right-3 w-5 h-5 rounded-full bg-zinc-300
                         hover:bg-zinc-400 flex items-center justify-center
                         transition-all duration-150"
              title="Clear prompt"
            >
              <span className="text-white text-xs font-bold leading-none">✕</span>
            </button>
          )}
        </div>

        {isOverLimit && (
          <p className="text-xs text-red-400 mt-1.5">
            Prompt is too long. Trim it down for better results.
          </p>
        )}

       
      </div>

      {/* EXAMPLE PROMPTS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
            Try an example
          </p>
          <button
            onClick={handleSurpriseMe}
            className="text-xs text-zinc-400 hover:text-zinc-700
                       transition-colors duration-150 font-medium"
          >
            Surprise me ↻
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {EXAMPLE_PROMPTS.slice(0, 4).map((example, index) => (
            <button
              key={index}
              onClick={() => setPrompt(example)}
              className="text-left text-xs text-zinc-500 hover:text-zinc-800
                         hover:bg-zinc-50 px-3 py-2 rounded-lg border border-transparent
                         hover:border-zinc-200 transition-all duration-150"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* GENERATE BUTTON */}
      <button
        onClick={onGenerate}
        disabled={loading || !prompt.trim() || isOverLimit}
        className="w-full bg-zinc-900 text-white text-sm font-medium
                   py-3 px-6 rounded-xl hover:bg-zinc-700
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-200 active:scale-95"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white
                             rounded-full animate-spin" />
            Generating...
          </span>
        ) : (
          'Generate Component →'
        )}
      </button>

      <p className="text-xs text-zinc-400 text-center">
        Enter to generate · Shift+Enter for new line
      </p>

    </motion.div>
  )
}

export default PromptPanel