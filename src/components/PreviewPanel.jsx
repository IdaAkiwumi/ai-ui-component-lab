import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingShimmer from './LoadingShimmer'
import { cleanCode } from '../App'

function isGlassComponent(code) {
  return (
    code.includes('backdrop-filter') ||
    code.includes('-webkit-backdrop-filter') ||
    code.includes('rgba(255,255,255,0.') ||
    code.includes('rgba(255, 255, 255, 0.')
  )
}

function fixLinks(code) {
  let fixed = code.replace(
    /href="(?!https?:\/\/|mailto:|tel:|#|\/|javascript:)([^"]+)"/g,
    'href="https://\$1"'
  )
  fixed = fixed.replace(
    /href="(https?:\/\/[^"]+)"(?![^>]*target=)/g,
    'href="\$1" target="_blank" rel="noopener noreferrer"'
  )
  return fixed
}

function splitCode(raw) {
  // Always clean first so code tabs never show markdown fences
  const code = cleanCode(raw)
  const cssBlocks = []
  const jsBlocks  = []

  const stylePattern = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let m
  while ((m = stylePattern.exec(code)) !== null) {
    if (m[1].trim()) cssBlocks.push(m[1].trim())
  }

  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi
  while ((m = scriptPattern.exec(code)) !== null) {
    if (m[1].trim()) jsBlocks.push(m[1].trim())
  }

  // HTML tab keeps <style> so CSS class names still resolve visually
  // Only <script> is removed — the result is still fully styled
  const htmlWithStyles = code
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // CSS tab: use <style> block content if present
  // Fallback: parse and format inline style attributes
  let cssOnly
  if (cssBlocks.length > 0) {
    cssOnly = cssBlocks.join('\n\n')
  } else {
    const inlineStyles = []
    const elPattern = /<(\w+)[^>]*\sstyle="([^"]+)"[^>]*>/g
    let idx = 0
    while ((m = elPattern.exec(code)) !== null) {
      idx++
      const declarations = m[2]
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => `  ${s};`)
        .join('\n')
      inlineStyles.push(`/* <${m[1]}> element ${idx} */\n${declarations}`)
    }
    cssOnly = inlineStyles.length > 0
      ? `/* Inline styles extracted — no <style> block found */\n/* Tip: request a "styled" component to get named CSS classes */\n\n${inlineStyles.join('\n\n')}`
      : `/* No CSS found in this component */`
  }

  const jsOnly = jsBlocks.length > 0
    ? jsBlocks.join('\n\n')
    : `// No JavaScript in this component.\n// Tip: describe interactions like:\n// "counter that increments on click"\n// "button that toggles content"`

  return { full: code, html: htmlWithStyles, css: cssOnly, js: jsOnly }
}

export function buildIframeDoc(code, isThumb = false) {
  const cleaned = cleanCode(code)
  const fixed   = fixLinks(cleaned)
  const isGlass = isGlassComponent(cleaned)

  const bodyStyle = isGlass
    ? `
        margin: 0;
        padding: 0;
        min-height: 100vh;
        min-width: 100%;
        overflow-x: auto;
        overflow-y: auto;
      `
    : isThumb
      ? `
          margin: 0;
          padding: 8px;
          background: #f4f4f5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          box-sizing: border-box;
          overflow: hidden;
        `
      : `
          margin: 0;
          padding: 40px;
          background: #f4f4f5;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          min-height: 100vh;
          box-sizing: border-box;
          overflow-x: auto;
          overflow-y: auto;
        `

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
    <style>
      * {
        font-family: 'Inter', system-ui, sans-serif;
        box-sizing: border-box;
        word-break: break-word;
        overflow-wrap: break-word;
      }

      body { ${bodyStyle} }

      /* Glass wrapper: align to top so tall content scrolls from the start
         instead of being clipped at the top when taller than the viewport */
      .g-wrap {
        align-items: flex-start !important;
        padding-top: 48px !important;
        padding-bottom: 48px !important;
      }

      h1,h2,h3,h4,h5,h6,p,span,li,td,th {
        max-width: 100%;
        word-break: break-word;
        overflow-wrap: break-word;
      }

      /* Buttons must NEVER wrap text regardless of global word-break */
      button,
      input[type="button"],
      input[type="submit"],
      a.g-btn,
      a.btn,
      .g-btn,
      .btn {
        white-space: nowrap !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }

      /* Price elements must never split mid-number */
      .price-row,
      .price-amount,
      .price-currency,
      .price-period,
      .g-price-row,
      .g-price-amount,
      .g-price-currency,
      .g-price-period {
        white-space: nowrap !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }

      /* Stars must always render as a horizontal row
         This overrides any model that stacks them vertically */
      .star-row,
      .stars,
      .rating,
      [class*="star-row"],
      [class*="star-container"],
      [class*="star-rating"] {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 3px !important;
      }

      /* Each individual star must be inline, not block */
      .star,
      .star-filled,
      .star-empty,
      [class*="star-icon"],
      [class*="star-item"] {
        display: inline-block !important;
        font-size: 20px !important;
        line-height: 1 !important;
        word-break: normal !important;
      }

      ${isGlass ? `
        input::placeholder,
        textarea::placeholder,
        select::placeholder {
          color: rgba(255,255,255,0.55) !important;
        }
        input, textarea, select { color: white; }
      ` : `
        input::placeholder,
        textarea::placeholder { color: #9ca3af; }
      `}

      ::-webkit-scrollbar { height: 6px; width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.35); }
    </style>
  </head>
  <body>${fixed}</body>
