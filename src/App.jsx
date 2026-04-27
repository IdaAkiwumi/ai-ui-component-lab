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
const GUEST_DAILY_LIMIT = 10

function checkDevMode() {
  try { return localStorage.getItem('cl_dev') === '1' } catch { return false }
}
function estimateTokens(text) { return Math.ceil(text.length / CHARS_PER_TOKEN) }

function isRequestTooLarge(status, message) {
  if (status !== 400) return false
  const lower = (message || '').toLowerCase()
  return lower.includes('too large') || lower.includes('tokens per minute') ||
    lower.includes('context length') || lower.includes('reduce your message') ||
    lower.includes('max_tokens') || (lower.includes('token') && lower.includes('limit'))
}


function Footer() {
  return (
    <footer style={{
      width: '100%',
      padding: '24px 24px',
      textAlign: 'center',
      borderTop: '1px solid #e4e4e7',
      marginTop: '32px',
      backgroundColor: '#ffffff',
      fontFamily: 'sans-serif',
    }}>
      <p style={{
        margin: '0 0 6px',
        fontSize: '13px',
        fontWeight: '700',
        color: '#18181b',
        letterSpacing: '0.01em',
      }}>
        Built by{' '}
        <a
          href="https://idaakiwumi.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#0a66c2',
            textDecoration: 'none',
          }}
          onMouseEnter={e => e.target.style.textDecoration = 'underline'}
          onMouseLeave={e => e.target.style.textDecoration = 'none'}
        >
          Ida Akiwumi
        </a>
      </p>
      <p style={{
        margin: '0 0 4px',
        fontSize: '12px',
        color: '#18181b',
        fontWeight: '600',
        lineHeight: '1.7',
        maxWidth: '580px',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        Creative Technologist · AI Frontend Engineer · Design Engineer
      </p>
      <p style={{
        margin: '0 0 14px',
        fontSize: '12px',
        color: '#52525b',
        lineHeight: '1.7',
        maxWidth: '580px',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        Specializing in AI integration and production-grade React — open to roles in{' '}
        <span style={{ color: '#18181b', fontWeight: '600' }}>
          healthcare tech, entertainment, EdTech, and media
        </span>
        .
      </p>
      <a
        href="https://www.linkedin.com/in/idaa11"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#0a66c2',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: '600',
          padding: '8px 18px',
          borderRadius: '20px',
          textDecoration: 'none',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = '#004182'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(10,102,194,0.25)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = '#0a66c2'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        Let's connect on LinkedIn
      </a>
    </footer>
  )
}


export function cleanCode(raw) {
  if (!raw) return ''
  return raw.trim()
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/```\s*$/gm, '')
    .trim()
}

export function sanitizeOutput(code, prompt) {
  if (!code) return code
  const lower = prompt.toLowerCase()
  const wantsStars = lower.includes('star') || lower.includes('rating') || lower.includes('review') || lower.includes('score')
  if (!wantsStars) {
    code = code.replace(/[★☆⭐🌟]/g, '')
    code = code.replace(/<span[^>]*>\s*<\/span>/g, '')
  }
  const wantsEmoji = lower.includes('emoji') || lower.includes('icon') || lower.includes('heart') || lower.includes('toast') || lower.includes('notification') || lower.includes('badge')
  if (!wantsEmoji) {
    code = code.replace(/[🚀💎🔒⚡✨🎯🏆💡🔥👑🎨🛡️⚙️📊💰🌐🔮⬛✩⛤🚫]/gu, '')
  }
  return code
}

function isValidHTML(code) {
  const t = code.trim()
  return t.startsWith('<') && (t.includes('<div') || t.includes('<style') || t.includes('<section') || t.includes('<article') || t.includes('<main') || t.includes('<svg'))
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
  green: 'linear-gradient(135deg,#059669 0%,#10b981 50%,#34d399 100%)',
  blue: 'linear-gradient(135deg,#1d4ed8 0%,#3b82f6 50%,#60a5fa 100%)',
  red: 'linear-gradient(135deg,#be123c 0%,#e11d48 50%,#fb7185 100%)',
  orange: 'linear-gradient(135deg,#ea580c 0%,#f59e0b 50%,#fbbf24 100%)',
  purple: 'linear-gradient(135deg,#6d28d9 0%,#7c3aed 50%,#a78bfa 100%)',
  pink: 'linear-gradient(135deg,#be185d 0%,#db2777 50%,#f472b6 100%)',
  dark: 'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%)',
  teal: 'linear-gradient(135deg,#0f766e 0%,#0d9488 50%,#2dd4bf 100%)',
  cyan: 'linear-gradient(135deg,#0e7490 0%,#0891b2 50%,#22d3ee 100%)',
  gold: 'linear-gradient(135deg,#92400e 0%,#b45309 50%,#f59e0b 100%)',
  navy: 'linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 50%,#3b82f6 100%)',
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
  return lower.includes('glass') || lower.includes('glassy') || lower.includes('frosted') || lower.includes('translucent') || lower.includes('glassmorphism')
}

function isVisualizationRequest(prompt) {
  const lower = prompt.toLowerCase()
  return lower.includes('chart') || lower.includes('wheel') || lower.includes('birth chart') || lower.includes('natal chart') || lower.includes('astro') || lower.includes('zodiac') || lower.includes('horoscope') || lower.includes('pie') || lower.includes('donut') || lower.includes('gauge') || lower.includes('dial') || lower.includes('radar') || lower.includes('graph') || lower.includes('diagram')
}

function isImageRequest(prompt) {
  const lower = prompt.toLowerCase()
  return lower.includes('photo') || lower.includes('image') || lower.includes('hero image') || lower.includes('hero photo') || lower.includes('picture') || lower.includes('thumbnail') || lower.includes('cover') || lower.includes('banner')
}

function isBirthChartRequest(prompt) {
  const lower = prompt.toLowerCase()
  return lower.includes('birth chart') || lower.includes('natal chart') || lower.includes('astrological birth') || lower.includes('zodiac wheel') || (lower.includes('rising sign') && lower.includes('house')) || (lower.includes('ascendant') && lower.includes('midheaven'))
}


// ─── Birth Chart Constants ────────────────────────────────────────────────────

const SIGN_BASE_DEGS = {
  aries: 0, taurus: 30, gemini: 60, cancer: 90, leo: 120, virgo: 150,
  libra: 180, scorpio: 210, sagittarius: 240, capricorn: 270, aquarius: 300, pisces: 330,
}
const ZODIAC_ORDER = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
const PLANET_GLYPHS = {
  'Sun':'☉','Moon':'☽','Mercury':'☿','Venus':'♀','Mars':'♂','Jupiter':'♃','Saturn':'♄',
  'Uranus':'♅','Neptune':'♆','Pluto':'♇','North Node':'☊','South Node':'☋','Lilith':'⚸',
  'Ceres':'⚳','Chiron':'⚷','Pallas Athena':'⚴','Juno':'⚵','Vesta':'⚶',
  'Pholus':'⊗','Eros':'♡','Psyche':'⊕','Ascendant':'AC','Midheaven':'MC',
}
const SIGN_GLYPHS = {
  Aries:'♈',Taurus:'♉',Gemini:'♊',Cancer:'♋',Leo:'♌',Virgo:'♍',
  Libra:'♎',Scorpio:'♏',Sagittarius:'♐',Capricorn:'♑',Aquarius:'♒',Pisces:'♓',
}
const SIGN_ELEMENTS = {
  Aries:'Fire',Leo:'Fire',Sagittarius:'Fire',
  Taurus:'Earth',Virgo:'Earth',Capricorn:'Earth',
  Gemini:'Air',Libra:'Air',Aquarius:'Air',
  Cancer:'Water',Scorpio:'Water',Pisces:'Water',
}
const SIGN_MODALITIES = {
  Aries:'Cardinal',Cancer:'Cardinal',Libra:'Cardinal',Capricorn:'Cardinal',
  Taurus:'Fixed',Leo:'Fixed',Scorpio:'Fixed',Aquarius:'Fixed',
  Gemini:'Mutable',Virgo:'Mutable',Sagittarius:'Mutable',Pisces:'Mutable',
}
const OUTER_BODIES = new Set(['Lilith','Ceres','Pallas Athena','Juno','Vesta','Pholus','Eros','Psyche','Chiron'])

// ─── Color Palette ────────────────────────────────────────────────────────────

const CHART_COLOR_PALETTE = {
  red:      { h:0,   s:80, l:45, dark:'#1a0404', mid:'#cc2222', light:'#ff8888', text:'#ffe0e0' },
  orange:   { h:25,  s:85, l:48, dark:'#1a0800', mid:'#dd6600', light:'#ff9944', text:'#ffe0c0' },
  gold:     { h:42,  s:90, l:45, dark:'#1a1200', mid:'#cc9900', light:'#ffcc44', text:'#fff0a0' },
  yellow:   { h:55,  s:90, l:50, dark:'#141200', mid:'#ccaa00', light:'#ffee44', text:'#fffff0' },
  lime:     { h:80,  s:70, l:42, dark:'#0c1400', mid:'#66aa00', light:'#aadd44', text:'#eeffcc' },
  green:    { h:140, s:70, l:38, dark:'#041408', mid:'#228844', light:'#44cc77', text:'#aaeebb' },
  sage:     { h:130, s:35, l:38, dark:'#0a140a', mid:'#5a8040', light:'#a0c880', text:'#c8e0b0' },
  teal:     { h:175, s:75, l:38, dark:'#021414', mid:'#119999', light:'#44cccc', text:'#aaeee0' },
  cyan:     { h:190, s:80, l:45, dark:'#021418', mid:'#0099bb', light:'#44ccee', text:'#aaeeff' },
  blue:     { h:220, s:80, l:48, dark:'#030a18', mid:'#2255cc', light:'#6699ff', text:'#ccdeff' },
  navy:     { h:225, s:75, l:30, dark:'#020810', mid:'#1a3a88', light:'#4466bb', text:'#b0ccf0' },
  indigo:   { h:245, s:70, l:42, dark:'#060418', mid:'#4433aa', light:'#8866dd', text:'#d0c0ff' },
  purple:   { h:270, s:75, l:42, dark:'#080414', mid:'#7733bb', light:'#bb66ff', text:'#eed0ff' },
  violet:   { h:280, s:70, l:45, dark:'#08040e', mid:'#8833cc', light:'#cc66ff', text:'#f0d0ff' },
  pink:     { h:330, s:75, l:48, dark:'#140408', mid:'#cc3377', light:'#ff77bb', text:'#ffd0e8' },
  rose:     { h:350, s:75, l:48, dark:'#140408', mid:'#cc3355', light:'#ff7799', text:'#ffd0d8' },
  // Light themes
  // FIX: white uses pure neutral hex values — no hslStr() calls which were introducing cream tint
  white:    { h:0,   s:0,  l:100, dark:'#ffffff', mid:'#1a1a1a', light:'#000000', text:'#111111', isLight:true, isPureWhite:true },
  cream:    { h:40,  s:35, l:94,  dark:'#f5efe0', mid:'#a08850', light:'#5a4a28', text:'#2e2010', isLight:true },
  silver:   { h:210, s:18, l:72,  dark:'#d8dfe8', mid:'#a0adb8', light:'#6a7a88', text:'#1a2030', isLight:true },
  // Dark/neutral
  charcoal: { h:215, s:10, l:22,  dark:'#1c2028', mid:'#4a5260', light:'#8a96a4', text:'#dde2e8' },
  black:    { h:0,   s:0,  l:5,   dark:'#000000', mid:'#444444', light:'#aaaaaa', text:'#ffffff' },
  // Special
  cosmic:   { h:270, s:90, l:35, dark:'#07000f', mid:'#9933cc', light:'#dd88ff', text:'#f0e0ff' },
  warm:     { h:35,  s:70, l:40, dark:'#120d04', mid:'#aa7722', light:'#ffcc66', text:'#fff0c0' },
  bronze:   { h:30,  s:60, l:38, dark:'#100800', mid:'#996633', light:'#cc9955', text:'#ffe8cc' },
  coral:    { h:16,  s:80, l:55, dark:'#180600', mid:'#dd5533', light:'#ff8866', text:'#ffe4dc' },
  lavender: { h:260, s:50, l:65, dark:'#0c0820', mid:'#9977cc', light:'#ccaaff', text:'#f0e8ff' },
  mint:     { h:160, s:60, l:55, dark:'#021410', mid:'#44aa88', light:'#88ddbb', text:'#ccffee' },
}

const CHART_COLOR_ALIASES = {
  scarlet:'red', crimson:'red', ruby:'red', maroon:'red',
  apricot:'orange',
  amber:'gold', mustard:'gold', honey:'gold',
  copper:'bronze', caramel:'warm',
  terracotta:'coral', salmon:'coral', peach:'coral',
  emerald:'green', forest:'green',
  jade:'sage', olive:'sage',
  seafoam:'mint',
  cobalt:'blue', royal:'blue',
  sapphire:'navy', midnight:'navy',
  aquamarine:'cyan', 'ice blue':'cyan',
  turquoise:'teal',
  amethyst:'purple', plum:'purple',
  mauve:'violet',
  magenta:'pink', fuchsia:'pink',
  'rose gold':'rose', burgundy:'rose',
  ivory:'cream',
  pewter:'silver', ash:'silver',
  grey:'silver', gray:'silver',
  grayscale:'silver', monochrome:'silver',
  graphite:'charcoal', slate:'charcoal',
  obsidian:'black', onyx:'black', noir:'black',
  chocolate:'bronze',
  space:'cosmic', galaxy:'cosmic', nebula:'cosmic', stellar:'cosmic',
  neon:'cyan', electric:'cyan',
  glow:'teal',
  pastel:'lavender', dreamy:'lavender', whimsical:'lavender',
}

// ─── Theme Builder ────────────────────────────────────────────────────────────

function hslStr(h, s, l) {
  return `hsl(${h},${s}%,${l}%)`
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return '128,128,128'
  const h = hex.replace('#', '')
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return `${r},${g},${b}`
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r},${g},${b}`
}

function parseChartColors(prompt) {
  // Strip zodiac/astro words to avoid false matches like 'sage' in 'Sagittarius'
  const cleaned = prompt
    .toLowerCase()
    .replace(/\b(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b/g, '')
    .replace(/\b(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|lilith|ceres|juno|vesta|pholus|ascendant|midheaven|north node|south node)\b/g, '')
    .replace(/\b(conjunction|sextile|square|trine|opposition|natal|birth|chart|wheel|house|rising|astrological|placidus|retrograde|interactive|hoverable|clickable)\b/g, '')
    .replace(/\d+°?\s*\d*'?/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const found = []

  // Check multi-word aliases first
  for (const [alias, target] of Object.entries(CHART_COLOR_ALIASES)) {
    if (cleaned.includes(alias) && !found.includes(target)) {
      found.push(target)
    }
  }

  // Check direct palette names with word boundaries
  for (const colorName of Object.keys(CHART_COLOR_PALETTE)) {
    const re = new RegExp(`\\b${colorName}\\b`)
    if (re.test(cleaned) && !found.includes(colorName)) {
      found.push(colorName)
    }
  }

  return found.slice(0, 2)
}

function buildChartTheme(colorIds) {
  const FALLBACK_POOL = ['white','navy','purple','teal','cosmic','warm','green','blue','gold','rose']

  if (colorIds.length === 0) {
    const pick = FALLBACK_POOL[Math.floor(Math.random() * FALLBACK_POOL.length)]
    colorIds = [pick]
  }

  const c1id = colorIds[0]
  const c2id = colorIds[1] || null
  const C1 = CHART_COLOR_PALETTE[c1id] || CHART_COLOR_PALETTE.navy
  const C2 = c2id ? (CHART_COLOR_PALETTE[c2id] || null) : null

  const isLight     = C1.isLight || false
  const isPureWhite = C1.isPureWhite || false
  const isPureBlack = c1id === 'black'

  const H1 = C1.h
  const H2 = C2 ? C2.h : (H1 + 30) % 360

  const accentMid   = C2 ? C2.mid   : C1.mid
  const accentLight = C2 ? C2.light : C1.light
  const accentText  = C2 ? C2.text  : C1.text

  const bg     = C1.dark
  const cardBg = isLight ? '#ffffff' : (() => {
    const rgb = hexToRgb(C1.dark).split(',').map(Number)
    const bump = rgb.map(v => Math.min(255, v + 12))
    return `rgb(${bump.join(',')})`
  })()

  // ── Zodiac ring fills ──────────────────────────────────────────────────────
  // For pure white: all sectors are neutral white/light-gray, no hue tint
  // For pure black: all sectors are neutral very-dark-gray, no hue tint
  let zodiacFire, zodiacEarth, zodiacAir, zodiacWater
  let zodiacFireS, zodiacEarthS, zodiacAirS, zodiacWaterS

  if (isPureWhite) {
    zodiacFire  = '#f5f5f5'
    zodiacEarth = '#ebebeb'
    zodiacAir   = '#f0f0f0'
    zodiacWater = '#e8e8e8'
    zodiacFireS  = '#bbbbbb'
    zodiacEarthS = '#aaaaaa'
    zodiacAirS   = '#b5b5b5'
    zodiacWaterS = '#a8a8a8'
  } else if (isPureBlack) {
    zodiacFire  = '#141414'
    zodiacEarth = '#111111'
    zodiacAir   = '#131313'
    zodiacWater = '#0f0f0f'
    zodiacFireS  = '#555555'
    zodiacEarthS = '#444444'
    zodiacAirS   = '#4e4e4e'
    zodiacWaterS = '#3e3e3e'
  } else if (isLight) {
    zodiacFire  = hslStr(H1, 30, 88)
    zodiacEarth = hslStr(H2, 25, 85)
    zodiacAir   = hslStr((H1+H2)/2, 20, 90)
    zodiacWater = hslStr(H2, 20, 87)
    zodiacFireS  = hslStr(H1, 60, 45)
    zodiacEarthS = hslStr(H2, 50, 40)
    zodiacAirS   = hslStr((H1+H2)/2, 45, 48)
    zodiacWaterS = hslStr(H2, 40, 42)
  } else {
    zodiacFire  = hslStr(H1, 40, 10)
    zodiacEarth = hslStr(H2, 35,  9)
    zodiacAir   = hslStr((H1+H2)/2, 30, 8)
    zodiacWater = hslStr(H2, 25,  7)
    zodiacFireS  = hslStr(H1, 65, 50)
    zodiacEarthS = hslStr(H2, 55, 42)
    zodiacAirS   = hslStr((H1+H2)/2, 50, 48)
    zodiacWaterS = hslStr(H2, 45, 38)
  }

  // ── House ring fills ───────────────────────────────────────────────────────
  const houseEven = isPureWhite ? '#f7f7f7'
                  : isPureBlack ? '#0d0d0d'
                  : isLight     ? hslStr(H1, 15, 94)
                  :               hslStr(H1, 30, 7)

  const houseOdd  = isPureWhite ? '#efefef'
                  : isPureBlack ? '#0a0a0a'
                  : isLight     ? hslStr(H1, 10, 91)
                  :               hslStr(H1, 25, 6)

  // ── SVG background ────────────────────────────────────────────────────────
  const svgBgInner = isPureWhite ? '#ffffff'
                   : isPureBlack ? '#000000'
                   : isLight     ? hslStr(H1, 20, 92)
                   :               hslStr(H1, 40, 8)

  // ── Inner circle ──────────────────────────────────────────────────────────
  const innerCircle = isPureWhite ? '#ffffff'
                    : isPureBlack ? '#000000'
                    : isLight     ? hslStr(H1, 10, 97)
                    :               C1.dark

  return {
    bg,
    cardBg,
    cardBorder:     `rgba(${hexToRgb(accentMid)},0.2)`,
    svgBgInner,
    svgBgOuter:     bg,
    zodiacFire, zodiacEarth, zodiacAir, zodiacWater,
    zodiacFireS, zodiacEarthS, zodiacAirS, zodiacWaterS,
    houseEven,
    houseOdd,
    innerCircle,
    signTextColor:  isPureWhite ? '#111111'
                  : isPureBlack ? '#cccccc'
                  : isLight     ? '#111111'
                  :               accentText,
    tickColor:      isPureWhite ? 'rgba(0,0,0,'
                  : isPureBlack ? 'rgba(255,255,255,'
                  : isLight     ? 'rgba(0,0,0,'
                  :               `rgba(${hexToRgb(accentMid)},`,
    dividerColor:   isPureWhite ? 'rgba(0,0,0,0.2)'
                  : isPureBlack ? 'rgba(255,255,255,0.15)'
                  : `rgba(${hexToRgb(accentMid)},${isLight ? '0.25' : '0.3'})`,
    houseNumColor:  isPureWhite ? '#555555'
                  : isPureBlack ? '#888888'
                  : isLight     ? hslStr(H1, 30, 40)
                  :               hslStr(H1, 40, 50),
    axisLineColor:  isPureWhite ? 'rgba(0,0,0,0.85)'
                  : isPureBlack ? 'rgba(255,255,255,0.85)'
                  : isLight     ? 'rgba(0,0,0,0.85)'
                  :               `rgba(${hexToRgb(accentLight)},0.9)`,
    axisLabelColor: isPureWhite ? 'rgba(0,0,0,0.55)'
                  : isPureBlack ? 'rgba(255,255,255,0.55)'
                  : isLight     ? 'rgba(0,0,0,0.6)'
                  :               `rgba(${hexToRgb(accentLight)},0.7)`,
    planetFill:     isPureWhite ? '#ffffff'
                  : isPureBlack ? '#000000'
                  : isLight     ? '#ffffff'
                  :               hslStr(H1, 35, 10),
    planetStroke:   isPureWhite ? 'rgba(0,0,0,0.7)'
                  : isPureBlack ? 'rgba(255,255,255,0.6)'
                  : `rgba(${hexToRgb(accentMid)},0.9)`,
    planetText:     isPureWhite ? '#111111'
                  : isPureBlack ? '#dddddd'
                  : isLight     ? '#111111'
                  :               accentText,
    outerPlanetText: isPureWhite ? '#333333'
                   : isPureBlack ? '#aaaaaa'
                   : isLight     ? hslStr(H2, 40, 35)
                   :               hslStr(H2, 50, 60),
    outerPlanetLine: isPureWhite ? 'rgba(0,0,0,0.25)'
                   : isPureBlack ? 'rgba(255,255,255,0.2)'
                   : `rgba(${hexToRgb(accentMid)},0.3)`,
    centerDot:      isPureWhite ? '#333333'
                  : isPureBlack ? '#aaaaaa'
                  :               accentLight,
    titleColor:     isPureWhite ? '#111111'
                  : isPureBlack ? '#eeeeee'
                  : isLight     ? '#111111'
                  :               accentLight,
    subColor:       isPureWhite ? 'rgba(0,0,0,0.5)'
                  : isPureBlack ? 'rgba(255,255,255,0.45)'
                  : isLight     ? 'rgba(0,0,0,0.5)'
                  :               `rgba(${hexToRgb(accentLight)},0.5)`,
    legendBg:       isPureWhite ? '#ffffff'
                  : isPureBlack ? '#000000'
                  : isLight     ? '#ffffff'
                  :               `rgba(${hexToRgb(accentMid)},0.04)`,
    legendBorder:   isPureWhite ? 'rgba(0,0,0,0.1)'
                  : isPureBlack ? 'rgba(255,255,255,0.1)'
                  : isLight     ? 'rgba(0,0,0,0.08)'
                  :               `rgba(${hexToRgb(accentMid)},0.15)`,
    legendTitleColor: isPureWhite ? '#333333'
                    : isPureBlack ? '#aaaaaa'
                    : isLight     ? hslStr(H1, 30, 40)
                    :               hslStr(H1, 35, 50),
    legendNameColor:  isPureWhite ? 'rgba(0,0,0,0.78)'
                    : isPureBlack ? 'rgba(255,255,255,0.78)'
                    : isLight     ? 'rgba(0,0,0,0.78)'
                    :               `rgba(${hexToRgb(accentText)},0.88)`,
    legendPosColor:   isPureWhite ? '#666666'
                    : isPureBlack ? '#888888'
                    : isLight     ? hslStr(H1, 20, 50)
                    :               hslStr(H1, 25, 45),
    tooltipBg:      isPureWhite ? '#ffffff'
                  : isPureBlack ? '#111111'
                  : isLight     ? '#ffffff'
                  :               hslStr(H1, 35, 8),
    tooltipBorder:  isPureWhite ? 'rgba(0,0,0,0.25)'
                  : isPureBlack ? 'rgba(255,255,255,0.2)'
                  : `rgba(${hexToRgb(accentMid)},0.4)`,
    tooltipText:    isPureWhite ? '#111111'
                  : isPureBlack ? '#eeeeee'
                  : isLight     ? '#111111'
                  :               accentText,
    aspectConj:     isPureWhite ? 'rgba(0,0,0,0.55)'
                  : isPureBlack ? 'rgba(200,200,200,0.6)'
                  :               'rgba(255,220,50,0.7)',
    aspectSext:     isPureWhite ? 'rgba(80,80,80,0.4)'
                  : isPureBlack ? 'rgba(160,160,160,0.45)'
                  : C2          ? `rgba(${hexToRgb(C2.light)},0.55)`
                  :               `rgba(${hexToRgb(accentLight)},0.5)`,
    aspectSq:       isPureWhite ? 'rgba(180,0,0,0.4)'
                  : isPureBlack ? 'rgba(255,80,80,0.45)'
                  :               'rgba(255,80,80,0.55)',
    aspectTrine:    isPureWhite ? 'rgba(0,120,60,0.4)'
                  : isPureBlack ? 'rgba(80,220,140,0.4)'
                  :               'rgba(80,220,140,0.5)',
    aspectOpp:      isPureWhite ? 'rgba(160,0,0,0.45)'
                  : isPureBlack ? 'rgba(255,80,80,0.5)'
                  :               'rgba(255,80,80,0.62)',
    isDark:         !isLight,
  }
}

function pickChartTheme(prompt) {
  const colorIds = parseChartColors(prompt)
  return buildChartTheme(colorIds)
}

// ─── Sign Display Mode ────────────────────────────────────────────────────────

function parseSignDisplayMode(prompt) {
  const lower = prompt.toLowerCase()
  if (
    lower.includes('sign name and icon') || lower.includes('icon and name') ||
    lower.includes('both sign') || lower.includes('glyph and name') ||
    lower.includes('name and glyph') || lower.includes('symbol and name') ||
    lower.includes('name and symbol') || lower.includes('show both')
  ) return 'both'
  if (
    lower.includes('sign name') || lower.includes('text sign') ||
    lower.includes('written sign') || lower.includes('spelled out') ||
    lower.includes('name only') || lower.includes('just the name')
  ) return 'name'
  return 'glyph'
}

// ─── Data Extraction ──────────────────────────────────────────────────────────

function extractBirthChartData(prompt) {
  const placements = []
  const lines = prompt.split('\n').map(l =>
    l.replace(/\*\*/g, '').replace(/[★☆⭐🌟🔮⬛✩⛤🚫]/gu, '').trim()
  ).filter(Boolean)

  const signNames = Object.keys(SIGN_BASE_DEGS).join('|')
  const re = new RegExp(
    `^([A-Za-z ()\\-\\/]+?):\\s*(?:[^A-Za-z]*)?\\s*(${signNames})\\s*(\\d{0,3})°?(?:(\\d{1,2})')?`,
    'i'
  )

  for (const line of lines) {
    const m = line.match(re)
    if (!m) continue
    let name = m[1].trim()
      .replace(/\s*\(R\)\s*/gi, '').replace(/\s*\(AC\)\s*/gi, '')
      .replace(/\s*\(MC\)\s*/gi, '').replace(/\s*\(Black Moon\)\s*/gi, '').trim()
    if (/rising\s*sign/i.test(name) || /^ascendant/i.test(name)) name = 'Ascendant'
    if (/^midheaven/i.test(name))   name = 'Midheaven'
    if (/north\s*node/i.test(name)) name = 'North Node'
    if (/south\s*node/i.test(name)) name = 'South Node'
    if (/lilith/i.test(name))       name = 'Lilith'
    if (/pallas/i.test(name))       name = 'Pallas Athena'
    if (/pholus/i.test(name))       name = 'Pholus'

    const signRaw = m[2]
    const sign    = signRaw[0].toUpperCase() + signRaw.slice(1).toLowerCase()
    const deg     = parseInt(m[3] || '0', 10)
    const min     = parseInt(m[4] || '0', 10)
    const base    = SIGN_BASE_DEGS[sign.toLowerCase()] ?? 0
    const absolute = base + deg + min / 60

    const isRetrograde = /\(R\)/i.test(line)
    const houseMatch   = line.match(/\((\d{1,2})(?:st|nd|rd|th)?\s*[Hh]ouse\)/)
    const houseNum     = houseMatch ? parseInt(houseMatch[1], 10) : null

    placements.push({
      name, sign,
      glyph:     PLANET_GLYPHS[name] || '•',
      signGlyph: SIGN_GLYPHS[sign]   || '',
      absolute, deg, min,
      label: `${deg}°${String(min).padStart(2, '0')}'`,
      isRetrograde, houseNum,
      isOuter: OUTER_BODIES.has(name),
    })
  }
  return placements
}

function extractHouseCusps(placements) {
  const ascP = placements.find(p => p.name === 'Ascendant')
  const mcP = placements.find(p => p.name === 'Midheaven')

  const asc = ascP ? ascP.absolute : 0
  const mc = mcP ? mcP.absolute : (asc + 90) % 360
  const dsc = (asc + 180) % 360
  const ic = (mc + 180) % 360

  function forwardSpan(from, to) {
    return ((to - from) % 360 + 360) % 360
  }

  // Move FORWARD around the zodiac in house order:
  // 1 -> 4 -> 7 -> 10 -> 1
  const span14 = forwardSpan(asc, ic)
  const span47 = forwardSpan(ic, dsc)
  const span710 = forwardSpan(dsc, mc)
  const span101 = forwardSpan(mc, asc + 360)

  return [
    asc % 360,                           // 1
    (asc + span14 * 0.36) % 360,         // 2
    (asc + span14 * 0.70) % 360,         // 3
    ic % 360,                            // 4
    (ic + span47 * 0.34) % 360,          // 5
    (ic + span47 * 0.68) % 360,          // 6
    dsc % 360,                           // 7
    (dsc + span710 * 0.36) % 360,        // 8
    (dsc + span710 * 0.70) % 360,        // 9
    mc % 360,                            // 10
    (mc + span101 * 0.34) % 360,         // 11
    (mc + span101 * 0.68) % 360,         // 12
  ]
}

// ─── SVG Math ─────────────────────────────────────────────────────────────────

function e2s(ecl, asc) { return (((asc - ecl + 270) % 360) + 360) % 360 }
function polar(a, r, cx, cy) {
  const rad = (a - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function arc(a1, a2, ro, ri, cx, cy) {
  let end = a2
  while (end <= a1) end += 360
  const span = end - a1
  const lg   = span > 180 ? 1 : 0
  const p1   = polar(a1,        ro, cx, cy)
  const p2   = polar(a1 + span, ro, cx, cy)
  const p3   = polar(a1 + span, ri, cx, cy)
  const p4   = polar(a1,        ri, cx, cy)
  return `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A${ro} ${ro} 0 ${lg} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A${ri} ${ri} 0 ${lg} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}Z`
}

// ─── Chart Builder ────────────────────────────────────────────────────────────

function buildBirthChartHTML(prompt) {
  const placements  = extractBirthChartData(prompt)
  const T           = pickChartTheme(prompt)
  const houseCusps  = extractHouseCusps(placements)

  // ─── Sign display mode ────────────────────────────────────────────────────
  const lowerP = prompt.toLowerCase()
  let signMode = 'glyph'
  if (
    lowerP.includes('sign name and icon') || lowerP.includes('icon and name') ||
    lowerP.includes('both sign') || lowerP.includes('glyph and name') ||
    lowerP.includes('name and glyph') || lowerP.includes('symbol and name') ||
    lowerP.includes('name and symbol') || lowerP.includes('show both')
  ) {
    signMode = 'both'
  } else if (
    lowerP.includes('sign name') || lowerP.includes('text sign') ||
    lowerP.includes('written sign') || lowerP.includes('spelled out') ||
    lowerP.includes('name only') || lowerP.includes('just the name')
  ) {
    signMode = 'name'
  } else {
    const modes = ['glyph', 'glyph', 'name', 'both']
    signMode = modes[Math.floor(Math.random() * modes.length)]
  }

  const ascP = placements.find(p => p.name === 'Ascendant')
  const mcP  = placements.find(p => p.name === 'Midheaven')
  const ASC  = ascP ? ascP.absolute : 0
  const MC   = mcP  ? mcP.absolute  : (ASC + 270) % 360

  const SIZE = 580
  const cx   = SIZE / 2
  const cy   = SIZE / 2

  const showHouseNums = 
    lowerP.includes('house number') ||
    lowerP.includes('house numbers') ||
    lowerP.includes('numbered house') ||
    lowerP.includes('show house') ||
    lowerP.includes('display house') ||
    Math.random() > 0.4

  const STYLE_VARIANTS = [
    { zodiacRingWidth:40, houseRingWidth:49, planetRingR:133, aspectRingR:104, zodiacFontSize:16, showDegreeMarks:true,  spokeOpacity:0.7,  axisWeight:1.8 },
    { zodiacRingWidth:36, houseRingWidth:44, planetRingR:130, aspectRingR:100, zodiacFontSize:14, showDegreeMarks:true,  spokeOpacity:0.45, axisWeight:2.4 },
    { zodiacRingWidth:46, houseRingWidth:52, planetRingR:122, aspectRingR:94,  zodiacFontSize:18, showDegreeMarks:false, spokeOpacity:0.85, axisWeight:2.8 },
    { zodiacRingWidth:34, houseRingWidth:42, planetRingR:136, aspectRingR:108, zodiacFontSize:13, showDegreeMarks:true,  spokeOpacity:0.5,  axisWeight:1.6 },
  ]
  const SV = STYLE_VARIANTS[Math.floor(Math.random() * STYLE_VARIANTS.length)]

  const R_OUT   = 254
  const R_ZIN   = R_OUT - SV.zodiacRingWidth
  const R_HOU_O = R_ZIN - 3
  const R_HOU_I = R_HOU_O - SV.houseRingWidth
  const R_PLN   = Math.min(SV.planetRingR, R_HOU_I - 20)
  const R_ASP   = Math.min(SV.aspectRingR, R_PLN - 22)
  const PLANET_R = 13

   // ─── Text rotation helper ─────────────────────────────────────────────────
  // In our SVG polar system: angle 0 = top, increases clockwise.
  // polar(a, r) places a point at CSS-angle a from top.
  // The tangent direction at that point (running along the arc) = a degrees.
  // BUT: text rendered at rotation=a reads clockwise-outward on the right half
  // and would be upside-down on the left half.
  // Fix for left half: add 180° so text always reads left-to-right.
  function textRotation(svgAngle) {
  const a = ((svgAngle % 360) + 360) % 360
  // Left half of chart (90°–270°) needs 180° flip so text reads correctly
  if (a > 90 && a <= 270) {
    return a + 180
  }
  return a
}

   // ─── Sign label renderer ──────────────────────────────────────────────────
  function renderSignLabel(sign, midR, svgMidAngle) {
    const mp    = polar(svgMidAngle, midR, cx, cy)
    const color = T.signTextColor
    const fs    = SV.zodiacFontSize
    const rot   = textRotation(svgMidAngle)
    const tx    = mp.x.toFixed(2)
    const ty    = mp.y.toFixed(2)

    if (signMode === 'name') {
      const nameSize = Math.max(7, fs - 4)
      return `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="${nameSize}" font-family="sans-serif" font-weight="600" transform="rotate(${rot.toFixed(1)},${tx},${ty})">${sign}</text>`
    }

    if (signMode === 'both') {
      // Glyph slightly toward outer edge, name slightly toward inner edge
      const offset  = Math.round(fs * 0.42)
      const gpR     = midR + offset
      const npR     = midR - offset
      const gp      = polar(svgMidAngle, gpR, cx, cy)
      const np      = polar(svgMidAngle, npR, cx, cy)
      const gtx     = gp.x.toFixed(2), gty = gp.y.toFixed(2)
      const ntx     = np.x.toFixed(2), nty = np.y.toFixed(2)
      const nameSize  = Math.max(6, fs - 6)
      const glyphSize = Math.max(10, fs - 1)
      return `<text x="${gtx}" y="${gty}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="${glyphSize}" font-family="serif" transform="rotate(${rot.toFixed(1)},${gtx},${gty})">${SIGN_GLYPHS[sign]}</text>
<text x="${ntx}" y="${nty}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="${nameSize}" font-family="sans-serif" font-weight="600" opacity="0.9" transform="rotate(${rot.toFixed(1)},${ntx},${nty})">${sign}</text>`
    }

    // glyph only — unicode symbols look fine without rotation
    return `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="${fs}" font-family="serif">${SIGN_GLYPHS[sign]}</text>`
  }

  // ─── Zodiac ring ──────────────────────────────────────────────────────────
  const zodSVG = ZODIAC_ORDER.map(sign => {
    const se   = SIGN_BASE_DEGS[sign.toLowerCase()]
    const svgA = e2s(se, ASC)
    const svgB = e2s(se + 30, ASC)
    const svgM = e2s(se + 15, ASC)
    const el   = SIGN_ELEMENTS[sign]
    const fill   = el==='Fire' ? T.zodiacFire  : el==='Earth' ? T.zodiacEarth  : el==='Air' ? T.zodiacAir  : T.zodiacWater
    const stroke = el==='Fire' ? T.zodiacFireS : el==='Earth' ? T.zodiacEarthS : el==='Air' ? T.zodiacAirS : T.zodiacWaterS
    const d    = arc(svgB, svgA, R_OUT, R_ZIN, cx, cy)
    const midR = (R_OUT + R_ZIN) / 2
    const sw   = SV.spokeOpacity > 0.6 ? 1.2 : 0.9
    return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
${renderSignLabel(sign, midR, svgM)}`
  }).join('\n')

  // ─── Degree ticks ─────────────────────────────────────────────────────────
  const tickSVG = SV.showDegreeMarks
    ? Array.from({ length: 360 }, (_, i) => {
        const sv  = e2s(i, ASC)
        const maj = i % 10 === 0
        const mid = i % 5 === 0
        const r1  = polar(sv, R_ZIN, cx, cy)
        const r2  = polar(sv, R_ZIN - (maj ? 10 : mid ? 6 : 3), cx, cy)
        const op  = maj ? 0.6 : mid ? 0.3 : 0.15
        return `<line x1="${r1.x.toFixed(2)}" y1="${r1.y.toFixed(2)}" x2="${r2.x.toFixed(2)}" y2="${r2.y.toFixed(2)}" stroke="${T.tickColor}${op})" stroke-width="${maj ? 1 : 0.6}"/>`
      }).join('\n')
    : ''

  // ─── Sign boundary spokes ─────────────────────────────────────────────────
 const spokeSVG = ZODIAC_ORDER.map(sign => {
    const sv = e2s(SIGN_BASE_DEGS[sign.toLowerCase()], ASC)
    const p1 = polar(sv, R_ZIN, cx, cy)
    const p2 = polar(sv, R_HOU_I, cx, cy)
    return `<line
      x1="${p1.x.toFixed(2)}"
      y1="${p1.y.toFixed(2)}"
      x2="${p2.x.toFixed(2)}"
      y2="${p2.y.toFixed(2)}"
      stroke="${T.dividerColor}"
      stroke-width="0.7"
    />`
  }).join('\n')

  // ─── House ring — house number fix ────────────────────────────────────────
  // The correct midpoint of a house arc in SVG space:
  // Each house runs from svgC (its own cusp) to svgN (next cusp) going CLOCKWISE
  // in SVG. The arc() function draws from a1 to a2 clockwise when a2 > a1.
  // We call arc(svgN, svgC, ...) meaning a1=svgN, a2=svgC (after while loop adds 360).
  // So the arc goes from svgN clockwise to svgC.
  // Midpoint = svgN + half of that clockwise span.
 const houseBandSVG = houseCusps.map((cuspEcl, i) => {
    const nextEcl = houseCusps[(i + 1) % 12]

    const svgStart = e2s(cuspEcl, ASC)
    const svgEnd = e2s(nextEcl, ASC)

    const d = arc(svgStart, svgEnd, R_HOU_O, R_HOU_I, cx, cy)
    const isAng = i === 0 || i === 3 || i === 6 || i === 9

    const p1 = polar(svgStart, R_HOU_O, cx, cy)

    // stop house cusp divider lines before the center / aspect area
    const p2 = polar(svgStart, R_PLN + 10, cx, cy)

    return `
      <path
        d="${d}"
        fill="${i % 2 === 0 ? T.houseEven : T.houseOdd}"
        stroke="${T.tickColor}0.06)"
        stroke-width="0.4"
      />
      <line
        x1="${p1.x.toFixed(2)}"
        y1="${p1.y.toFixed(2)}"
        x2="${p2.x.toFixed(2)}"
        y2="${p2.y.toFixed(2)}"
      
      />
    `
  }).join('\n')




 const houseNumberSVG = houseCusps.map((cuspEcl, i) => {
    const nextEcl = houseCusps[(i + 1) % 12]

    let nextForMid = nextEcl
    while (nextForMid <= cuspEcl) nextForMid += 360
    const midEcl = (cuspEcl + (nextForMid - cuspEcl) / 2) % 360

    const svgMid = e2s(midEcl, ASC)
    const numR = R_HOU_I + (R_HOU_O - R_HOU_I) * 0.68
    const mp = polar(svgMid, numR, cx, cy)

    return showHouseNums ? `
      <text
        x="${mp.x.toFixed(2)}"
        y="${mp.y.toFixed(2)}"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="${T.isDark ? '#cbd5e1' : '#334155'}"
        font-size="11"
        font-family="sans-serif"
        font-weight="700"
        pointer-events="none"
      >${i + 1}</text>
    ` : ''
  }).join('\n')

  // ─── AC / DC / MC / IC axis labels + optional short lines ────────────────
  const showAxisLines = Math.random() > 0.45

  // ─── Axis lines ───────────────────────────────────────────────────────────
   const axesSVG = [
    { ecl: ASC, label: 'AC' },
    { ecl: (ASC + 180) % 360, label: 'DC' },
    { ecl: MC, label: 'MC' },
    { ecl: (MC + 180) % 360, label: 'IC' },
  ].map(({ ecl, label }) => {
    const sv = e2s(ecl, ASC)

    // line starts at outer edge of house ring
    const p1 = polar(sv, R_HOU_O, cx, cy)

    // line stops near inner edge of house ring, NOT in the center
    const p2 = polar(sv, R_HOU_I - 4, cx, cy)

    // label sits just inside the house band
    const lp = polar(sv, R_HOU_I - 14, cx, cy)

    const lineTag = showAxisLines ? `
      <line
        x1="${p1.x.toFixed(2)}"
        y1="${p1.y.toFixed(2)}"
        x2="${p2.x.toFixed(2)}"
        y2="${p2.y.toFixed(2)}"
        stroke="${T.axisLineColor}"
        stroke-width="${SV.axisWeight}"
        stroke-linecap="round"
      />
    ` : ''

    return `
      ${lineTag}
      <text
        x="${lp.x.toFixed(2)}"
        y="${lp.y.toFixed(2)}"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="${T.axisLabelColor}"
        font-size="9"
        font-weight="700"
        font-family="sans-serif"
      >${label}</text>
    `
  }).join('\n')

  // ─── Planet separation ────────────────────────────────────────────────────
  const innerPlanets = placements.filter(p => p.name !== 'Ascendant' && p.name !== 'Midheaven' && !p.isOuter)
  const outerPlanets = placements.filter(p => p.isOuter)

  const innerWithSVG = innerPlanets
    .map(p => ({ ...p, svgAngle: e2s(p.absolute, ASC) }))
    .sort((a, b) => a.svgAngle - b.svgAngle)

  const MIN_SEP = 16
  const disp    = innerWithSVG.map(p => p.svgAngle)
  for (let pass = 0; pass < 18; pass++) {
    for (let i = 0; i < disp.length; i++) {
      const j    = (i + 1) % disp.length
      const diff = (((disp[j] - disp[i]) % 360) + 360) % 360
      if (diff < MIN_SEP && diff > 0) {
        const push = (MIN_SEP - diff) / 2
        disp[i] = ((disp[i] - push) + 360) % 360
        disp[j] = (disp[j] + push) % 360
      }
    }
  }

  const radialOff   = new Array(innerWithSVG.length).fill(0)
  const angleGroups = {}
  innerWithSVG.forEach((p, i) => {
    const key = Math.round(p.absolute * 2)
    if (!angleGroups[key]) angleGroups[key] = []
    angleGroups[key].push(i)
  })
  for (const group of Object.values(angleGroups)) {
    if (group.length > 1) {
      group.forEach((idx, layerIdx) => {
        radialOff[idx] = layerIdx * (PLANET_R * 2 + 4)
      })
    }
  }

  // ─── Aspects ──────────────────────────────────────────────────────────────
  const ASPECTS = [
    { angle: 0,   orb: 8, color: T.aspectConj,  width: 1.5, dash: '' },
    { angle: 60,  orb: 6, color: T.aspectSext,  width: 1,   dash: '' },
    { angle: 90,  orb: 6, color: T.aspectSq,    width: 1.2, dash: '' },
    { angle: 120, orb: 8, color: T.aspectTrine, width: 1,   dash: '' },
    { angle: 180, orb: 8, color: T.aspectOpp,   width: 1.5, dash: '4,3' },
  ]
  const aspectBodies = innerWithSVG.filter(p =>
    ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'].includes(p.name)
  )
  const aspectSVG = []
  for (let i = 0; i < aspectBodies.length; i++) {
    for (let j = i + 1; j < aspectBodies.length; j++) {
      const diff = Math.abs(aspectBodies[i].absolute - aspectBodies[j].absolute)
      const norm = Math.min(diff, 360 - diff)
      for (const asp of ASPECTS) {
        if (Math.abs(norm - asp.angle) <= asp.orb) {
          const p1 = polar(aspectBodies[i].svgAngle, R_ASP, cx, cy)
          const p2 = polar(aspectBodies[j].svgAngle, R_ASP, cx, cy)
          const da = asp.dash ? ` stroke-dasharray="${asp.dash}"` : ''
          aspectSVG.push(`<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${asp.color}" stroke-width="${asp.width}"${da}/>`)
          break
        }
      }
    }
  }

  // ─── Inner planets ────────────────────────────────────────────────────────
  const backdropOpacity = T.isDark ? '0.78' : '0.85'

  const innerSVG = innerWithSVG.map((p, idx) => {
    const da        = disp[idx]
    const rOff      = radialOff[idx]
    const displaced = Math.abs(da - p.svgAngle) > 2
    const tp1 = polar(p.svgAngle, R_HOU_I - 1, cx, cy)
    const tp2 = polar(p.svgAngle, R_HOU_I - 8, cx, cy)
    let leader = ''
    if (displaced) {
      const lp1 = polar(p.svgAngle, R_HOU_I - 9,      cx, cy)
      const lp2 = polar(da,         R_PLN - rOff + 15, cx, cy)
      leader = `<line x1="${lp1.x.toFixed(2)}" y1="${lp1.y.toFixed(2)}" x2="${lp2.x.toFixed(2)}" y2="${lp2.y.toFixed(2)}" stroke="${T.tickColor}0.2)" stroke-width="0.7"/>`
    }
    const pos       = polar(da, R_PLN - rOff, cx, cy)
    const retroMark = p.isRetrograde
      ? `<text x="${(pos.x+10).toFixed(2)}" y="${(pos.y-10).toFixed(2)}" fill="${T.planetText}" font-size="7" opacity="0.75">℞</text>`
      : ''
    const el    = SIGN_ELEMENTS[p.sign]   || ''
    const mod   = SIGN_MODALITIES[p.sign] || ''
    const hInfo = p.houseNum ? ` · House ${p.houseNum}` : ''
    const info  = `${p.name}|${p.signGlyph} ${p.sign} ${p.label}${p.isRetrograde ? ' ℞' : ''}|${el} · ${mod}${hInfo}`
    return `<line x1="${tp1.x.toFixed(2)}" y1="${tp1.y.toFixed(2)}" x2="${tp2.x.toFixed(2)}" y2="${tp2.y.toFixed(2)}" stroke="${T.planetStroke}" stroke-width="1"/>
${leader}
<g class="planet-group" data-info="${info}" style="cursor:pointer">
  <circle cx="${pos.x.toFixed(2)}" cy="${pos.y.toFixed(2)}" r="${PLANET_R}" fill="${T.planetFill}" fill-opacity="${backdropOpacity}" stroke="${T.planetStroke}" stroke-width="1.2" class="planet-circle"/>
  <text x="${pos.x.toFixed(2)}" y="${pos.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${T.planetText}" font-size="12" font-family="serif" pointer-events="none">${p.glyph}</text>
  ${retroMark}
</g>`
  }).join('\n')

  // ─── Outer planets ────────────────────────────────────────────────────────
  const outerWithSVG = outerPlanets
    .map(p => ({ ...p, svgAngle: e2s(p.absolute, ASC) }))
    .sort((a, b) => a.svgAngle - b.svgAngle)
  const outerDisp      = outerWithSVG.map(p => p.svgAngle)
  const outerRadialOff = new Array(outerWithSVG.length).fill(0)
  const MIN_SEP_O      = 22
  for (let pass = 0; pass < 18; pass++) {
    for (let i = 0; i < outerDisp.length; i++) {
      const j    = (i + 1) % outerDisp.length
      const diff = (((outerDisp[j] - outerDisp[i]) % 360) + 360) % 360
      if (diff < MIN_SEP_O && diff > 0) {
        const push = (MIN_SEP_O - diff) / 2
        outerDisp[i] = ((outerDisp[i] - push) + 360) % 360
        outerDisp[j] = (outerDisp[j] + push) % 360
      }
    }
  }
  const outerAngleGroups = {}
  outerWithSVG.forEach((p, i) => {
    const key = Math.round(p.absolute * 2)
    if (!outerAngleGroups[key]) outerAngleGroups[key] = []
    outerAngleGroups[key].push(i)
  })
  for (const group of Object.values(outerAngleGroups)) {
    if (group.length > 1) {
      group.forEach((idx, layerIdx) => { outerRadialOff[idx] = layerIdx * 26 })
    }
  }

  const outerSVG = outerWithSVG.map((p, idx) => {
    const da       = outerDisp[idx]
    const rOff     = outerRadialOff[idx]
    const outerR   = R_OUT + 34 + rOff
    const tp1      = polar(p.svgAngle, R_OUT + 2,         cx, cy)
    const tp2      = polar(p.svgAngle, R_OUT + 8,         cx, cy)
    const lp1      = polar(p.svgAngle, R_OUT + 9,         cx, cy)
    const lp2      = polar(da,         R_OUT + 22 + rOff,  cx, cy)
    const labelPos = polar(da,         outerR,             cx, cy)
    const el    = SIGN_ELEMENTS[p.sign]   || ''
    const mod   = SIGN_MODALITIES[p.sign] || ''
    const hInfo = p.houseNum ? ` · House ${p.houseNum}` : ''
    const info  = `${p.name}|${p.signGlyph} ${p.sign} ${p.label}${p.isRetrograde ? ' ℞' : ''}|${el} · ${mod}${hInfo}`
    return `<line x1="${tp1.x.toFixed(2)}" y1="${tp1.y.toFixed(2)}" x2="${tp2.x.toFixed(2)}" y2="${tp2.y.toFixed(2)}" stroke="${T.outerPlanetLine}" stroke-width="1"/>
<line x1="${lp1.x.toFixed(2)}" y1="${lp1.y.toFixed(2)}" x2="${lp2.x.toFixed(2)}" y2="${lp2.y.toFixed(2)}" stroke="${T.outerPlanetLine}" stroke-width="0.7"/>
<g class="planet-group" data-info="${info}" style="cursor:pointer">
  <circle cx="${labelPos.x.toFixed(2)}" cy="${labelPos.y.toFixed(2)}" r="11" fill="${T.planetFill}" fill-opacity="${backdropOpacity}" stroke="${T.outerPlanetLine}" stroke-width="1" class="planet-circle"/>
  <text x="${labelPos.x.toFixed(2)}" y="${labelPos.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${T.outerPlanetText}" font-size="10" font-family="serif" pointer-events="none">${p.glyph}</text>
</g>`
  }).join('\n')

  // ─── Legend ───────────────────────────────────────────────────────────────
  const legendHTML = placements.map(p => {
    const isAM   = p.name === 'Ascendant' || p.name === 'Midheaven'
    const prefix = p.name === 'Ascendant' ? 'AC' : p.name === 'Midheaven' ? 'MC' : ''
    return `<div class="bc-row${isAM ? ' bc-row-axis' : ''}">
  <span class="bc-glyph">${prefix || p.glyph}</span>
  <span class="bc-name">${p.name}${p.isRetrograde ? '<span class="bc-retro"> ℞</span>' : ''}</span>
  <span class="bc-sign">${p.signGlyph}</span>
  <span class="bc-pos">${p.sign} ${p.label}${p.houseNum ? ` · H${p.houseNum}` : ''}</span>
</div>`
  }).join('')

  const titleMatch   = prompt.match(/^([A-Z][a-zA-Z\s'\-]+?)(?:\s*[-–—:]|\s+birth|\s+natal|\s+chart|\s+astrological)/i)
  const chartTitle   = titleMatch ? titleMatch[1].trim() : 'Natal Chart'
  const bdMatch      = prompt.match(/birth\s*details?\s*[:\-]?\s*([^\n]+)/i)
  const birthDetails = bdMatch ? bdMatch[1].trim() : ''

  const VSIZE  = SIZE + 90
  const OFFSET = 45

  return `<style>
  .bc-wrap{width:100%;display:flex;justify-content:center;padding:20px 12px;box-sizing:border-box;background:${T.bg};min-height:100vh;}
  .bc-card{width:100%;max-width:1120px;background:${T.cardBg};border-radius:18px;padding:24px 20px;box-sizing:border-box;border:1px solid ${T.cardBorder};}
  .bc-header{margin-bottom:16px;}
  .bc-title{font-size:20px;font-weight:600;color:${T.titleColor};margin:0 0 3px;font-family:Georgia,serif;letter-spacing:0.03em;line-height:1.3;word-break:break-word;overflow-wrap:break-word;}
  .bc-sub{font-size:11px;color:${T.subColor};margin:0;line-height:1.5;word-break:break-word;overflow-wrap:break-word;}
  .bc-layout{display:grid;grid-template-columns:minmax(0,${VSIZE+10}px) minmax(200px,1fr);gap:20px;align-items:start;}
  .bc-svg-box{background:radial-gradient(ellipse at 50% 50%,${T.svgBgInner} 0%,${T.svgBgOuter} 80%);border-radius:14px;display:flex;justify-content:center;align-items:center;padding:6px;box-sizing:border-box;position:relative;}
  .bc-legend{background:${T.legendBg};border:1px solid ${T.legendBorder};border-radius:12px;padding:12px 10px;box-sizing:border-box;max-height:680px;overflow-y:auto;}
  .bc-legend-title{font-size:10px;font-weight:700;color:${T.legendTitleColor};margin:0 0 8px;text-transform:uppercase;letter-spacing:0.08em;line-height:1.5;}
  .bc-row{display:grid;grid-template-columns:22px 1fr 16px auto;align-items:center;gap:4px;padding:4px 0;border-bottom:1px solid ${T.isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)'};line-height:1.4;}
  .bc-row-axis{background:${T.isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)'};}
  .bc-glyph{font-size:12px;color:${T.isDark?'#e2e8f0':'#1a1a2e'};text-align:center;font-family:serif;font-weight:600;}
  .bc-name{font-size:10px;color:${T.legendNameColor};word-break:break-word;overflow-wrap:break-word;}
  .bc-retro{font-size:9px;opacity:0.65;}
  .bc-sign{font-size:11px;color:${T.isDark?'#94a3b8':'#555'};text-align:center;font-family:serif;}
  .bc-pos{font-size:9px;color:${T.legendPosColor};white-space:nowrap;text-align:right;}
  .bc-aspect-key{margin-top:10px;padding-top:8px;border-top:1px solid ${T.isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'};}
  .bc-aspect-title{font-size:9px;font-weight:700;color:${T.legendTitleColor};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;line-height:1.5;}
  .bc-asp-row{display:flex;align-items:center;gap:5px;padding:2px 0;}
  .bc-asp-line{width:16px;height:2px;flex-shrink:0;border-radius:1px;}
  .bc-asp-label{font-size:9px;color:${T.isDark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.45)'};}
  .planet-group:hover .planet-circle{stroke-width:2.5!important;filter:brightness(1.4);}
  .bc-tooltip{position:absolute;background:${T.tooltipBg};border:1px solid ${T.tooltipBorder};border-radius:10px;padding:9px 12px;pointer-events:none;opacity:0;transition:opacity 0.12s;z-index:100;min-width:148px;max-width:210px;box-shadow:0 4px 24px rgba(0,0,0,0.5);}
  .bc-tooltip.vis{opacity:1;}
  .bc-tt-name{font-size:12px;font-weight:700;color:${T.tooltipText};margin-bottom:3px;font-family:Georgia,serif;line-height:1.4;}
  .bc-tt-pos{font-size:11px;color:${T.tooltipText};opacity:0.9;margin-bottom:2px;line-height:1.4;}
  .bc-tt-sub{font-size:10px;color:${T.tooltipText};opacity:0.55;line-height:1.4;}
  @media(max-width:900px){.bc-layout{grid-template-columns:1fr}}
</style>
<div class="bc-wrap">
<div class="bc-card">
  <div class="bc-header">
    <h2 class="bc-title">${chartTitle}</h2>
    <p class="bc-sub">${birthDetails || 'Astrological Birth Chart · Placidus Houses · Hover or click planets for details'}</p>
  </div>
  <div class="bc-layout">
    <div class="bc-svg-box" id="bcCont">
      <div class="bc-tooltip" id="bcTip">
        <div class="bc-tt-name" id="bcTipName"></div>
        <div class="bc-tt-pos"  id="bcTipPos"></div>
        <div class="bc-tt-sub"  id="bcTipSub"></div>
      </div>
      <svg viewBox="${-OFFSET} ${-OFFSET} ${VSIZE} ${VSIZE}" ...>
  <!-- 1. Deep background -->
  <circle cx="${cx}" cy="${cy}" r="${R_OUT+55}" fill="${T.bg}"/>

  <!-- 2. The Rings -->
  ${zodSVG}
  ${tickSVG}
  ${spokeSVG}
  ${houseBandSVG}

  <!-- 3. The Inner Circle - The "Seal" -->
  <circle cx="${cx}" cy="${cy}" r="${R_HOU_I}" fill="${T.innerCircle}" stroke="${T.innerCircle}" stroke-width="8"/>

  <!-- 4. Everything else -->
  ${houseNumberSVG}
  ${aspectSVG.join('\n')}
  ${axesSVG}
  ${innerSVG}
  ${outerSVG}
  <circle cx="${cx}" cy="${cy}" r="3.5" fill="${T.centerDot}"/>
</svg>
    </div>
    <div class="bc-legend">
      <p class="bc-legend-title">Planetary Positions</p>
      ${legendHTML}
      <div class="bc-aspect-key">
        <p class="bc-aspect-title">Aspects</p>
        <div class="bc-asp-row"><div class="bc-asp-line" style="background:${T.aspectConj}"></div><span class="bc-asp-label">Conjunction 0°</span></div>
        <div class="bc-asp-row"><div class="bc-asp-line" style="background:${T.aspectSext}"></div><span class="bc-asp-label">Sextile 60°</span></div>
        <div class="bc-asp-row"><div class="bc-asp-line" style="background:${T.aspectSq}"></div><span class="bc-asp-label">Square 90°</span></div>
        <div class="bc-asp-row"><div class="bc-asp-line" style="background:${T.aspectTrine}"></div><span class="bc-asp-label">Trine 120°</span></div>
        <div class="bc-asp-row"><div class="bc-asp-line" style="background:${T.aspectOpp};opacity:0.8"></div><span class="bc-asp-label">Opposition 180°</span></div>
      </div>
    </div>
  </div>
</div>
</div>
<script>
(function(){
  const tip   = document.getElementById('bcTip');
  const tName = document.getElementById('bcTipName');
  const tPos  = document.getElementById('bcTipPos');
  const tSub  = document.getElementById('bcTipSub');
  const cont  = document.getElementById('bcCont');
  if (!tip || !cont) return;
  function show(e, info) {
    const parts = info.split('|');
    tName.textContent = parts[0] || '';
    tPos.textContent  = parts[1] || '';
    tSub.textContent  = parts[2] || '';
    tip.classList.add('vis');
    move(e);
  }
  function move(e) {
    const r  = cont.getBoundingClientRect();
    let x    = e.clientX - r.left + 14;
    let y    = e.clientY - r.top  - 10;
    const tw = tip.offsetWidth  || 160;
    const th = tip.offsetHeight || 72;
    if (x + tw > r.width  - 6) x = e.clientX - r.left - tw - 14;
    if (y + th > r.height - 6) y = e.clientY - r.top  - th - 10;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top  = Math.max(4, y) + 'px';
  }
  function hide() { tip.classList.remove('vis'); }
  document.querySelectorAll('.planet-group').forEach(function(g) {
    g.addEventListener('mouseenter', function(e) { show(e, g.dataset.info); });
    g.addEventListener('mousemove',  function(e) { move(e); });
    g.addEventListener('mouseleave', hide);
    g.addEventListener('click', function(e) {
      show(e, g.dataset.info);
      setTimeout(hide, 3200);
    });
  });
})();
<\/script>`
}

// ─── Style System ─────────────────────────────────────────────────────────────

const LAYOUT_VARIANTS = [
  { name: 'centered-card', wrap: 'display:flex;justify-content:center;align-items:flex-start;padding:48px 24px;width:100%;box-sizing:border-box;' },
  { name: 'full-width', wrap: 'display:flex;flex-direction:column;padding:40px;width:100%;box-sizing:border-box;' },
  { name: 'split', wrap: 'display:grid;grid-template-columns:1fr 1fr;gap:32px;padding:48px;width:100%;box-sizing:border-box;' },
]

const STYLE_NUDGES = [
  'Use bold high-contrast typography with strong visual hierarchy. Use generous padding of at least 32px inside cards. Ensure all text has enough breathing room.',
  'Use a minimal layout with generous white space. Card padding: 40px minimum. Gap between elements: 20px minimum. Text must never touch borders.',
  'Use an editorial style with large display typography. Ensure section spacing of at least 24px. Buttons must have 14px vertical padding and 24px horizontal padding.',
  'Use a detailed information-dense layout with clear visual separation between sections. Dividers between sections. Consistent 16px gap rhythm.',
  'Prioritize clarity and scanability. Large readable font sizes (minimum 14px body). Ample line-height of 1.6. Sections clearly separated with 24px gaps.',
  'Use a premium understated aesthetic. Subtle borders, refined 36px card padding, 18px between form fields, comfortable 1.5 line-height throughout.',
  'Make the layout feel spacious and open. 48px outer padding, 24px inner section gaps, never let two elements touch without at least 12px between them.',
  'Use a structured grid layout with clear visual alignment. All columns have consistent gutters of 24px. Headings have 8px bottom margin before content.',
]

const TYPOGRAPHY_VARIANTS = [
  'Font pairing: large bold sans-serif headings (28-32px, weight 800) with regular body text (15px, weight 400).',
  'Font pairing: elegant serif headings (24px, weight 600) with clean sans-serif body (14px).',
  'Font pairing: uppercase tracked headings (14px, weight 700, letter-spacing 0.12em) with normal body text (15px).',
  'Font pairing: extra-large display heading (36px, weight 900) with small detail text (13px).',
]

const CARD_SHAPE_VARIANTS = [
  'border-radius:12px',
  'border-radius:20px',
  'border-radius:6px',
  'border-radius:24px',
  'border-radius:16px',
]

const COLOR_PALETTE_VARIANTS = [
  { bg: '#ffffff', surface: '#f8f9fa', text: '#111827', muted: '#6b7280', accent: '#3b82f6', border: '#e5e7eb' },
  { bg: '#0f172a', surface: '#1e293b', text: '#f1f5f9', muted: '#94a3b8', accent: '#818cf8', border: '#334155' },
  { bg: '#fafaf9', surface: '#ffffff', text: '#1c1917', muted: '#78716c', accent: '#f59e0b', border: '#e7e5e4' },
  { bg: '#0c0a09', surface: '#1c1917', text: '#fafaf9', muted: '#a8a29e', accent: '#fb923c', border: '#292524' },
  { bg: '#f0fdf4', surface: '#ffffff', text: '#14532d', muted: '#4ade80', accent: '#22c55e', border: '#bbf7d0' },
  { bg: '#fdf4ff', surface: '#ffffff', text: '#4a044e', muted: '#a855f7', accent: '#c026d3', border: '#f0abfc' },
  { bg: '#fff1f2', surface: '#ffffff', text: '#881337', muted: '#f43f5e', accent: '#e11d48', border: '#fecdd3' },
  { bg: '#ecfeff', surface: '#ffffff', text: '#164e63', muted: '#22d3ee', accent: '#0891b2', border: '#a5f3fc' },
]

function getRandomVariants() {
  const nudge = STYLE_NUDGES[Math.floor(Math.random() * STYLE_NUDGES.length)]
  const typo  = TYPOGRAPHY_VARIANTS[Math.floor(Math.random() * TYPOGRAPHY_VARIANTS.length)]
  const shape = CARD_SHAPE_VARIANTS[Math.floor(Math.random() * CARD_SHAPE_VARIANTS.length)]
  const palette = COLOR_PALETTE_VARIANTS[Math.floor(Math.random() * COLOR_PALETTE_VARIANTS.length)]
  return { nudge, typo, shape, palette }
}

function buildSystemPrompt(gradient, includeGlass, includeVisualization, includeImages, prompt) {

  const { nudge, typo, shape, palette } = getRandomVariants()

  const lower = prompt.toLowerCase()

  // ─── Request type detectors ───────────────────────────────────────────────

  const isDatingProfile =
    lower.includes('dating') || lower.includes('hinge') || lower.includes('tinder') ||
    lower.includes('bumble') || lower.includes('dating profile') || lower.includes('match') ||
    lower.includes('swipe') || lower.includes('profile card') && (lower.includes('age') || lower.includes('bio'))

  const isSocialCard =
    lower.includes('tweet') || lower.includes('instagram') || lower.includes('post card') ||
    lower.includes('social media') || lower.includes('feed') || lower.includes('story card') ||
    lower.includes('linkedin post') || lower.includes('facebook')

  const isTableOrGrid =
    lower.includes('table') || lower.includes('data grid') || lower.includes('spreadsheet') ||
    lower.includes('leaderboard') || lower.includes('comparison table') || lower.includes('pricing table')

  const isNavOrHeader =
    lower.includes('navbar') || lower.includes('navigation') || lower.includes('header') ||
    lower.includes('top bar') || lower.includes('menu bar') || lower.includes('sidebar')

  const isTimeline =
    lower.includes('timeline') || lower.includes('activity feed') || lower.includes('history log') ||
    lower.includes('event log') || lower.includes('changelog') || lower.includes('steps')

  const isKanban =
    lower.includes('kanban') || lower.includes('task board') || lower.includes('trello') ||
    lower.includes('columns') && lower.includes('cards') || lower.includes('drag')

  const isMediaPlayer =
    lower.includes('music player') || lower.includes('audio player') || lower.includes('video player') ||
    lower.includes('podcast') || lower.includes('now playing') || lower.includes('playlist')

  const isEcommerce =
    lower.includes('product card') || lower.includes('shop') || lower.includes('cart') ||
    lower.includes('checkout') || lower.includes('ecommerce') || lower.includes('store') ||
    lower.includes('add to cart') || lower.includes('buy now')

  const isRecipeCard =
    lower.includes('recipe') || lower.includes('ingredients') || lower.includes('cooking') ||
    lower.includes('meal') || lower.includes('food card')

  const isCalendar =
    lower.includes('calendar') || lower.includes('scheduler') || lower.includes('booking') ||
    lower.includes('availability') || lower.includes('date picker')

  // ─── Color detection ──────────────────────────────────────────────────────

  const hasExplicitColor = Object.keys(COLOR_MAP).some(c => lower.includes(c)) ||
    lower.includes('dark') || lower.includes('light') || lower.includes('black') ||
    lower.includes('white') || lower.includes('red') || lower.includes('blue') ||
    lower.includes('sage') || lower.includes('gold') || lower.includes('purple')

  const paletteSection = hasExplicitColor ? `
COLOR: The user has specified a color preference. Honor it precisely. Use it for backgrounds, accents, borders and highlights throughout.
` : `
COLOR PALETTE FOR THIS GENERATION:
- Background: ${palette.bg}
- Surface/Card: ${palette.surface}
- Primary text: ${palette.text}
- Muted text: ${palette.muted}
- Accent: ${palette.accent}
- Border: ${palette.border}
Use these exact colors. They ensure visual variety between generations.
`

  // ─── Glass section ────────────────────────────────────────────────────────

  const glassSection = includeGlass ? `
GLASSMORPHISM — FOLLOW EXACTLY:
- NEVER use Tailwind for glass. Use only the CSS classes below.
- Gradient: ${gradient} — copy exactly.

SINGLE GLASS CARD:
<style>
  .g-wrap { background:${gradient}; min-height:100vh; width:max-content; min-width:100%; display:flex; align-items:flex-start; justify-content:center; padding:48px; box-sizing:border-box; }
  .g-card { backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:24px; padding:48px; box-shadow:0 25px 50px rgba(0,0,0,0.3); width:100%; max-width:480px; min-width:320px; box-sizing:border-box; position:relative; z-index:1; }
  .g-title { font-size:22px; font-weight:700; color:white; margin:0 0 8px; line-height:1.4; word-break:break-word; overflow-wrap:break-word; }
  .g-sub { font-size:14px; color:rgba(255,255,255,0.75); margin:0 0 24px; line-height:1.6; word-break:break-word; overflow-wrap:break-word; }
  .g-label { font-size:13px; font-weight:500; color:rgba(255,255,255,0.8); display:block; margin-bottom:6px; line-height:1.5; }
  .g-input { display:block; width:100%; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.35); border-radius:10px; padding:12px 16px; color:white; font-size:14px; box-sizing:border-box; margin-bottom:16px; }
  .g-btn { display:block; width:100%; background:rgba(255,255,255,0.25); color:white; border:1px solid rgba(255,255,255,0.45); padding:13px 24px; border-radius:12px; cursor:pointer; font-weight:600; font-size:14px; text-align:center; white-space:nowrap; word-break:normal; overflow-wrap:normal; box-sizing:border-box; }
  .g-price-row { display:flex; flex-direction:row; align-items:baseline; gap:2px; margin:12px 0 20px; flex-wrap:nowrap; }
  .g-price-currency { font-size:16px; font-weight:600; color:white; white-space:nowrap; }
  .g-price-amount { font-size:28px; font-weight:700; color:white; white-space:nowrap; line-height:1; }
  .g-price-period { font-size:12px; color:rgba(255,255,255,0.7); white-space:nowrap; margin-left:3px; }
  .g-feature { font-size:13px; color:rgba(255,255,255,0.85); padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.12); word-break:break-word; overflow-wrap:break-word; line-height:1.6; }
  input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.55); }
</style>
<div class="g-wrap"><div class="g-card"><!-- content here --></div></div>

MULTIPLE GLASS CARDS SIDE BY SIDE:
<style>
  .g-wrap { background:${gradient}; min-height:100vh; width:max-content; min-width:100%; display:flex; align-items:flex-start; justify-content:flex-start; padding:48px; box-sizing:border-box; }
  .g-row { display:flex; flex-direction:row; gap:24px; align-items:stretch; }
  .g-card { backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:24px; padding:32px; box-shadow:0 25px 50px rgba(0,0,0,0.3); width:280px; min-width:240px; flex-shrink:0; display:flex; flex-direction:column; box-sizing:border-box; position:relative; z-index:1; }
  .g-title { font-size:18px; font-weight:700; color:white; margin:0 0 6px; line-height:1.4; word-break:break-word; overflow-wrap:break-word; }
  .g-sub { font-size:13px; color:rgba(255,255,255,0.75); margin:0 0 20px; line-height:1.6; word-break:break-word; overflow-wrap:break-word; }
  .g-price-row { display:flex; flex-direction:row; align-items:baseline; gap:2px; margin:0 0 16px; flex-wrap:nowrap; }
  .g-price-currency { font-size:15px; font-weight:600; color:white; white-space:nowrap; }
  .g-price-amount { font-size:28px; font-weight:700; color:white; white-space:nowrap; line-height:1; }
  .g-price-period { font-size:12px; color:rgba(255,255,255,0.7); white-space:nowrap; margin-left:3px; }
  .g-features { list-style:none; margin:0 0 20px; padding:0; flex:1; }
  .g-feature { font-size:13px; color:rgba(255,255,255,0.85); padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.12); word-break:break-word; overflow-wrap:break-word; line-height:1.6; }
  .g-btn { background:rgba(255,255,255,0.25); color:white; border:1px solid rgba(255,255,255,0.45); padding:12px 20px; border-radius:12px; cursor:pointer; font-weight:600; font-size:13px; width:100%; margin-top:auto; white-space:nowrap; word-break:normal; overflow-wrap:normal; box-sizing:border-box; }
  input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.55); }
</style>
<div class="g-wrap"><div class="g-row"><div class="g-card"><!-- card 1 --></div><div class="g-card"><!-- card 2 --></div></div></div>
Do not nest glass inside glass. No Tailwind in glass components.
` : `
NON-GLASS COMPONENTS:
${paletteSection}
- All styles in a <style> block as named CSS classes.
- Cards: box-sizing:border-box; position:relative; overflow:visible; padding min 32px; ${shape}; box-shadow:0 2px 12px rgba(0,0,0,0.08);
- Single card: center with display:flex;justify-content:center;align-items:flex-start;width:100%;padding:48px;
- Text on dark bg must be light. Text on light bg must be dark. NEVER invisible text.
`

  // ─── NEW: Dating profile section ──────────────────────────────────────────

  const datingSection = isDatingProfile ? `
DATING PROFILE CARD RULES:
You are building a dating app profile card in the style of Hinge, Tinder, or Bumble.

PHOTO:
- Always show a large profile photo at the top using https://i.pravatar.cc/300?img= followed by a number 1-70
- Photo must fill the full card width, height 280-320px, object-fit:cover, border-radius on top corners only (e.g. border-radius:20px 20px 0 0)
- If multiple people are shown, use a different ?img= number for each

PROFILE INFO:
- Name (large, bold, 22-26px) + Age on the same line
- Location with a small pin icon (use a unicode ● or 📍 only if emojis are enabled, otherwise a small dot)
- Short bio or tagline in muted text below

PROMPT + ANSWER BLOCKS (Hinge style):
- Show 2-3 prompt blocks. Each has: a question label in small muted uppercase text, and a larger answer below it
- Example questions: "The way to win me over is...", "My love language is...", "The most spontaneous thing I've done...", "I'm looking for...", "A green flag I look for...", "My ideal Sunday is...", "I'll know it's time to delete this app when..."
- Each block has a subtle border, rounded corners (12px), padding 16px, background slightly offset from card

INTEREST TAGS:
- Show 3-6 interest tags as small pill-shaped badges (border-radius:20px, padding:6px 14px, font-size:12px)
- Examples: Hiking, Coffee, Vinyl Records, Dog Parent, Homebody, Foodie

ACTION BUTTONS:
- Row of action buttons at bottom: X (pass) on left, Heart (like) on right
- X button: light grey background, dark icon
- Heart button: accent color background (pink, red, or gradient), white icon
- Buttons are circles, 52px diameter, centered icons

CARD DIMENSIONS:
- max-width:380px, use rounded corners 20px, shadow, centered on page
- Card feels like a real mobile app card — compact, scrollable content, no wasted space
` : ''

  // ─── NEW: Social media card section ──────────────────────────────────────

  const socialSection = isSocialCard ? `
SOCIAL MEDIA CARD RULES:
- Match the visual style of the requested platform (Twitter/X = dark or light minimal; Instagram = colorful, image-forward; LinkedIn = professional blue/white)
- Always include: avatar (pravatar), username, handle or tagline, timestamp, post content
- Twitter/X cards: show like count, retweet count, reply count as small icon+number rows at bottom
- Instagram cards: show image area (picsum), likes, comment count, action icons (heart, comment, share, bookmark)
- LinkedIn cards: professional header, company/role subtitle, engagement bar
- Content should look real and populated — no lorem ipsum
` : ''

  // ─── NEW: Table and data grid section ─────────────────────────────────────

  const tableSection = isTableOrGrid ? `
TABLE AND DATA GRID RULES:
- Use a real <table> element with <thead> and <tbody>
- Header row: slightly darker background, bold text, uppercase small labels
- Alternating row backgrounds for readability (zebra striping)
- All cells: padding 12px 16px, border-bottom on rows only (no grid lines)
- Numbers: right-aligned, monospace font
- Status badges in cells: use small colored pill badges (border-radius:12px, padding:3px 10px)
- Table must be horizontally scrollable on small containers: wrap in div with overflow-x:auto
- Include a table header/title above with optional search input or filter row
` : ''

  // ─── NEW: Navigation and header section ──────────────────────────────────

  const navSection = isNavOrHeader ? `
NAVIGATION / HEADER RULES:
- Full-width header bar, height 60-72px, sticky or fixed if specified
- Logo on left (text-based or icon+text), nav links in center or right
- Active link has accent underline or background highlight
- Mobile hamburger icon on right (show as ☰ unicode, no JS needed for display)
- Include a CTA button (e.g. "Sign Up", "Get Started") on far right if it fits the context
- Sidebar nav: full-height left panel, 240-260px wide, icons + labels per item, active state with accent background
` : ''

  // ─── NEW: Timeline section ────────────────────────────────────────────────

  const timelineSection = isTimeline ? `
TIMELINE / ACTIVITY FEED RULES:
- Use a vertical left-border line as the timeline spine (2px, accent color)
- Each item: dot on the spine line, content block to the right
- Dot: 10-12px circle, filled with accent color, aligned to spine
- Content block: title bold, subtitle muted, timestamp small and right-aligned or below title
- Alternate subtle background on every other item for readability
- Show at least 4-5 timeline entries
- Most recent at top unless specified otherwise
` : ''

  // ─── NEW: Kanban board section ────────────────────────────────────────────

  const kanbanSection = isKanban ? `
KANBAN BOARD RULES:
- Display 3-4 columns side by side: e.g. To Do, In Progress, Review, Done
- Each column: header with label + item count badge, scrollable card list below
- Column cards: white/light surface, subtle shadow, border-radius 10px, padding 14px
- Card contents: title, optional tag/label pill, optional avatar, optional due date
- Column headers: bold label + small count badge in accent color
- Columns use display:flex;flex-direction:column;gap:12px
- Overall layout: display:flex;flex-direction:row;gap:20px;overflow-x:auto
` : ''

  // ─── NEW: Media player section ────────────────────────────────────────────

  const mediaSection = isMediaPlayer ? `
MEDIA PLAYER RULES:
- Show album art or thumbnail as a square image (picsum, 200-240px)
- Track title bold, artist name muted below
- Progress bar: full-width, thin (4-6px height), with filled portion in accent color, rounded ends, clickable appearance
- Time stamps: current time left, total duration right, below progress bar
- Control buttons row: previous ⏮, play/pause ▶ (larger, 48px circle), next ⏭ — centered
- Secondary controls: shuffle, repeat, volume icon — smaller, muted color
- Visualizer bars or waveform optional — use simple CSS rectangles of varying heights if included
` : ''

  // ─── NEW: E-commerce section ──────────────────────────────────────────────

  const ecommerceSection = isEcommerce ? `
E-COMMERCE COMPONENT RULES:
- Product image: full-width or left column, use picsum with product-related seed keyword
- Price: large and bold, show original + sale price if discounted (strikethrough on original)
- Add to Cart button: full-width or prominent, accent background, high contrast text
- Product rating: show as ★ characters + numeric score + review count
- Stock status: "In Stock" in green, "Low Stock" in amber, "Out of Stock" in red
- Size/variant selectors: show as clickable pill buttons with selected state
- Wishlist heart icon: top-right of image, subtle
- Shipping info: small muted text below price
` : ''

  // ─── NEW: Recipe card section ─────────────────────────────────────────────

  const recipeSection = isRecipeCard ? `
RECIPE CARD RULES:
- Hero food photo at top (picsum with food-related seed)
- Recipe title bold and large, short description below
- Meta row: prep time, cook time, servings — icons or small labels, displayed inline
- Ingredients list: clean unordered list, checkbox-style bullets, grouped if needed
- Instructions: numbered list, each step clearly separated with generous spacing
- Tags: dietary labels like Vegan, Gluten-Free, Quick as small colored pills
- Difficulty badge: Easy/Medium/Hard in accent color
` : ''

  // ─── NEW: Calendar and scheduler section ─────────────────────────────────

  const calendarSection = isCalendar ? `
CALENDAR / SCHEDULER RULES:
- Month grid layout: 7 columns (Sun-Sat), 5-6 rows of date cells
- Header: month + year, prev/next arrow buttons
- Today's date: highlighted with accent background circle
- Events on dates: small colored dot or pill below the number
- Date cells: equal size, min 40x40px, hover state with light background
- Time slot scheduler: left column of times (9am-6pm), right area of event blocks
- Booked slots: colored block with event title, duration-proportional height
- Available slots: light dashed border, clickable appearance
` : ''

  // ─── Existing sections ────────────────────────────────────────────────────

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
` : ''

  return `You are a world-class Design Engineer. Return ONLY raw HTML.

OUTPUT FORMAT — CRITICAL:
- Start with <style> or <div> or <svg>. Nothing before it.
- No explanation, no markdown, no backticks, no code fences.
- If you cannot produce valid HTML return exactly: <div>Error</div>

STYLE DIRECTION FOR THIS GENERATION:
${nudge}
${typo}
Card shape: ${shape}

SPACING RULES — ENFORCE STRICTLY:
- Card inner padding: minimum 32px, preferred 40px.
- Between sections inside a card: minimum 20px gap or margin.
- Between label and input: 6-8px.
- Between form fields: 14-16px.
- Between cards in a row: 24px gap.
- Outer wrapper padding: minimum 40px.
- Button padding: minimum 12px vertical, 24px horizontal.
- Line-height on all text: minimum 1.5.
- Never let any two elements touch with zero space between them.

CSS RULES:
- Always begin with a <style> block of named CSS classes.
- Use class names throughout. Only inline style="" for truly one-off values.
- Every text element: word-break:break-word; overflow-wrap:break-word; line-height:1.5;
- NEVER use writing-mode, text-orientation, or transform:rotate on text.
- NEVER use overflow:hidden on cards or containers.
- Cards always grow vertically to fit content.
- NEVER use border-radius:50% or border-radius:999px on any card, container, wrapper, section, or background element. Oval and pill-shaped backgrounds are strictly forbidden. Only use border-radius:50% on avatar img tags or icon circles smaller than 72px.

BUTTONS:
- white-space:nowrap; word-break:normal; overflow-wrap:normal;
- Padding: min 12px vertical, 24px horizontal.
- Labels never wrap. Never truncate button text.
- Two buttons side by side: .btn-row{display:flex;flex-direction:row;gap:12px;flex-wrap:wrap;}

PRICES:
- .price-row{display:flex;flex-direction:row;align-items:baseline;gap:2px;flex-wrap:nowrap;}
- .price-amount{font-size:28px;font-weight:700;white-space:nowrap;line-height:1;}

STARS: Only ★ ☆ in spans. Never SVG stars. Only if prompt mentions "star/rating/review".
EMOJIS: Banned unless explicitly requested.
LINKS: All href starts https://. Add target="_blank" rel="noopener noreferrer".
AVATARS: If the prompt mentions avatar, profile photo, profile picture, headshot, or user photo — use a REAL photo from https://i.pravatar.cc/150?img= followed by a random number between 1 and 70. Use a different number for each person. Style with border-radius:50% on the img tag only, equal width and height (48px–72px), object-fit:cover. If no photo is mentioned, use a colored circle div with initials instead. NEVER use border-radius:50% on cards, wrappers, or containers — only on avatar img tags or small icon circles under 72px.
JAVASCRIPT: Single script at bottom. Unique ids on interactive elements.
BANNED: writing-mode, text-orientation, transform:rotate on text, vertical text of any kind.

${datingSection}
${socialSection}
${tableSection}
${navSection}
${timelineSection}
${kanbanSection}
${mediaSection}
${ecommerceSection}
${recipeSection}
${calendarSection}
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

  useEffect(() => {
    if (!devMode) { getGuestUsage().then(setGuestUsage) }
  }, [devMode])

  const titleClickCount = useRef(0)
  const titleClickTimer = useRef(null)

  const handleTitleClick = () => {
    titleClickCount.current += 1
    clearTimeout(titleClickTimer.current)
    if (titleClickCount.current >= 5) {
      titleClickCount.current = 0
      const devPassword = import.meta.env.VITE_DEV_PASSWORD
      if (!devPassword) return
      const input = window.prompt('Developer access code:')
      if (input && input === devPassword) {
        try { localStorage.setItem('cl_dev', '1') } catch {}
        setDevMode(true)
      }
      return
    }
    titleClickTimer.current = setTimeout(() => { titleClickCount.current = 0 }, 2000)
  }

  const recordGeneration = async () => {
    if (devMode) return
    const updated = await incrementGuestUsage()
    if (updated) setGuestUsage(updated)
  }

  const generateUI = async () => {
    if (!prompt.trim()) return
    if (!devMode) {
      const usage = await getGuestUsage()
      if (usage.count >= GUEST_DAILY_LIMIT) {
        setError(`You've used all ${GUEST_DAILY_LIMIT} demo generations for today. Resets at midnight — or feel free to reach out if you'd like to see more!`)
        return
      }
    }

    setLoading(true)
    setError('')
    setGeneratedCode('')

    if (isBirthChartRequest(prompt)) {
      try {
        const birthChartHTML = buildBirthChartHTML(prompt)
        setGeneratedCode(birthChartHTML)
        setActiveModel('local-renderer')
        setHistory(prev => [{
          id: Date.now(), prompt, code: birthChartHTML, gradient: '',
          timestamp: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
        }, ...prev])
        await recordGeneration()
        setLoading(false)
        return
      } catch (err) {
        console.error('Local birth chart renderer failed:', err)
      }
    }

    const glassRequest         = isGlassRequest(prompt)
    const gradient             = glassRequest ? selectGradient(prompt) : ''
    const visualizationRequest = isVisualizationRequest(prompt)
    const imageRequest         = isImageRequest(prompt)
    const systemPrompt         = buildSystemPrompt(gradient, glassRequest, visualizationRequest, imageRequest, prompt)
    const userMessage          = `Create this UI component: ${prompt}`
    const estimatedTokens      = estimateTokens(systemPrompt + userMessage)

    const modelsToTry = MODELS.filter(model => {
      if (model === 'llama-3.1-8b-instant') return estimatedTokens < SMALL_MODEL_TOKEN_LIMIT
      return true
    })
    const finalModels = modelsToTry.length > 0 ? modelsToTry : MODELS.slice(1)

    for (const model of finalModels) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${import.meta.env.VITE_GROQ_API_KEY}` },
          body: JSON.stringify({
            model, temperature: 0.8,
            messages: [
              { role:'system', content:systemPrompt },
              { role:'user',   content:userMessage  },
            ],
            max_tokens: 1600,
          }),
        })

        if (response.status === 429) { console.warn(`${model} rate limited.`); continue }
        if (!response.ok) {
          const errData = await response.json().catch(()=>({}))
          const errMsg  = errData?.error?.message || response.statusText || ''
          if (isRequestTooLarge(response.status, errMsg)) { console.warn(`${model} too large.`); continue }
          console.warn(`${model} error ${response.status}: ${errMsg}.`); continue
        }

        const data = await response.json()
        if (!data.choices?.[0]?.message?.content) { console.warn(`${model} empty.`); continue }

        const cleaned = cleanCode(data.choices[0].message.content)
        if (!isValidHTML(cleaned)) { console.warn(`${model} non-HTML.`); continue }

        const code = sanitizeOutput(cleaned, prompt)
        setActiveModel(model)
        setGeneratedCode(code)
        setHistory(prev => [{
          id: Date.now(), prompt, code, gradient,
          timestamp: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
        }, ...prev])
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
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  const handleClear = () => {
    setPrompt('')
    setGeneratedCode('')
    setError('')
  }

  const modelLabel = activeModel.includes('/') ? activeModel.split('/')[1] : activeModel
  const generationsLeft = Math.max(0, GUEST_DAILY_LIMIT - guestUsage.count)

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <header className="border-b border-zinc-200 bg-white px-8 py-5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1
              className="text-lg font-semibold text-zinc-900 tracking-tight cursor-default select-none"
              onClick={handleTitleClick}
            >
              Website UI Component Lab — AI Design Engine
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">Describe a UI component. Watch it appear.</p>
          </div>
          <div className="flex items-center gap-3">
            {loading && <span className="text-xs text-zinc-400 animate-pulse">Generating...</span>}
            {!devMode && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${generationsLeft<=2?'bg-amber-50 text-amber-600 border border-amber-200':'bg-zinc-100 text-zinc-500'}`} title="Demo generations remaining today">
                {generationsLeft} / {GUEST_DAILY_LIMIT} left today
              </span>
            )}
            {devMode && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-200 font-medium">Dev mode</span>
            )}
            <span className="text-xs text-zinc-300 font-mono">{modelLabel}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PromptPanel prompt={prompt} setPrompt={setPrompt} onGenerate={generateUI} onClear={handleClear} loading={loading} />
        <PreviewPanel generatedCode={generatedCode} loading={loading} error={error} prompt={prompt} />
      </main>

      {history.length > 0 && (
        <>
          <div className="max-w-7xl mx-auto px-8"><div className="border-t border-zinc-200"/></div>
          <div className="py-8"><SessionHistory history={history} onRestore={handleRestore} /></div>
        </>
      )}

      <Footer />
    </div>
  )
}

export default App