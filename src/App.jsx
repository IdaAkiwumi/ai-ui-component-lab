import { useState } from 'react'
import PromptPanel from './components/PromptPanel'
import PreviewPanel from './components/PreviewPanel'
import SessionHistory from './components/SessionHistory'

// Only models confirmed to follow "return HTML only" without adding explanation text
// Ordered by daily request limit: most generous first
const MODELS = [
  'llama-3.1-8b-instant',                       // 14,400 RPD
  'llama-3.3-70b-versatile',                     // 1,000 RPD — better quality
  'meta-llama/llama-4-scout-17b-16e-instruct',  // 1,000 RPD — best quality
  'qwen/qwen3-32b',                              // 1,000 RPD — strong at code
  'openai/gpt-oss-20b',                          // 1,000 RPD
  'openai/gpt-oss-120b',                         // 1,000 RPD — highest quality fallback
]

// Strips markdown fences and thinking tags that models sometimes add
// despite being told not to
export function cleanCode(raw) {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/```\s*$/gm, '')
    .trim()
}

// Post-processing layer — catches anything the model adds that violates our rules
// even when the system prompt is ignored under rate limit fallback conditions
export function sanitizeOutput(code, prompt) {
  if (!code) return code
  const lower = prompt.toLowerCase()

  const wantsStars = (
    lower.includes('star') ||
    lower.includes('rating') ||
    lower.includes('review') ||
    lower.includes('score')
  )

  if (!wantsStars) {
    // Remove all star characters when not requested
    code = code.replace(/[★☆⭐🌟]/g, '')
    code = code.replace(/<span[^>]*>\s*<\/span>/g, '')
  } else {
    // Stars WERE requested — fix common model mistakes

    // Fix 1: Replace ^ chevron characters that models use instead of ★
    // Only inside elements that look like star containers to avoid breaking JS/CSS
    code = code.replace(
      /(<(?:span|div|i)[^>]*class="[^"]*star[^"]*"[^>]*>)\s*\^\s*(<\/)/gi,
      '\$1★\$2'
    )

    // Fix 2: If the model used CSS ::before with chevron content, 
    // replace the content value with the actual star character
    code = code.replace(
      /content:\s*["'][\^›»❯>]+["']/gi,
      'content: "★"'
    )

    // Fix 3: Ensure any .star-row or .stars container is horizontal
    // Inject a style block fix after any existing star styles
    if (code.includes('star-row') || code.includes('class="stars"')) {
      const starFix = `<style>
  .star-row, .stars, [class*="star-row"], [class*="star-container"] {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    gap: 3px !important;
  }
  .star, .star-filled, .star-empty, [class*="star-icon"] {
    display: inline-block !important;
    font-size: 20px !important;
    line-height: 1 !important;
  }
</style>`
      // Insert right before the first <div to ensure it loads early
      code = code.replace(/(<div)/, `${starFix}\n\$1`)
    }
  }

  // Remove decorative emojis unless specifically requested
  const wantsEmoji = (
    lower.includes('emoji') ||
    lower.includes('icon') ||
    lower.includes('heart') ||
    lower.includes('toast') ||
    lower.includes('notification') ||
    lower.includes('badge')
  )
  if (!wantsEmoji) {
    code = code.replace(/[🚀💎🔒⚡✨🎯🏆💡🔥👑🎨🛡️⚙️📊💰🌐]/gu, '')
  }

  return code
}

// Validates that the model actually returned HTML and not explanation prose
function isValidHTML(code) {
  const t = code.trim()
  return (
    t.startsWith('<') &&
    (
      t.includes('<div')     ||
      t.includes('<style')   ||
      t.includes('<section') ||
      t.includes('<article') ||
      t.includes('<main')
    )
  )
}

const RANDOM_GRADIENTS = [
  'linear-gradient(135deg,#6366f1 0%,#a855f7 50%,#ec4899 100%)',
  'linear-gradient(135deg,#1d4ed8 0%,#3b82f6 50%,#818cf8 100%)',
  'linear-gradient(135deg,#0e7490 0%,#0891b2 50%,#22d3ee 100%)',
  'linear-gradient(135deg,#be123c 0%,#e11d48 50%,#fb7185 100%)',
  'linear-gradient(135deg,#7c2d12 0%,#c2410c 50%,#fb923c 100%)',
  'linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#14b8a6 100%)',
  'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)',
  'linear-gradient(135deg,#831843 0%,#9d174d 50%,#db2777 100%)',
  'linear-gradient(135deg,#14532d 0%,#166534 50%,#16a34a 100%)',
  'linear-gradient(135deg,#292524 0%,#44403c 50%,#78716c 100%)',
]

const COLOR_MAP = {
  green:  'linear-gradient(135deg,#059669 0%,#10b981 50%,#34d399 100%)',
  blue:   'linear-gradient(135deg,#1d4ed8 0%,#3b82f6 50%,#60a5fa 100%)',
  red:    'linear-gradient(135deg,#be123c 0%,#e11d48 50%,#fb7185 100%)',
  orange: 'linear-gradient(135deg,#ea580c 0%,#f59e0b 50%,#fbbf24 100%)',
  purple: 'linear-gradient(135deg,#6d28d9 0%,#7c3aed 50%,#a78bfa 100%)',
  pink:   'linear-gradient(135deg,#be185d 0%,#db2777 50%,#f472b6 100%)',
  dark:   'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%)',
  teal:   'linear-gradient(135deg,#0f766e 0%,#0d9488 50%,#2dd4bf 100%)',
  cyan:   'linear-gradient(135deg,#0e7490 0%,#0891b2 50%,#22d3ee 100%)',
  gold:   'linear-gradient(135deg,#92400e 0%,#b45309 50%,#f59e0b 100%)',
  navy:   'linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 50%,#3b82f6 100%)',
  sunset: 'linear-gradient(135deg,#ea580c 0%,#f59e0b 50%,#fbbf24 100%)',
}

function selectGradient(prompt) {
  const lower = prompt.toLowerCase()
  for (const [color, gradient] of Object.entries(COLOR_MAP)) {
    if (lower.includes(color)) return gradient
  }
  return RANDOM_GRADIENTS[Math.floor(Math.random() * RANDOM_GRADIENTS.length)]
}

function isGlassRequest(prompt) {
  const lower = prompt.toLowerCase()
  return (
    lower.includes('glass') ||
    lower.includes('glassy') ||
    lower.includes('frosted') ||
    lower.includes('translucent') ||
    lower.includes('glassmorphism')
  )
}

const STYLE_NUDGES = [
  'Use bold high-contrast typography with strong visual hierarchy.',
  'Use a minimal layout with generous white space and subtle details.',
  'Use an editorial style with large display typography as the focal point.',
  'Use a detailed layout with comprehensive information shown clearly.',
  'Prioritize clarity and scanability above all else.',
  'Use a premium understated aesthetic with refined spacing.',
  'Make the layout feel spacious and open with breathing room everywhere.',
  'Use a structured grid-like layout with clear visual alignment.',
]

function getStyleNudge() {
  return STYLE_NUDGES[Math.floor(Math.random() * STYLE_NUDGES.length)]
}

function buildSystemPrompt(gradient, includeGlass) {

  const glassSection = includeGlass ? `
GLASSMORPHISM — FOLLOW EXACTLY:
- NEVER use Tailwind classes for glass. Use the CSS classes below only.
- All text inside glass must be color:white or rgba(255,255,255,0.85).
- Gradient for this component: ${gradient} — copy it exactly, do not change it.

FOR A SINGLE GLASS CARD — use this EXACT structure, fill in the content:
<style>
        .g-wrap { background:${gradient}; min-height:100vh; width:max-content; min-width:100%; display:flex; align-items:flex-start; justify-content:center; padding:48px; box-sizing:border-box; }
  .g-card { backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:24px; padding:48px; box-shadow:0 25px 50px rgba(0,0,0,0.3); width:100%; max-width:440px; }
  .g-title { font-size:22px; font-weight:700; color:white; margin:0 0 8px; }
  .g-sub { font-size:14px; color:rgba(255,255,255,0.65); margin:0 0 24px; }
  .g-label { font-size:13px; font-weight:500; color:rgba(255,255,255,0.7); display:block; margin-bottom:6px; }
  .g-input { display:block; width:100%; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.3); border-radius:10px; padding:12px 16px; color:white; font-size:14px; box-sizing:border-box; margin-bottom:16px; }
  .g-btn { display:block; width:100%; background:rgba(255,255,255,0.25); color:white; border:1px solid rgba(255,255,255,0.4); padding:13px 24px; border-radius:12px; cursor:pointer; font-weight:600; font-size:14px; text-align:center; }
  .g-price-row { display:flex; align-items:baseline; gap:2px; margin:12px 0 20px; }
  .g-price-currency { font-size:16px; font-weight:600; color:white; white-space:nowrap; }
  .g-price-amount { font-size:28px; font-weight:700; color:white; white-space:nowrap; line-height:1; }
  .g-price-period { font-size:12px; color:rgba(255,255,255,0.65); white-space:nowrap; margin-left:3px; }
  input::placeholder, textarea::placeholder { color:rgba(255,255,255,0.5); }