</html>`
}

const CODE_TABS = [
  {
    key:   'full',
    label: 'Full',
    desc:  'Complete output as generated. Paste into any .html file and it works immediately.'
  },
  {
    key:   'html',
    label: 'HTML',
    desc:  'Markup and styles. JavaScript removed. Still visually correct — safe to copy into a project.'
  },
  {
    key:   'css',
    label: 'CSS',
    desc:  'Styles only. Extracted from <style> blocks, or inline styles as a fallback.'
  },
  {
    key:   'js',
    label: 'JS',
    desc:  'JavaScript only. Extracted from <script> blocks.'
  },
]

function PreviewPanel({ generatedCode, loading, error }) {
  const [view,       setView]       = useState('preview')
  const [codeTab,    setCodeTab]    = useState('full')
  const [copied,     setCopied]     = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const parts      = generatedCode ? splitCode(generatedCode) : null
  const activeCode = parts ? (parts[codeTab] || '') : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    // buildIframeDoc runs cleanCode internally
    // so the downloaded file never contains markdown fences
    const blob = new Blob([buildIframeDoc(generatedCode)], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `component-${Date.now()}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col"
    >

      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <span className="text-sm font-medium text-zinc-700">Output</span>

        {generatedCode && (
          <div className="flex items-center gap-2">

            <button
              onClick={handleDownload}
              className="text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1.5
                         rounded-lg hover:bg-zinc-100 transition-all duration-150 font-medium"
            >
              {downloaded ? '✓ Saved' : 'DOWNLOAD HTML FILE'}
            </button>

            <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
              <button
                onClick={() => setView('preview')}
                className={`text-xs px-3 py-1.5 rounded-md transition-all duration-150 font-medium
                  ${view === 'preview'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Preview
              </button>
              <button
                onClick={() => setView('code')}
                className={`text-xs px-3 py-1.5 rounded-md transition-all duration-150 font-medium
                  ${view === 'code'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Code
              </button>
            </div>

          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 p-6 min-h-96">

        {loading && <LoadingShimmer />}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <p className="text-xs text-zinc-400 max-w-xs">
              Rate limits reset every 60 seconds. The app tries all available
              models automatically before showing this message.
            </p>
          </div>
        )}

        {!loading && !error && !generatedCode && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl">
              ✦
            </div>
            <p className="text-sm text-zinc-400 max-w-xs">
              Your generated component will appear here. Describe it on the left.
            </p>
          </div>
        )}

        <AnimatePresence>
          {!loading && generatedCode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="h-full flex flex-col gap-4"
            >

              {/* PREVIEW */}
              {/* allow-popups is required for LinkedIn and other external links
                  to open in a new tab from inside the sandboxed iframe */}
              {view === 'preview' && (
                <iframe
                  srcDoc={buildIframeDoc(generatedCode)}
                  title="Component Preview"
                  className="w-full rounded-xl border border-zinc-100"
                  style={{ height: '520px', border: 'none' }}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  scrolling="yes"
                />
              )}

              {/* CODE */}
              {view === 'code' && parts && (
                <div className="flex flex-col gap-3">

                  {/* TAB SWITCHER */}
                  <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1 w-fit">
                    {CODE_TABS.map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => { setCodeTab(tab.key); setCopied(false) }}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-150 font-medium
                          ${codeTab === tab.key
                            ? 'bg-white text-zinc-900 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-700'}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* DESCRIPTION */}
                  <p className="text-xs text-zinc-400">
                    {CODE_TABS.find(t => t.key === codeTab)?.desc}
                  </p>

                  {/* CODE BLOCK */}
                  <div className="relative">
                    <pre className="bg-zinc-950 text-zinc-300 rounded-xl p-4 text-xs
                                    overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed
                                    max-h-96 overflow-y-auto">
                      {activeCode}
                    </pre>
                    <button
                      onClick={handleCopy}
                      className="absolute top-3 right-3 bg-zinc-800 hover:bg-zinc-700
                                 text-zinc-300 text-xs px-3 py-1.5 rounded-lg
                                 transition-all duration-150 font-medium"
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>

                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  )
}

export default PreviewPanel