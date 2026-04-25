import { useState, useRef, useEffect } from 'react'
import { getGuestUsage, incrementGuestUsage } from './guestLimit'
import PromptPanel from './components/PromptPanel'
import PreviewPanel from './components/PreviewPanel'
import SessionHistory from './components/SessionHistory'

const MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
]

const SMALL_MODEL_TOKEN_LIMIT = 5500
const CHARS_PER_TOKEN = 4

// ─── Guest Rate Limiting ──────────────────────────────────────────────────────

const GUEST_DAILY_LIMIT = 10 // 10 guest requests per day. generous enough to explore, tight enough to protect your quota



function checkDevMode() {
  try { return localStorage.getItem('cl_dev') === '1' } catch { return false }
}

// ─── Everything below this line is unchanged from your original ───────────────

function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function isRequestTooLarge(status, message) {
  if (status !== 400) return false
  const lower = (message || '').toLowerCase()
  return (
    lower.includes('too large') ||
    lower.includes('tokens per minute') ||
    lower.includes('context length') ||
    lower.includes('reduce your message') ||
    lower.includes('max_tokens') ||
    (lower.includes('token') && lower.includes('limit'))
  )
}

export function cleanCode(raw) {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/```\s*$/gm, '')
    .trim()
}

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
    code = code.replace(/[★☆⭐🌟]/g, '')
    code = code.replace(/<span[^>]*>\s*<\/span>/g, '')
  } else {
    code = code.replace(
      /(<(?:span|div|i)[^>]*class="[^"]*star[^"]*"[^>]*>)\s*\^\s*(<\/)/gi,
      '\$1★\$2'
    )
    code = code.replace(
      /content:\s*["'][\^›»❯>]+["']/gi,
      'content: "★"'
    )
    if (code.includes('star-row') || code.includes('class="stars"')) {
      const starFix = `<style>
  .star-row, .stars, [class*="star-row"], [class*="star-container"] {
    display: flex !important; flex-direction: row !important;
    flex-wrap: nowrap !important; align-items: center !important; gap: 3px !important;
  }
  .star, .star-filled, .star-empty, [class*="star-icon"] {
    display: inline-block !important; font-size: 20px !important; line-height: 1 !important;
  }
</style>`
      code = code.replace(/(<div|<section|<main|<article|<svg)/, `${starFix}\n\$1`)
    }
  }

  const wantsEmoji = (
    lower.includes('emoji') ||
    lower.includes('icon') ||
    lower.includes('heart') ||
    lower.includes('toast') ||
    lower.includes('notification') ||
    lower.includes('badge')
  )
  if (!wantsEmoji) {
    code = code.replace(/[🚀💎🔒⚡✨🎯🏆💡🔥👑🎨🛡️⚙️📊💰🌐🔮⬛✩⛤🚫]/gu, '')
  }

  return code
}

function isValidHTML(code) {
  const t = code.trim()
  return (
    t.startsWith('<') &&
    (
      t.includes('<div')     ||
      t.includes('<style')   ||
      t.includes('<section') ||
      t.includes('<article') ||
      t.includes('<main')    ||
      t.includes('<svg')
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

function isVisualizationRequest(prompt) {
  const lower = prompt.toLowerCase()
  return (
    lower.includes('chart') ||
    lower.includes('wheel') ||
    lower.includes('birth chart') ||
    lower.includes('natal chart') ||
    lower.includes('astro') ||
    lower.includes('zodiac') ||
    lower.includes('horoscope') ||
    lower.includes('pie') ||
    lower.includes('donut') ||
    lower.includes('gauge') ||
    lower.includes('dial') ||
    lower.includes('radar') ||
    lower.includes('graph') ||
    lower.includes('diagram')
  )
}

function isImageRequest(prompt) {
  const lower = prompt.toLowerCase()
  return (
    lower.includes('photo') ||
    lower.includes('image') ||
    lower.includes('hero image') ||
    lower.includes('hero photo') ||
    lower.includes('picture') ||
    lower.includes('thumbnail') ||
    lower.includes('cover') ||
    lower.includes('banner')
  )
}

function isBirthChartRequest(prompt) {
  const lower = prompt.toLowerCase()
  return (
    lower.includes('birth chart') ||
    lower.includes('natal chart') ||
    lower.includes('astrological birth') ||
    lower.includes('zodiac wheel') ||
    (lower.includes('rising sign') && lower.includes('house')) ||
    (lower.includes('ascendant') && lower.includes('midheaven'))
  )
}

function extractBirthChartData(prompt) {
  const signBaseDegs = {
    aries: 0, taurus: 30, gemini: 60, cancer: 90, leo: 120, virgo: 150,
    libra: 180, scorpio: 210, sagittarius: 240, capricorn: 270, aquarius: 300, pisces: 330,
  }
  const planetGlyphs = {
    'Sun': '☉', 'Moon': '☽', 'Mercury': '☿', 'Venus': '♀', 'Mars': '♂',
    'Jupiter': '♃', 'Saturn': '♄', 'Uranus': '♅', 'Neptune': '♆', 'Pluto': '♇',
    'North Node': '☊', 'Lilith': '⚸', 'Ceres': '⚳', 'Chiron': '⚷',
    'Pallas Athena': '⚴', 'Juno': '⚵', 'Vesta': '⚶',
    'Pholus': '⊕', 'Eros': '♡', 'Psyche': 'Ψ',
    'Ascendant': 'AC', 'Rising Sign': 'AC', 'Midheaven': 'MC',
  }
  const signGlyphs = {
    Aries:'♈', Taurus:'♉', Gemini:'♊', Cancer:'♋', Leo:'♌', Virgo:'♍',
    Libra:'♎', Scorpio:'♏', Sagittarius:'♐', Capricorn:'♑', Aquarius:'♒', Pisces:'♓',
  }

  const placements = []
  const lines = prompt.split('\n').map(l =>
    l.replace(/\*\*/g, '').replace(/[★☆⭐🌟🔮⬛✩⛤🚫]/gu, '').trim()
  ).filter(Boolean)

  const signNames = Object.keys(signBaseDegs).join('|')
  const re = new RegExp(
    `^([A-Za-z ()]+?):\\s*(?:[^A-Za-z]*)?\\s*(${signNames})\\s+(\\d{1,3})°(?:(\\d{1,2})')?`,
    'i'
  )

  for (const line of lines) {
    const m = line.match(re)
    if (!m) continue
    let name = m[1].trim().replace(/\s*\(R\)\s*/gi, '').replace(/\s*\(AC\)\s*/gi, '').trim()
    if (name.toLowerCase().startsWith('rising sign')) name = 'Ascendant'
    if (name.toLowerCase().startsWith('midheaven')) name = 'Midheaven'
    const sign = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()
    const deg = parseInt(m[3], 10)
    const min = parseInt(m[4] || '0', 10)
    const absolute = (signBaseDegs[sign.toLowerCase()] || 0) + deg + min / 60
    placements.push({
      name,
      sign,
      glyph: planetGlyphs[name] || signGlyphs[sign] || '•',
      absolute,
      label: `${deg}°${String(min).padStart(2, '0')}'`,
    })
  }
  return placements
}