</style>
<div class="g-wrap">
  <div class="g-card">
    <!-- YOUR CONTENT HERE. All text: color:white -->
  </div>
</div>

FOR 2 OR MORE GLASS CARDS SIDE BY SIDE — use this EXACT structure:
<style>
  .g-wrap { background:${gradient}; min-height:100vh; width:max-content; min-width:100%; display:flex; align-items:flex-start; justify-content:flex-start; padding:48px; box-sizing:border-box; }
  .g-row { display:flex; flex-direction:row; gap:24px; align-items:stretch; }
  .g-card { backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:24px; padding:32px; box-shadow:0 25px 50px rgba(0,0,0,0.3); width:280px; flex-shrink:0; display:flex; flex-direction:column; }
  .g-title { font-size:18px; font-weight:700; color:white; margin:0 0 6px; }
  .g-sub { font-size:13px; color:rgba(255,255,255,0.65); margin:0 0 20px; }
  .g-price-row { display:flex; align-items:baseline; gap:2px; margin:0 0 16px; }
  .g-price-currency { font-size:15px; font-weight:600; color:white; white-space:nowrap; }
  .g-price-amount { font-size:28px; font-weight:700; color:white; white-space:nowrap; line-height:1; }
  .g-price-period { font-size:12px; color:rgba(255,255,255,0.65); white-space:nowrap; margin-left:3px; }
  .g-features { list-style:none; margin:0 0 20px; padding:0; flex:1; }
  .g-feature { font-size:13px; color:rgba(255,255,255,0.8); padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.1); }
  .g-btn { background:rgba(255,255,255,0.25); color:white; border:1px solid rgba(255,255,255,0.4); padding:12px 20px; border-radius:12px; cursor:pointer; font-weight:600; font-size:13px; width:100%; margin-top:auto; }
  input::placeholder, textarea::placeholder { color:rgba(255,255,255,0.5); }
</style>
<div class="g-wrap">
  <div class="g-row">
    <div class="g-card"><!-- card 1: all text color:white --></div>
    <div class="g-card"><!-- card 2: all text color:white --></div>
    <!-- add more g-card divs as needed -->
  </div>
</div>

Do not nest glass inside glass. Do not add any wrapper outside .g-wrap.
Do not use Tailwind classes anywhere inside glass components.
` : `
NON-GLASS COMPONENTS:
- White card backgrounds (#ffffff), zinc or slate text (#18181b or #3f3f46).
- Define CSS classes in a <style> block for the card, heading, subtext, buttons, etc.
- Padding at least 32px. Shadow: 0 1px 4px rgba(0,0,0,0.08). Border-radius: 16px or 20px.
- Do NOT add any gradient background for non-glass components.
- The card sits on a plain light background — you do not need to add a background at all.
`

  return `You are a world-class Design Engineer. Return ONLY raw HTML for the requested UI component.

CRITICAL OUTPUT FORMAT:
- Your entire response must be valid HTML starting with <style> or <div>.
- Return absolutely nothing else: no explanation, no comments outside the HTML, 
  no markdown, no backticks, no code fences, no "Here is..." text.
- If you cannot generate valid HTML, return <div>Error</div>.

CSS STRUCTURE — ALWAYS DO THIS:
- Begin output with a <style> block containing named CSS classes.
- Use those class names throughout the HTML.
- This allows the tool to split code into separate CSS and HTML tabs.
- Only use inline style="" for one-off values that have no reusable class.

      STAR RATINGS — READ EVERY WORD:
      - NEVER use CSS ::before or ::after pseudo-elements for stars.
      - NEVER use SVG for stars.
      - NEVER use ^ or › or > or any arrow/chevron character for stars.
      - NEVER use separate block-level divs for individual stars.
      - The ONLY allowed star characters are ★ (filled) and ☆ (empty).
      - Stars must ALWAYS be in a single horizontal row, never stacked vertically.
      - When stars are requested, use EXACTLY this pattern in your CSS and HTML:

        In your <style> block:
        .star-row { display:flex; flex-direction:row; flex-wrap:nowrap; align-items:center; gap:3px; margin:10px 0; }
        .star { display:inline-block; font-size:22px; line-height:1; word-break:normal; }
        .star.filled { color:#facc15; }
        .star.empty { color:#d1d5db; }

        In your HTML:
        <div class="star-row">
          <span class="star filled">★</span>
          <span class="star filled">★</span>
          <span class="star filled">★</span>
          <span class="star filled">★</span>
          <span class="star filled">★</span>
        </div>

      - Adjust filled vs empty spans for the requested rating (e.g. 4 stars = 4 filled + 1 empty).
      - Do not wrap each star in its own div. Each star is a <span> only.
      - This rule is enforced by post-processing. Violations will be corrected automatically.
      - NEVER add stars unless the prompt explicitly contains "star", "rating", or "review".

EMOJIS — STRICT BAN:
- Do NOT add decorative emojis to headings, feature lists, card titles, or pricing tiers.
- Do not add 🚀 💎 🔒 ⚡ ✨ 🎯 🏆 💡 🔥 👑 or similar unless explicitly asked for.
- Functional emojis are allowed ONLY when the user specifically requests them.
  Example: "red heart counter button" → ❤️ in that button is appropriate and correct.
- When in doubt: leave emojis out entirely.

PRICE DISPLAY — CRITICAL, PREVENTS BROKEN LAYOUTS:
- Price numbers must NEVER break across lines mid-digit.
- Always use this exact pattern for any monetary value:
  <div class="price-row">
    <span class="price-currency">$</span>
    <span class="price-amount">29</span>
    <span class="price-period">/month</span>
  </div>
- In your <style> block include:
  .price-row { display:flex; align-items:baseline; gap:2px; }
  .price-currency { font-size:15px; font-weight:600; white-space:nowrap; }
  .price-amount { font-size:28px; font-weight:700; white-space:nowrap; line-height:1; }
  .price-period { font-size:12px; white-space:nowrap; margin-left:3px; opacity:0.75; }
- Maximum font-size for any price number is 28px. Never go larger.
- Add white-space:nowrap to EVERY span inside a price row.

BUTTONS:
      - ALL buttons must have white-space:nowrap in their CSS class. No exceptions.
      - ALL buttons must have enough horizontal padding so their label fits on one line.
      - Minimum button padding: padding:10px 20px. Preferred: padding:12px 24px.
      - For buttons inside narrow cards (width under 240px): use font-size:13px and padding:10px 16px.
      - NEVER let a button label wrap to a second line.
      - In your <style> block, every button class must include: white-space:nowrap; word-break:normal; overflow-wrap:normal;

SIDE-BY-SIDE BUTTON GROUPS — REQUIRED:
- When the user asks for buttons "next to each other", "side by side", or lists
  two or more buttons that should appear in the same row, you MUST wrap them:
  <div class="btn-row">
    <button class="btn" id="btn-one">Label 1</button>
    <button class="btn" id="btn-two">Label 2</button>
  </div>
- In your <style> block include:
  .btn-row { display:flex; flex-direction:row; gap:12px; justify-content:center; width:100%; margin:12px 0; }
- NEVER place two sibling buttons as direct children of a column-flex container.

LINKS AND URLS:
- ALL href values must start with https://
- Correct: href="https://www.linkedin.com/in/username"
- Wrong:   href="www.linkedin.com/in/username"
- Always add target="_blank" rel="noopener noreferrer" to every external link.
- LinkedIn button pattern:
  .linkedin-btn { display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; background:#0077b5; border-radius:8px; color:white; text-decoration:none; font-weight:700; font-size:15px; }
  <a href="https://FULL_URL" target="_blank" rel="noopener noreferrer" class="linkedin-btn">in</a>

SIZE SPECIFICATIONS:
- "compact" or "small": padding:16px, font-size:13px, card width ~260px.
- "large" or "spacious": padding:48px, font-size:16px, card width ~480px.
- Pixel value like "600px": use that exact value as the width of the main card.
- "full-width": width:100% on the outer container.
- Avatar: "small"=40px, "medium"=64px, "large"=96px. Default=56px.

TEXT OVERFLOW:
- ALL text elements must have word-break:break-word; overflow-wrap:break-word; in their CSS class.
- Exception: price elements — those use white-space:nowrap instead (see above).
- NEVER set overflow:hidden on any card, wrapper, or container.

AVATARS:
- Never use <img>. Never use any URL.
- Define as a CSS class:
  .avatar { width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg,#818cf8,#6366f1); display:flex; align-items:center; justify-content:center; margin:0 auto; }
- Put uppercase initials inside: <span style="color:white;font-weight:700;font-size:18px;">AB</span>

INTERACTIVE JAVASCRIPT:
- Put all JS in a single <script> tag at the very bottom of your output.
- Give every interactive element a unique id.
- Counter pattern: start at 0, increment on click, update innerHTML immediately.
- Toggle pattern: track boolean state, swap display:block / display:none on click.

MULTIPLE NON-GLASS CARDS SIDE BY SIDE:
- Each card needs a fixed width. Never flex:1.
- 3 cards: width:280px; flex-shrink:0 each.
- 5 cards: width:220px; flex-shrink:0 each.
- Outer wrapper: display:flex; flex-direction:row; gap:24px; width:max-content; min-width:100%; padding:48px;

${glassSection}`
}

function App() {
  const [prompt, setPrompt]               = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [history, setHistory]             = useState([])
  const [activeModel, setActiveModel]     = useState(MODELS[0])

  const generateUI = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    setError('')
    setGeneratedCode('')

    const glassRequest = isGlassRequest(prompt)
    const gradient     = glassRequest ? selectGradient(prompt) : ''
    const styleNudge   = getStyleNudge()
    const systemPrompt = buildSystemPrompt(gradient, glassRequest)

    for (const model of MODELS) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.9,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `Create this UI component: ${prompt}\n\nStyle direction: ${styleNudge}`
              }
            ],
            max_tokens: 1600,
          }),
        })

        if (response.status === 429) {
          console.warn(`${model} rate limited. Trying next...`)
          continue
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          setError(`API error: ${errData?.error?.message || response.statusText}`)
          setLoading(false)
          return
        }

        const data = await response.json()

        if (!data.choices?.[0]?.message?.content) {
          console.warn(`${model} returned empty content. Trying next...`)
          continue
        }

        // Step 1: strip markdown fences and thinking tags
        const cleaned = cleanCode(data.choices[0].message.content)

        // Step 2: validate it is actually HTML
        if (!isValidHTML(cleaned)) {
          console.warn(`${model} returned non-HTML. Trying next...`)
          continue
        }

        // Step 3: post-process to remove anything that violated content rules
        const code = sanitizeOutput(cleaned, prompt)

        setActiveModel(model)
        setGeneratedCode(code)

        setHistory(prev => [
          {
            id: Date.now(),
            prompt,
            code,
            gradient,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
          },
          ...prev
        ])

        setLoading(false)
        return

      } catch (err) {
        console.error(`Error with ${model}:`, err)
        continue
      }
    }

    setError('All models are rate limited. Wait 60 seconds and try again.')
    setLoading(false)
  }

  const handleRestore = (item) => {
    setPrompt(item.prompt)
    setGeneratedCode(item.code)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleClear = () => {
    setPrompt('')
    setGeneratedCode('')
    setError('')
  }

  const modelLabel = activeModel.includes('/')
    ? activeModel.split('/')[1]
    : activeModel

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">

      <header className="border-b border-zinc-200 bg-white px-8 py-5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">
              Component Lab
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Describe a UI component. Watch it appear.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading && (
              <span className="text-xs text-zinc-400 animate-pulse">Generating...</span>
            )}
            <span className="text-xs text-zinc-300 font-mono">{modelLabel}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PromptPanel
          prompt={prompt}
          setPrompt={setPrompt}
          onGenerate={generateUI}
          onClear={handleClear}
          loading={loading}
        />
        <PreviewPanel
          generatedCode={generatedCode}
          loading={loading}
          error={error}
          prompt={prompt}
        />
      </main>

      {history.length > 0 && (
        <>
          <div className="max-w-7xl mx-auto px-8">
            <div className="border-t border-zinc-200" />
          </div>
          <div className="py-8">
            <SessionHistory history={history} onRestore={handleRestore} />
          </div>
        </>
      )}

    </div>
  )
}

export default App