function buildBirthChartHTML(prompt) {
  const placements = extractBirthChartData(prompt)

  const cx = 260, cy = 260
  const R_OUTER = 240, R_ZODIAC_INNER = 198
  const R_HOUSE_INNER = 158, R_INNER = 118

  const polar = (deg, r) => {
    const rad = (deg - 90) * Math.PI / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const arcPath = (a1, a2, outerR, innerR) => {
    const p1 = polar(a1, outerR), p2 = polar(a2, outerR)
    const p3 = polar(a2, innerR), p4 = polar(a1, innerR)
    const lg = (a2 - a1 > 180) ? 1 : 0
    return [
      `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      `A ${outerR} ${outerR} 0 ${lg} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
      `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${lg} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
      'Z'
    ].join(' ')
  }

  const zodiac = [
    { name:'Aries',       glyph:'♈', start:0 },
    { name:'Taurus',      glyph:'♉', start:30 },
    { name:'Gemini',      glyph:'♊', start:60 },
    { name:'Cancer',      glyph:'♋', start:90 },
    { name:'Leo',         glyph:'♌', start:120 },
    { name:'Virgo',       glyph:'♍', start:150 },
    { name:'Libra',       glyph:'♎', start:180 },
    { name:'Scorpio',     glyph:'♏', start:210 },
    { name:'Sagittarius', glyph:'♐', start:240 },
    { name:'Capricorn',   glyph:'♑', start:270 },
    { name:'Aquarius',    glyph:'♒', start:300 },
    { name:'Pisces',      glyph:'♓', start:330 },
  ]

  const elementColors = {
    Aries:'#3b1a1a', Taurus:'#1a2e1a', Gemini:'#1a1a3b', Cancer:'#1a2a2e',
    Leo:'#2e1a0a', Virgo:'#1a2a1a', Libra:'#2a1a2e', Scorpio:'#1a0a0a',
    Sagittarius:'#2e1a0a', Capricorn:'#1a1a1a', Aquarius:'#0a1a2e', Pisces:'#0a1a2a',
  }

  const zodiacSegments = zodiac.map((z, i) => {
    const fill = elementColors[z.name] || (i % 2 === 0 ? '#1e1b4b' : '#0f172a')
    const d = arcPath(z.start, z.start + 30, R_OUTER, R_ZODIAC_INNER)
    const mid = polar(z.start + 15, (R_OUTER + R_ZODIAC_INNER) / 2)
    return `<path d="${d}" fill="${fill}" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    <text x="${mid.x.toFixed(2)}" y="${mid.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#e2e8f0" font-size="20">${z.glyph}</text>`
  }).join('\n')

  const houseSegments = Array.from({ length: 12 }, (_, i) => {
    const start = i * 30
    const d = arcPath(start, start + 30, R_ZODIAC_INNER, R_HOUSE_INNER)
    const mid = polar(start + 15, (R_ZODIAC_INNER + R_HOUSE_INNER) / 2)
    const divLine = polar(start, R_ZODIAC_INNER)
    const divLineInner = polar(start, R_HOUSE_INNER)
    return `<path d="${d}" fill="${i % 2 === 0 ? '#0c1222' : '#0a0f1c'}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <line x1="${divLine.x.toFixed(2)}" y1="${divLine.y.toFixed(2)}" x2="${divLineInner.x.toFixed(2)}" y2="${divLineInner.y.toFixed(2)}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
    <text x="${mid.x.toFixed(2)}" y="${mid.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#94a3b8" font-size="12">${i + 1}</text>`
  }).join('\n')

  const ticks = Array.from({ length: 72 }, (_, i) => {
    const deg = i * 5
    const isMajor = deg % 30 === 0
    const r1 = polar(deg, R_OUTER - 2)
    const r2 = polar(deg, R_OUTER - (isMajor ? 10 : 5))
    return `<line x1="${r1.x.toFixed(2)}" y1="${r1.y.toFixed(2)}" x2="${r2.x.toFixed(2)}" y2="${r2.y.toFixed(2)}" stroke="rgba(255,255,255,${isMajor ? 0.6 : 0.25})" stroke-width="${isMajor ? 1.5 : 0.8}"/>`
  }).join('\n')

  const sorted = [...placements].sort((a, b) => a.absolute - b.absolute)
  const spread = []
  for (const p of sorted) {
    let angle = p.absolute
    if (spread.length > 0) {
      const prev = spread[spread.length - 1].displayAngle
      if (Math.abs(angle - prev) < 8) angle = prev + 8
    }
    spread.push({ ...p, displayAngle: angle })
  }

  const planetMarks = spread.map((p) => {
    const tickOuter = polar(p.absolute, R_HOUSE_INNER - 2)
    const tickInner = polar(p.absolute, R_HOUSE_INNER - 12)
    const pos = polar(p.displayAngle, R_INNER + 18)
    return `<line x1="${tickOuter.x.toFixed(2)}" y1="${tickOuter.y.toFixed(2)}" x2="${tickInner.x.toFixed(2)}" y2="${tickInner.y.toFixed(2)}" stroke="#94a3b8" stroke-width="1"/>
    <circle cx="${pos.x.toFixed(2)}" cy="${pos.y.toFixed(2)}" r="13" fill="#0f172a" stroke="rgba(148,163,184,0.5)" stroke-width="1"/>
    <text x="${pos.x.toFixed(2)}" y="${(pos.y + 0.5).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#f1f5f9" font-size="12">${p.glyph}</text>`
  }).join('\n')

  const aspectBodies = spread.filter(p =>
    ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Ascendant'].includes(p.name)
  )
  const aspectLines = []
  for (let i = 0; i < aspectBodies.length; i++) {
    for (let j = i + 1; j < aspectBodies.length; j++) {
      const diff = Math.abs(aspectBodies[i].absolute - aspectBodies[j].absolute)
      const norm = Math.min(diff, 360 - diff)
      const isTrine    = Math.abs(norm - 120) < 8
      const isSextile  = Math.abs(norm - 60) < 6
      const isSquare   = Math.abs(norm - 90) < 6
      const isOppose   = Math.abs(norm - 180) < 8
      const isConj     = norm < 8
      if (!isTrine && !isSextile && !isSquare && !isOppose && !isConj) continue
      const color = (isSquare || isOppose)
        ? 'rgba(248,113,113,0.45)'
        : (isTrine || isSextile)
          ? 'rgba(96,165,250,0.45)'
          : 'rgba(250,204,21,0.45)'
      const p1 = polar(aspectBodies[i].absolute, R_INNER - 2)
      const p2 = polar(aspectBodies[j].absolute, R_INNER - 2)
      aspectLines.push(
        `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${color}" stroke-width="1.2"/>`
      )
    }
  }

  const legendHTML = placements.map(p =>
    `<div class="bc-row">
      <span class="bc-glyph">${p.glyph}</span>
      <span class="bc-name">${p.name}</span>
      <span class="bc-pos">${p.sign} ${p.label}</span>
    </div>`
  ).join('')

  return `<style>
  .bc-wrap { width:100%; display:flex; justify-content:center; padding:20px; box-sizing:border-box; background:#070d1a; min-height:100vh; }
  .bc-card { width:100%; max-width:1000px; background:#0b1120; border-radius:20px; padding:24px; box-sizing:border-box; color:white; }
  .bc-title { font-size:22px; font-weight:700; color:white; margin:0 0 4px; line-height:1.4; word-break:break-word; overflow-wrap:break-word; }
  .bc-sub { font-size:13px; color:rgba(255,255,255,0.6); margin:0 0 20px; line-height:1.5; word-break:break-word; overflow-wrap:break-word; }
  .bc-layout { display:grid; grid-template-columns:minmax(0,560px) minmax(220px,1fr); gap:20px; align-items:start; }
  .bc-svg-box { background:radial-gradient(circle at 50% 50%,#0f1f3d 0%,#070d1a 70%); border-radius:16px; display:flex; justify-content:center; align-items:center; padding:12px; box-sizing:border-box; }
  .bc-legend { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:14px; box-sizing:border-box; }
  .bc-legend-title { font-size:13px; font-weight:700; color:#94a3b8; margin:0 0 10px; text-transform:uppercase; letter-spacing:0.06em; line-height:1.5; word-break:break-word; overflow-wrap:break-word; }
  .bc-row { display:flex; align-items:baseline; gap:6px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06); line-height:1.5; word-break:break-word; overflow-wrap:break-word; }
  .bc-glyph { width:18px; flex-shrink:0; font-size:14px; color:#e2e8f0; }
  .bc-name { flex:1; font-size:12px; color:rgba(255,255,255,0.8); word-break:break-word; overflow-wrap:break-word; }
  .bc-pos { font-size:11px; color:#64748b; white-space:nowrap; }
  @media(max-width:820px){.bc-layout{grid-template-columns:1fr}}
</style>
<div class="bc-wrap">
  <div class="bc-card">
    <h2 class="bc-title">Astrological Birth Chart</h2>
    <p class="bc-sub">Planets placed by exact degree from prompt data • Aspect lines: blue = trine/sextile, red = square/opposition, yellow = conjunction</p>
    <div class="bc-layout">
      <div class="bc-svg-box">
        <svg viewBox="0 0 520 520" width="520" height="520" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#0f1f3d"/>
              <stop offset="100%" stop-color="#070d1a"/>
            </radialGradient>
          </defs>
          <circle cx="${cx}" cy="${cy}" r="${R_OUTER + 4}" fill="url(#bg)"/>
          ${ticks}
          ${zodiacSegments}
          ${houseSegments}
          <circle cx="${cx}" cy="${cy}" r="${R_INNER}" fill="#07101f" stroke="rgba(148,163,184,0.2)" stroke-width="1.5"/>
          ${aspectLines.join('\n')}
          ${planetMarks}
          <circle cx="${cx}" cy="${cy}" r="6" fill="#e2e8f0"/>
          <text x="${cx}" y="${cy - 16}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="13" font-weight="600">Birth Chart</text>
        </svg>
      </div>
      <div class="bc-legend">
        <p class="bc-legend-title">Placements</p>
        ${legendHTML}
      </div>
    </div>
  </div>
</div>`
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

function buildSystemPrompt(gradient, includeGlass, includeVisualization, includeImages) {
  const glassSection = includeGlass ? `
GLASSMORPHISM — FOLLOW EXACTLY:
- NEVER use Tailwind for glass. Use only the CSS classes below.
- Gradient: ${gradient} — copy exactly.

SINGLE GLASS CARD:
<style>
  .g-wrap { background:${gradient}; min-height:100vh; width:max-content; min-width:100%; display:flex; align-items:flex-start; justify-content:center; padding:48px; box-sizing:border-box; }
  .g-card { backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:24px; padding:48px; box-shadow:0 25px 50px rgba(0,0,0,0.3); width:100%; max-width:480px; min-width:320px; box-sizing:border-box; position:relative; z-index:1; }
  .g-title { font-size:22px; font-weight:700; color:white; margin:0 0 8px; line-height:1.3; word-break:break-word; overflow-wrap:break-word; }
  .g-sub { font-size:14px; color:rgba(255,255,255,0.75); margin:0 0 24px; line-height:1.5; word-break:break-word; overflow-wrap:break-word; }
  .g-label { font-size:13px; font-weight:500; color:rgba(255,255,255,0.8); display:block; margin-bottom:6px; line-height:1.5; }
  .g-input { display:block; width:100%; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.35); border-radius:10px; padding:12px 16px; color:white; font-size:14px; box-sizing:border-box; margin-bottom:16px; }
  .g-btn { display:block; width:100%; background:rgba(255,255,255,0.25); color:white; border:1px solid rgba(255,255,255,0.45); padding:13px 24px; border-radius:12px; cursor:pointer; font-weight:600; font-size:14px; text-align:center; white-space:nowrap; word-break:normal; overflow-wrap:normal; box-sizing:border-box; }
  .g-price-row { display:flex; flex-direction:row; align-items:baseline; gap:2px; margin:12px 0 20px; flex-wrap:nowrap; }
  .g-price-currency { font-size:16px; font-weight:600; color:white; white-space:nowrap; }
  .g-price-amount { font-size:28px; font-weight:700; color:white; white-space:nowrap; line-height:1; }
  .g-price-period { font-size:12px; color:rgba(255,255,255,0.7); white-space:nowrap; margin-left:3px; }
  .g-feature { font-size:13px; color:rgba(255,255,255,0.85); padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.12); word-break:break-word; overflow-wrap:break-word; line-height:1.5; }
  input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.55); }
</style>
<div class="g-wrap"><div class="g-card"><!-- content here --></div></div>

MULTIPLE GLASS CARDS SIDE BY SIDE:
<style>
  .g-wrap { background:${gradient}; min-height:100vh; width:max-content; min-width:100%; display:flex; align-items:flex-start; justify-content:flex-start; padding:48px; box-sizing:border-box; }
  .g-row { display:flex; flex-direction:row; gap:24px; align-items:stretch; }
  .g-card { backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:24px; padding:32px; box-shadow:0 25px 50px rgba(0,0,0,0.3); width:280px; min-width:240px; flex-shrink:0; display:flex; flex-direction:column; box-sizing:border-box; position:relative; z-index:1; }
  .g-title { font-size:18px; font-weight:700; color:white; margin:0 0 6px; line-height:1.3; word-break:break-word; overflow-wrap:break-word; }
  .g-sub { font-size:13px; color:rgba(255,255,255,0.75); margin:0 0 20px; line-height:1.5; word-break:break-word; overflow-wrap:break-word; }
  .g-price-row { display:flex; flex-direction:row; align-items:baseline; gap:2px; margin:0 0 16px; flex-wrap:nowrap; }
  .g-price-currency { font-size:15px; font-weight:600; color:white; white-space:nowrap; }
  .g-price-amount { font-size:28px; font-weight:700; color:white; white-space:nowrap; line-height:1; }
  .g-price-period { font-size:12px; color:rgba(255,255,255,0.7); white-space:nowrap; margin-left:3px; }
  .g-features { list-style:none; margin:0 0 20px; padding:0; flex:1; }
  .g-feature { font-size:13px; color:rgba(255,255,255,0.85); padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.12); word-break:break-word; overflow-wrap:break-word; line-height:1.5; }
  .g-btn { background:rgba(255,255,255,0.25); color:white; border:1px solid rgba(255,255,255,0.45); padding:12px 20px; border-radius:12px; cursor:pointer; font-weight:600; font-size:13px; width:100%; margin-top:auto; white-space:nowrap; word-break:normal; overflow-wrap:normal; box-sizing:border-box; }
  input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.55); }
</style>
<div class="g-wrap"><div class="g-row"><div class="g-card"><!-- card 1 --></div><div class="g-card"><!-- card 2 --></div></div></div>

Do not nest glass inside glass. No Tailwind in glass components.
` : `
NON-GLASS COMPONENTS:
- White backgrounds (#ffffff). Text: #18181b or #3f3f46. Never white text on white background.
- All styles in a <style> block as named CSS classes.
- Cards: box-sizing:border-box; position:relative; overflow:visible; padding min 32px; border-radius:16px; box-shadow:0 1px 4px rgba(0,0,0,0.08);
- No gradient or colored background wrapper for non-glass components.
- Single card: center it with <div style="display:flex;justify-content:center;align-items:flex-start;width:100%;">
`

  const imageSection = includeImages ? `
IMAGES:
- Use https://picsum.photos/seed/KEYWORD/WIDTH/HEIGHT for all photos.
- Always include alt text, width:100%, height:100%, object-fit:cover, display:block.
- Hero image: height:220px. Thumbnails side by side: height:180px.
- NEVER use placeholder.com, fake filenames, or empty src attributes.
` : ''

  const visualizationSection = includeVisualization ? `
SVG CHARTS AND VISUALIZATIONS:
- Use inline SVG. Never fake charts with CSS circles or decorative geometry.
- viewBox="0 0 500 500" width="500" height="500"
- Plot data from the exact values in the prompt — do not invent positions.
- For pie/donut: use arc paths. For gauges: use semicircle arcs.
- For astrological wheels: Aries=0°, each sign adds 30°. Plot planets at their exact degree.
` : ''

  return `You are a world-class Design Engineer. Return ONLY raw HTML.

OUTPUT FORMAT — CRITICAL:
- Start with <style> or <div> or <svg>. Nothing before it.
- No explanation, no markdown, no backticks, no code fences, no "Here is..." text.
- If you cannot produce valid HTML return exactly: <div>Error</div>

CSS:
- Always begin with a <style> block of named CSS classes.
- Use class names throughout. Only inline style="" for one-off values.

TEXT:
- Every text CSS class: word-break:break-word; overflow-wrap:break-word; line-height:1.5;
- Never overflow:hidden on cards. Cards grow vertically.
- Dark text on light bg (#18181b). White text on dark bg. Never invisible text.

CARDS:
- Single card: min-width 320px, preferred 380px. box-sizing:border-box.
- Multi-card row cards: min-width 240px, preferred 280px.
- Every card: position:relative; z-index:1;
- Single card centering: wrap in display:flex;justify-content:center;
- Multi-card rows: display:flex;flex-direction:row;gap:24px;width:max-content;min-width:100%;padding:48px;

PRICES:
- .price-row{display:flex;flex-direction:row;align-items:baseline;gap:2px;flex-wrap:nowrap;}
- .price-amount{font-size:28px;font-weight:700;white-space:nowrap;line-height:1;}
- Never larger than 28px. Always white-space:nowrap.

BUTTONS:
- white-space:nowrap; word-break:normal; overflow-wrap:normal;
- Padding: 12px 24px min. Labels never wrap.
- Two buttons side by side: wrap in .btn-row{display:flex;flex-direction:row;gap:12px;}

STARS:
- Only ★ and ☆ in <span> elements. Never SVG or pseudo-elements for stars.
- .star-row{display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:3px;}
- NEVER add stars unless the prompt says "star", "rating", or "review".

EMOJIS: Banned unless user explicitly requests them.

LINKS: All href must start https://. Add target="_blank" rel="noopener noreferrer".

AVATARS: Never <img>. Use gradient circle div with initials span.

JAVASCRIPT: Single <script> at bottom. Unique ids on all interactive elements.

BANNED:
- writing-mode, text-orientation, transform:rotate on text — ALL BANNED.
- Vertical text of any kind.

${imageSection}
${visualizationSection}
${glassSection}`
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [prompt, setPrompt]               = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [history, setHistory]             = useState([])
  const [activeModel, setActiveModel]     = useState(MODELS[0])
  const [devMode, setDevMode]             = useState(checkDevMode)
const [guestUsage, setGuestUsage]       = useState({ count: 0, date: new Date().toDateString() })

// Load real usage from Firebase on mount
useEffect(() => {
  if (!devMode) {
    getGuestUsage().then(setGuestUsage)
  }
}, [devMode])

  // Hidden dev-mode unlock: click the title 5 times within 2 seconds
  const titleClickCount = useRef(0)
  const titleClickTimer = useRef(null)

  const handleTitleClick = () => {
    titleClickCount.current += 1
    clearTimeout(titleClickTimer.current)

    if (titleClickCount.current >= 5) {
      titleClickCount.current = 0
      const devPassword = import.meta.env.VITE_DEV_PASSWORD
      if (!devPassword) return // not configured — silently ignore
      const input = window.prompt('Developer access code:')
      if (input && input === devPassword) {
        try { localStorage.setItem('cl_dev', '1') } catch {}
        setDevMode(true)
      }
      return
    }

    titleClickTimer.current = setTimeout(() => {
      titleClickCount.current = 0
    }, 2000)
  }

  // Called once per successful generation to tick the guest counter
  const recordGeneration = async () => {
  if (devMode) return
  const updated = await incrementGuestUsage()
  if (updated) setGuestUsage(updated)
}

  const generateUI = async () => {
    if (!prompt.trim()) return

    // ── Guest rate-limit gate ──────────────────────────────────────────────
    if (!devMode) {
  const usage = await getGuestUsage()
  if (usage.count >= GUEST_DAILY_LIMIT) {
        setError(
          `You've used all ${GUEST_DAILY_LIMIT} demo generations for today. ` +
          `Resets at midnight — or feel free to reach out if you'd like to see more!`
          `If you're tempted to bypass this limit, consider that it's in place to prevent abuse and ensure fair access for everyone. Thanks for understanding!`
        )
        return
      }
    }

    setLoading(true)
    setError('')
    setGeneratedCode('')

    // Birth chart requests are handled entirely locally — no API call needed.
    // This completely bypasses all token limits for birth chart prompts.
    if (isBirthChartRequest(prompt)) {
      try {
        const birthChartHTML = buildBirthChartHTML(prompt)
        setGeneratedCode(birthChartHTML)
        setActiveModel('local-renderer')
        setHistory(prev => [
          {
            id: Date.now(),
            prompt,
            code: birthChartHTML,
            gradient: '',
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
          },
          ...prev
        ])
        await recordGeneration()
        setLoading(false)
        return
      } catch (err) {
        console.error('Local birth chart renderer failed, falling through to API:', err)
      }
    }

    const glassRequest         = isGlassRequest(prompt)
    const gradient             = glassRequest ? selectGradient(prompt) : ''
    const styleNudge           = getStyleNudge()
    const visualizationRequest = isVisualizationRequest(prompt)
    const imageRequest         = isImageRequest(prompt)
    const systemPrompt         = buildSystemPrompt(
      gradient,
      glassRequest,
      visualizationRequest,
      imageRequest
    )

    const userMessage = `Create this UI component: ${prompt}\n\nStyle direction: ${styleNudge}`

    const estimatedTokens = estimateTokens(systemPrompt + userMessage)

    const modelsToTry = MODELS.filter(model => {
      if (model === 'llama-3.1-8b-instant') {
        return estimatedTokens < SMALL_MODEL_TOKEN_LIMIT
      }
      return true
    })

    const finalModels = modelsToTry.length > 0 ? modelsToTry : MODELS.slice(1)

    for (const model of finalModels) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.7,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: userMessage  }
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
          const errMsg  = errData?.error?.message || response.statusText || ''

          if (isRequestTooLarge(response.status, errMsg)) {
            console.warn(`${model} request too large. Trying next...`)
            continue
          }

          console.warn(`${model} error ${response.status}: ${errMsg}. Trying next...`)
          continue
        }

        const data = await response.json()

        if (!data.choices?.[0]?.message?.content) {
          console.warn(`${model} returned empty content. Trying next...`)
          continue
        }

        const cleaned = cleanCode(data.choices[0].message.content)

        if (!isValidHTML(cleaned)) {
          console.warn(`${model} returned non-HTML. Trying next...`)
          continue
        }

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

        recordGeneration()
        setLoading(false)
        return

      } catch (err) {
        console.error(`Error with ${model}:`, err)
        continue
      }
    }

    setError('All models were rate limited or returned invalid output. Wait 60 seconds and try again.')
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

  const generationsLeft = Math.max(0, GUEST_DAILY_LIMIT - guestUsage.count)

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">

      <header className="border-b border-zinc-200 bg-white px-8 py-5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            {/* Clicking the title 5× within 2s opens the dev-mode password prompt */}
            <h1
              className="text-lg font-semibold text-zinc-900 tracking-tight cursor-default select-none"
              onClick={handleTitleClick}
            >
              Website Design AI Component Lab
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Describe a UI component. Watch it appear.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {loading && (
              <span className="text-xs text-zinc-400 animate-pulse">Generating...</span>
            )}

            {/* Guest usage pill — hidden in dev mode */}
            {!devMode && (
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  generationsLeft <= 2
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-zinc-100 text-zinc-500'
                }`}
                title="Demo generations remaining today"
              >
                {generationsLeft} / {GUEST_DAILY_LIMIT} left today
              </span>
            )}

            {/* Dev mode badge */}
            {devMode && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-200 font-medium">
                Dev mode
              </span>
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