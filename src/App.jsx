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

// ─── Theme System ─────────────────────────────────────────────────────────────

// Parse explicit color keywords from prompt - checked FIRST before random
function parseExplicitColors(prompt) {
  const lower = prompt.toLowerCase()
  const found = []

  const colorKeywords = [
    { keys: ['red','crimson','scarlet','ruby','rose red'], id: 'red' },
    { keys: ['blue','cobalt','royal blue','sapphire','navy blue','midnight blue','azure','cerulean'], id: 'blue' },
    { keys: ['navy','indigo'], id: 'navy' },
    { keys: ['green','emerald','forest','lime','jade','olive'], id: 'green' },
    { keys: ['sage','sage green'], id: 'sage' },
    { keys: ['purple','violet','lavender','amethyst','plum'], id: 'purple' },
    { keys: ['gold','amber','mustard','honey'], id: 'gold' },
    { keys: ['orange','coral','peach','terracotta'], id: 'orange' },
    { keys: ['pink','magenta','fuchsia','rose'], id: 'pink' },
    { keys: ['teal','turquoise','aqua','seafoam'], id: 'teal' },
    { keys: ['cyan','electric blue','ice'], id: 'cyan' },
    { keys: ['black','midnight','obsidian','onyx','noir'], id: 'black' },
    { keys: ['white','ivory','cream','pearl','parchment','light','minimal'], id: 'white' },
    { keys: ['warm','vintage','sepia','bronze','copper'], id: 'warm' },
    { keys: ['cosmic','galaxy','space','nebula','stellar'], id: 'cosmic' },
    { keys: ['monochrome','mono','grayscale','grey','gray'], id: 'mono' },
    { keys: ['neon','electric','glow','vivid','bright'], id: 'neon' },
  ]

  for (const { keys, id } of colorKeywords) {
    if (keys.some(k => lower.includes(k))) found.push(id)
  }
  return found
}

// Build a theme from color IDs. Multiple colors = multi-accent theme.
function buildThemeFromColors(colorIds, seed) {
  // Multi-color combos
  const combo = colorIds.slice(0,2).sort().join('+')

  const multiThemes = {
    'black+red': {
      bg:'#0a0000',cardBg:'#120404',cardBorder:'rgba(200,40,40,0.2)',
      svgBgInner:'#1a0606',svgBgOuter:'#080000',
      zodiacFire:'#2a0808',zodiacEarth:'#1a0808',zodiacAir:'#140808',zodiacWater:'#100808',
      zodiacFireS:'#cc2222',zodiacEarthS:'#882222',zodiacAirS:'#661111',zodiacWaterS:'#551111',
      houseEven:'#120404',houseOdd:'#0e0303',innerCircle:'#080000',
      signTextColor:'#ff9999',tickColor:'rgba(220,60,60,',dividerColor:'rgba(200,40,40,0.3)',
      houseNumColor:'#883333',axisLineColor:'rgba(255,100,100,0.9)',axisLabelColor:'rgba(220,80,80,0.75)',
      planetFill:'#1a0606',planetStroke:'rgba(220,60,60,0.85)',planetText:'#ffcccc',
      outerPlanetText:'#cc6666',outerPlanetLine:'rgba(200,40,40,0.25)',centerDot:'#ff8080',
      titleColor:'#ff8080',subColor:'rgba(255,128,128,0.45)',
      legendBg:'rgba(200,40,40,0.05)',legendBorder:'rgba(200,40,40,0.15)',
      legendTitleColor:'#882222',legendNameColor:'rgba(255,160,160,0.85)',legendPosColor:'#661111',
      tooltipBg:'#120404',tooltipBorder:'rgba(200,40,40,0.4)',tooltipText:'#ffcccc',
      aspectConj:'rgba(255,220,50,0.65)',aspectSext:'rgba(255,120,120,0.5)',
      aspectSq:'rgba(255,60,60,0.55)',aspectTrine:'rgba(200,80,80,0.5)',aspectOpp:'rgba(255,60,60,0.6)',
      isDark:true,
    },
    'blue+red': {
      bg:'#050510',cardBg:'#080818',cardBorder:'rgba(120,80,220,0.2)',
      svgBgInner:'#100828',svgBgOuter:'#050510',
      zodiacFire:'#1a0818',zodiacEarth:'#080a28',zodiacAir:'#060820',zodiacWater:'#050818',
      zodiacFireS:'#dd3366',zodiacEarthS:'#4466cc',zodiacAirS:'#3355bb',zodiacWaterS:'#5544aa',
      houseEven:'#080818',houseOdd:'#060612',innerCircle:'#040410',
      signTextColor:'#c0b0ff',tickColor:'rgba(140,100,255,',dividerColor:'rgba(120,80,220,0.3)',
      houseNumColor:'#6655aa',axisLineColor:'rgba(180,140,255,0.9)',axisLabelColor:'rgba(160,120,240,0.75)',
      planetFill:'#100828',planetStroke:'rgba(160,120,255,0.85)',planetText:'#e0d0ff',
      outerPlanetText:'#9988cc',outerPlanetLine:'rgba(120,80,220,0.25)',centerDot:'#cc99ff',
      titleColor:'#cc99ff',subColor:'rgba(200,160,255,0.45)',
      legendBg:'rgba(120,80,220,0.05)',legendBorder:'rgba(120,80,220,0.15)',
      legendTitleColor:'#7755bb',legendNameColor:'rgba(200,160,255,0.85)',legendPosColor:'#6644aa',
      tooltipBg:'#080818',tooltipBorder:'rgba(160,120,255,0.4)',tooltipText:'#e0d0ff',
      aspectConj:'rgba(255,220,50,0.65)',aspectSext:'rgba(100,160,255,0.5)',
      aspectSq:'rgba(255,80,80,0.55)',aspectTrine:'rgba(100,200,160,0.5)',aspectOpp:'rgba(255,80,100,0.6)',
      isDark:true,
    },
    'black+gold': {
      bg:'#080600',cardBg:'#100c00',cardBorder:'rgba(200,160,40,0.2)',
      svgBgInner:'#1c1600',svgBgOuter:'#080600',
      zodiacFire:'#1c1000',zodiacEarth:'#141000',zodiacAir:'#0e0c00',zodiacWater:'#0a0a00',
      zodiacFireS:'#cc9900',zodiacEarthS:'#aa7700',zodiacAirS:'#886600',zodiacWaterS:'#664400',
      houseEven:'#100c00',houseOdd:'#0c0a00',innerCircle:'#080600',
      signTextColor:'#ffd060',tickColor:'rgba(200,160,40,',dividerColor:'rgba(200,160,40,0.3)',
      houseNumColor:'#886600',axisLineColor:'rgba(240,200,60,0.9)',axisLabelColor:'rgba(220,180,60,0.75)',
      planetFill:'#1c1600',planetStroke:'rgba(200,160,40,0.85)',planetText:'#fff0a0',
      outerPlanetText:'#cc9933',outerPlanetLine:'rgba(200,160,40,0.25)',centerDot:'#ffd040',
      titleColor:'#ffd040',subColor:'rgba(255,208,64,0.45)',
      legendBg:'rgba(200,160,40,0.05)',legendBorder:'rgba(200,160,40,0.15)',
      legendTitleColor:'#886600',legendNameColor:'rgba(255,208,100,0.85)',legendPosColor:'#664400',
      tooltipBg:'#100c00',tooltipBorder:'rgba(200,160,40,0.4)',tooltipText:'#fff0a0',
      aspectConj:'rgba(255,220,50,0.7)',aspectSext:'rgba(200,180,80,0.5)',
      aspectSq:'rgba(255,120,40,0.55)',aspectTrine:'rgba(160,200,80,0.5)',aspectOpp:'rgba(255,120,40,0.6)',
      isDark:true,
    },
  }

  if (multiThemes[combo]) return multiThemes[combo]

  // Single color themes
  const singleThemes = {
    red: {
      bg:'#0e0404',cardBg:'#160606',cardBorder:'rgba(220,60,60,0.2)',
      svgBgInner:'#220808',svgBgOuter:'#0a0202',
      zodiacFire:'#2e0a0a',zodiacEarth:'#220808',zodiacAir:'#1a0606',zodiacWater:'#140404',
      zodiacFireS:'#cc3333',zodiacEarthS:'#aa2222',zodiacAirS:'#881111',zodiacWaterS:'#661111',
      houseEven:'#160606',houseOdd:'#120404',innerCircle:'#0e0404',
      signTextColor:'#ffaaaa',tickColor:'rgba(220,80,80,',dividerColor:'rgba(200,60,60,0.3)',
      houseNumColor:'#993333',axisLineColor:'rgba(255,120,120,0.9)',axisLabelColor:'rgba(220,100,100,0.75)',
      planetFill:'#220808',planetStroke:'rgba(220,80,80,0.85)',planetText:'#ffe0e0',
      outerPlanetText:'#cc7777',outerPlanetLine:'rgba(200,60,60,0.25)',centerDot:'#ff9999',
      titleColor:'#ff9999',subColor:'rgba(255,153,153,0.45)',
      legendBg:'rgba(200,60,60,0.05)',legendBorder:'rgba(200,60,60,0.15)',
      legendTitleColor:'#993333',legendNameColor:'rgba(255,180,180,0.85)',legendPosColor:'#772222',
      tooltipBg:'#160606',tooltipBorder:'rgba(200,60,60,0.4)',tooltipText:'#ffe0e0',
      aspectConj:'rgba(255,220,50,0.65)',aspectSext:'rgba(255,150,150,0.5)',
      aspectSq:'rgba(255,60,60,0.6)',aspectTrine:'rgba(200,100,100,0.5)',aspectOpp:'rgba(255,60,60,0.65)',
      isDark:true,
    },
    blue: {
      bg:'#030a18',cardBg:'#05101f',cardBorder:'rgba(60,120,240,0.2)',
      svgBgInner:'#0a1a3c',svgBgOuter:'#030a18',
      zodiacFire:'#0a1230',zodiacEarth:'#081028',zodiacAir:'#060e22',zodiacWater:'#050c1e',
      zodiacFireS:'#3366dd',zodiacEarthS:'#2255cc',zodiacAirS:'#4477ee',zodiacWaterS:'#1144bb',
      houseEven:'#05101f',houseOdd:'#040d1a',innerCircle:'#030a18',
      signTextColor:'#99ccff',tickColor:'rgba(80,150,255,',dividerColor:'rgba(60,120,240,0.3)',
      houseNumColor:'#3366aa',axisLineColor:'rgba(120,180,255,0.9)',axisLabelColor:'rgba(100,160,240,0.75)',
      planetFill:'#0a1a3c',planetStroke:'rgba(80,150,255,0.85)',planetText:'#ccddff',
      outerPlanetText:'#6699cc',outerPlanetLine:'rgba(60,120,240,0.25)',centerDot:'#88bbff',
      titleColor:'#88bbff',subColor:'rgba(136,187,255,0.45)',
      legendBg:'rgba(60,120,240,0.05)',legendBorder:'rgba(60,120,240,0.15)',
      legendTitleColor:'#3366aa',legendNameColor:'rgba(150,200,255,0.85)',legendPosColor:'#2255aa',
      tooltipBg:'#05101f',tooltipBorder:'rgba(80,150,255,0.4)',tooltipText:'#ccddff',
      aspectConj:'rgba(255,220,50,0.65)',aspectSext:'rgba(80,180,255,0.55)',
      aspectSq:'rgba(255,100,100,0.5)',aspectTrine:'rgba(80,220,160,0.5)',aspectOpp:'rgba(255,100,100,0.55)',
      isDark:true,
    },
    navy: {
      bg:'#020810',cardBg:'#040e1c',cardBorder:'rgba(50,100,200,0.2)',
      svgBgInner:'#071428',svgBgOuter:'#020810',
      zodiacFire:'#08102a',zodiacEarth:'#060e22',zodiacAir:'#040c1e',zodiacWater:'#030a1a',
      zodiacFireS:'#2255bb',zodiacEarthS:'#1144aa',zodiacAirS:'#3366cc',zodiacWaterS:'#1133aa',
      houseEven:'#040e1c',houseOdd:'#030b18',innerCircle:'#020810',
      signTextColor:'#8ab0e8',tickColor:'rgba(60,110,220,',dividerColor:'rgba(50,100,200,0.3)',
      houseNumColor:'#2255aa',axisLineColor:'rgba(100,160,240,0.9)',axisLabelColor:'rgba(80,140,220,0.75)',
      planetFill:'#071428',planetStroke:'rgba(60,120,220,0.85)',planetText:'#b8d0f4',
      outerPlanetText:'#5588bb',outerPlanetLine:'rgba(50,100,200,0.25)',centerDot:'#6699dd',
      titleColor:'#6699dd',subColor:'rgba(102,153,221,0.45)',
      legendBg:'rgba(50,100,200,0.05)',legendBorder:'rgba(50,100,200,0.15)',
      legendTitleColor:'#2255aa',legendNameColor:'rgba(140,180,240,0.85)',legendPosColor:'#1144aa',
      tooltipBg:'#040e1c',tooltipBorder:'rgba(60,120,220,0.4)',tooltipText:'#b8d0f4',
      aspectConj:'rgba(255,220,50,0.65)',aspectSext:'rgba(80,160,255,0.5)',
      aspectSq:'rgba(255,100,100,0.5)',aspectTrine:'rgba(80,220,160,0.5)',aspectOpp:'rgba(255,100,100,0.55)',
      isDark:true,
    },
    green: {
      bg:'#030e06',cardBg:'#051408',cardBorder:'rgba(40,160,80,0.2)',
      svgBgInner:'#081e0c',svgBgOuter:'#030e06',
      zodiacFire:'#0a1e0c',zodiacEarth:'#081a0a',zodiacAir:'#061408',zodiacWater:'#041006',
      zodiacFireS:'#33aa55',zodiacEarthS:'#228844',zodiacAirS:'#44bb66',zodiacWaterS:'#117733',
      houseEven:'#051408',houseOdd:'#041006',innerCircle:'#030e06',
      signTextColor:'#88ddaa',tickColor:'rgba(60,180,100,',dividerColor:'rgba(40,160,80,0.3)',
      houseNumColor:'#228844',axisLineColor:'rgba(80,200,120,0.9)',axisLabelColor:'rgba(60,180,100,0.75)',
      planetFill:'#081e0c',planetStroke:'rgba(60,180,100,0.85)',planetText:'#aaeebb',
      outerPlanetText:'#44aa66',outerPlanetLine:'rgba(40,160,80,0.25)',centerDot:'#55cc77',
      titleColor:'#55cc77',subColor:'rgba(85,204,119,0.45)',
      legendBg:'rgba(40,160,80,0.05)',legendBorder:'rgba(40,160,80,0.15)',
      legendTitleColor:'#228844',legendNameColor:'rgba(120,220,160,0.85)',legendPosColor:'#117733',
      tooltipBg:'#051408',tooltipBorder:'rgba(60,180,100,0.4)',tooltipText:'#aaeebb',
      aspectConj:'rgba(220,255,80,0.65)',aspectSext:'rgba(80,220,160,0.55)',
      aspectSq:'rgba(255,100,80,0.5)',aspectTrine:'rgba(80,255,120,0.55)',aspectOpp:'rgba(255,100,80,0.6)',
      isDark:true,
    },
    sage: {
      bg:'#0a140a',cardBg:'#0e1a0e',cardBorder:'rgba(110,150,90,0.2)',
      svgBgInner:'#142014',svgBgOuter:'#080e08',
      zodiacFire:'#1a2a12',zodiacEarth:'#162414',zodiacAir:'#122012',zodiacWater:'#0e1c10',
      zodiacFireS:'#7aaa55',zodiacEarthS:'#5a8a40',zodiacAirS:'#4a7a40',zodiacWaterS:'#3a6a40',
      houseEven:'#0e1a0e',houseOdd:'#0c160c',innerCircle:'#0a140a',
      signTextColor:'#b0d098',tickColor:'rgba(120,160,90,',dividerColor:'rgba(100,140,80,0.3)',
      houseNumColor:'#5a8040',axisLineColor:'rgba(160,200,120,0.9)',axisLabelColor:'rgba(140,180,100,0.75)',
      planetFill:'#142014',planetStroke:'rgba(120,160,90,0.85)',planetText:'#c8e0b0',
      outerPlanetText:'#7aa060',outerPlanetLine:'rgba(100,140,80,0.25)',centerDot:'#a0c880',
      titleColor:'#a0c880',subColor:'rgba(160,200,128,0.45)',
      legendBg:'rgba(100,140,80,0.05)',legendBorder:'rgba(100,140,80,0.15)',
      legendTitleColor:'#5a8040',legendNameColor:'rgba(160,200,120,0.85)',legendPosColor:'#447730',
      tooltipBg:'#0e1a0e',tooltipBorder:'rgba(120,160,90,0.4)',tooltipText:'#c8e0b0',
      aspectConj:'rgba(220,240,80,0.65)',aspectSext:'rgba(100,220,140,0.5)',
      aspectSq:'rgba(240,120,80,0.5)',aspectTrine:'rgba(80,220,100,0.55)',aspectOpp:'rgba(240,120,80,0.6)',
      isDark:true,
    },
    purple: {
      bg:'#080510',cardBg:'#0d0818',cardBorder:'rgba(140,80,220,0.2)',
      svgBgInner:'#140a28',svgBgOuter:'#060410',
      zodiacFire:'#1e0828',zodiacEarth:'#14061e',zodiacAir:'#0e0418',zodiacWater:'#0a0415',
      zodiacFireS:'#aa44dd',zodiacEarthS:'#7733bb',zodiacAirS:'#6622aa',zodiacWaterS:'#5522aa',
      houseEven:'#0d0818',houseOdd:'#0a0614',innerCircle:'#080510',
      signTextColor:'#d0a8ff',tickColor:'rgba(160,100,255,',dividerColor:'rgba(140,80,220,0.3)',
      houseNumColor:'#7744aa',axisLineColor:'rgba(200,140,255,0.9)',axisLabelColor:'rgba(180,120,240,0.75)',
      planetFill:'#140a28',planetStroke:'rgba(160,100,255,0.85)',planetText:'#ecd8ff',
      outerPlanetText:'#aa77dd',outerPlanetLine:'rgba(140,80,220,0.25)',centerDot:'#cc88ff',
      titleColor:'#cc88ff',subColor:'rgba(204,136,255,0.45)',
      legendBg:'rgba(140,80,220,0.05)',legendBorder:'rgba(140,80,220,0.15)',
      legendTitleColor:'#7744aa',legendNameColor:'rgba(210,160,255,0.85)',legendPosColor:'#6633aa',
      tooltipBg:'#0d0818',tooltipBorder:'rgba(160,100,255,0.4)',tooltipText:'#ecd8ff',
      aspectConj:'rgba(255,220,50,0.65)',aspectSext:'rgba(120,180,255,0.5)',
      aspectSq:'rgba(255,80,80,0.55)',aspectTrine:'rgba(80,220,160,0.5)',aspectOpp:'rgba(255,80,80,0.6)',
      isDark:true,
    },
    gold: {
      bg:'#100c02',cardBg:'#181204',cardBorder:'rgba(200,160,40,0.2)',
      svgBgInner:'#221a06',svgBgOuter:'#0c0802',
      zodiacFire:'#2a1a04',zodiacEarth:'#201406',zodiacAir:'#160e04',zodiacWater:'#100a04',
      zodiacFireS:'#cc9900',zodiacEarthS:'#aa7700',zodiacAirS:'#886600',zodiacWaterS:'#664400',
      houseEven:'#181204',houseOdd:'#140e02',innerCircle:'#100c02',
      signTextColor:'#ffda70',tickColor:'rgba(200,160,40,',dividerColor:'rgba(180,140,30,0.3)',
      houseNumColor:'#886600',axisLineColor:'rgba(240,200,60,0.9)',axisLabelColor:'rgba(220,180,50,0.75)',
      planetFill:'#221a06',planetStroke:'rgba(200,160,40,0.85)',planetText:'#fff0a0',
      outerPlanetText:'#cc9933',outerPlanetLine:'rgba(180,140,30,0.25)',centerDot:'#ffcc40',
      titleColor:'#ffcc40',subColor:'rgba(255,204,64,0.45)',
      legendBg:'rgba(180,140,30,0.05)',legendBorder:'rgba(180,140,30,0.15)',
      legendTitleColor:'#886600',legendNameColor:'rgba(255,210,100,0.85)',legendPosColor:'#664400',
      tooltipBg:'#181204',tooltipBorder:'rgba(200,160,40,0.4)',tooltipText:'#fff0a0',
      aspectConj:'rgba(255,220,50,0.7)',aspectSext:'rgba(200,180,80,0.5)',
      aspectSq:'rgba(255,120,40,0.55)',aspectTrine:'rgba(160,200,80,0.5)',aspectOpp:'rgba(255,120,40,0.6)',
      isDark:true,
    },
    orange: {
      bg:'#100600',cardBg:'#180a00',cardBorder:'rgba(220,100,20,0.2)',
      svgBgInner:'#201000',svgBgOuter:'#0c0400',
      zodiacFire:'#2a1000',zodiacEarth:'#1e0c00',zodiacAir:'#160800',zodiacWater:'#100600',
      zodiacFireS:'#ee6600',zodiacEarthS:'#cc5500',zodiacAirS:'#aa4400',zodiacWaterS:'#883300',
      houseEven:'#180a00',houseOdd:'#140800',innerCircle:'#100600',
      signTextColor:'#ffb060',tickColor:'rgba(220,100,20,',dividerColor:'rgba(200,80,10,0.3)',
      houseNumColor:'#aa5500',axisLineColor:'rgba(255,150,50,0.9)',axisLabelColor:'rgba(220,120,40,0.75)',
      planetFill:'#201000',planetStroke:'rgba(220,100,20,0.85)',planetText:'#ffe0a0',
      outerPlanetText:'#cc7733',outerPlanetLine:'rgba(200,80,10,0.25)',centerDot:'#ff9940',
      titleColor:'#ff9940',subColor:'rgba(255,153,64,0.45)',
      legendBg:'rgba(200,80,10,0.05)',legendBorder:'rgba(200,80,10,0.15)',
      legendTitleColor:'#aa5500',legendNameColor:'rgba(255,190,120,0.85)',legendPosColor:'#883300',
      tooltipBg:'#180a00',tooltipBorder:'rgba(220,100,20,0.4)',tooltipText:'#ffe0a0',
      aspectConj:'rgba(255,220,50,0.7)',aspectSext:'rgba(255,180,60,0.5)',
      aspectSq:'rgba(255,80,40,0.55)',aspectTrine:'rgba(200,200,60,0.5)',aspectOpp:'rgba(255,80,40,0.6)',
      isDark:true,
    },
    pink: {
      bg:'#100408',cardBg:'#180610',cardBorder:'rgba(220,80,140,0.2)',
      svgBgInner:'#200818',svgBgOuter:'#0c0208',
      zodiacFire:'#280818',zodiacEarth:'#1e0614',zodiacAir:'#160410',zodiacWater:'#10040c',
      zodiacFireS:'#dd4488',zodiacEarthS:'#bb3366',zodiacAirS:'#aa2255',zodiacWaterS:'#881144',
      houseEven:'#180610',houseOdd:'#14040c',innerCircle:'#100408',
      signTextColor:'#ffaacc',tickColor:'rgba(220,80,140,',dividerColor:'rgba(200,60,120,0.3)',
      houseNumColor:'#aa3366',axisLineColor:'rgba(255,130,170,0.9)',axisLabelColor:'rgba(220,100,150,0.75)',
      planetFill:'#200818',planetStroke:'rgba(220,80,140,0.85)',planetText:'#ffd0e0',
      outerPlanetText:'#cc6699',outerPlanetLine:'rgba(200,60,120,0.25)',centerDot:'#ff88bb',
      titleColor:'#ff88bb',subColor:'rgba(255,136,187,0.45)',
      legendBg:'rgba(200,60,120,0.05)',legendBorder:'rgba(200,60,120,0.15)',
      legendTitleColor:'#aa3366',legendNameColor:'rgba(255,180,210,0.85)',legendPosColor:'#881144',
      tooltipBg:'#180610',tooltipBorder:'rgba(220,80,140,0.4)',tooltipText:'#ffd0e0',
      aspectConj:'rgba(255,220,50,0.65)',aspectSext:'rgba(200,120,220,0.5)',
      aspectSq:'rgba(255,60,100,0.55)',aspectTrine:'rgba(200,100,180,0.5)',aspectOpp:'rgba(255,60,100,0.6)',
      isDark:true,
    },
    teal: {
      bg:'#020e0e',cardBg:'#041414',cardBorder:'rgba(30,160,160,0.2)',
      svgBgInner:'#061e1e',svgBgOuter:'#020c0c',
      zodiacFire:'#081e1e',zodiacEarth:'#061818',zodiacAir:'#041414',zodiacWater:'#031010',
      zodiacFireS:'#22aaaa',zodiacEarthS:'#119999',zodiacAirS:'#33bbbb',zodiacWaterS:'#118888',
      houseEven:'#041414',houseOdd:'#031010',innerCircle:'#020e0e',
      signTextColor:'#77dddd',tickColor:'rgba(40,180,180,',dividerColor:'rgba(30,160,160,0.3)',
      houseNumColor:'#228888',axisLineColor:'rgba(80,200,200,0.9)',axisLabelColor:'rgba(60,180,180,0.75)',
      planetFill:'#061e1e',planetStroke:'rgba(40,180,180,0.85)',planetText:'#aaeee',
      outerPlanetText:'#44aaaa',outerPlanetLine:'rgba(30,160,160,0.25)',centerDot:'#44cccc',
      titleColor:'#44cccc',subColor:'rgba(68,204,204,0.45)',
      legendBg:'rgba(30,160,160,0.05)',legendBorder:'rgba(30,160,160,0.15)',
      legendTitleColor:'#228888',legendNameColor:'rgba(100,220,220,0.85)',legendPosColor:'#116666',
      tooltipBg:'#041414',tooltipBorder:'rgba(40,180,180,0.4)',tooltipText:'#aaeee0',
      aspectConj:'rgba(220,255,80,0.65)',aspectSext:'rgba(80,220,220,0.55)',
      aspectSq:'rgba(255,100,80,0.5)',aspectTrine:'rgba(80,255,200,0.55)',aspectOpp:'rgba(255,100,80,0.6)',
      isDark:true,
    },
    black: {
      bg:'#000000',cardBg:'#0a0a0a',cardBorder:'rgba(255,255,255,0.1)',
      svgBgInner:'#111111',svgBgOuter:'#000000',
      zodiacFire:'#1a1a1a',zodiacEarth:'#141414',zodiacAir:'#181818',zodiacWater:'#121212',
      zodiacFireS:'rgba(255,255,255,0.5)',zodiacEarthS:'rgba(255,255,255,0.4)',
      zodiacAirS:'rgba(255,255,255,0.45)',zodiacWaterS:'rgba(255,255,255,0.35)',
      houseEven:'#0d0d0d',houseOdd:'#0a0a0a',innerCircle:'#000000',
      signTextColor:'#ffffff',tickColor:'rgba(255,255,255,',dividerColor:'rgba(255,255,255,0.15)',
      houseNumColor:'#666666',axisLineColor:'rgba(255,255,255,0.9)',axisLabelColor:'rgba(255,255,255,0.7)',
      planetFill:'#111111',planetStroke:'rgba(255,255,255,0.6)',planetText:'#ffffff',
      outerPlanetText:'#aaaaaa',outerPlanetLine:'rgba(255,255,255,0.2)',centerDot:'#ffffff',
      titleColor:'#ffffff',subColor:'rgba(255,255,255,0.4)',
      legendBg:'rgba(255,255,255,0.03)',legendBorder:'rgba(255,255,255,0.08)',
      legendTitleColor:'#555555',legendNameColor:'rgba(255,255,255,0.8)',legendPosColor:'#444444',
      tooltipBg:'#111111',tooltipBorder:'rgba(255,255,255,0.2)',tooltipText:'#ffffff',
      aspectConj:'rgba(255,255,255,0.55)',aspectSext:'rgba(180,180,255,0.5)',
      aspectSq:'rgba(255,100,100,0.55)',aspectTrine:'rgba(100,220,150,0.5)',aspectOpp:'rgba(255,100,100,0.55)',
      isDark:true,
    },
    white: {
      bg:'#f0ece0',cardBg:'#faf7f0',cardBorder:'rgba(0,0,0,0.07)',
      svgBgInner:'#e8e0cc',svgBgOuter:'#f0ece0',
      zodiacFire:'#f5d0c8',zodiacEarth:'#d0e8c8',zodiacAir:'#c8d8f0',zodiacWater:'#c8e8f0',
      zodiacFireS:'#cc4444',zodiacEarthS:'#448844',zodiacAirS:'#4466cc',zodiacWaterS:'#3399bb',
      houseEven:'#eee8d8',houseOdd:'#ebe5d2',innerCircle:'#f5f0e4',
      signTextColor:'#222222',tickColor:'rgba(0,0,0,',dividerColor:'rgba(0,0,0,0.15)',
      houseNumColor:'#888888',axisLineColor:'rgba(0,0,0,0.8)',axisLabelColor:'rgba(0,0,0,0.6)',
      planetFill:'#ffffff',planetStroke:'rgba(0,0,0,0.3)',planetText:'#111111',
      outerPlanetText:'#555555',outerPlanetLine:'rgba(0,0,0,0.15)',centerDot:'#222222',
      titleColor:'#1a1a1a',subColor:'rgba(0,0,0,0.4)',
      legendBg:'#ffffff',legendBorder:'rgba(0,0,0,0.07)',
      legendTitleColor:'#777777',legendNameColor:'rgba(0,0,0,0.75)',legendPosColor:'#999999',
      tooltipBg:'#ffffff',tooltipBorder:'rgba(0,0,0,0.15)',tooltipText:'#111111',
      aspectConj:'rgba(180,140,0,0.55)',aspectSext:'rgba(50,100,200,0.45)',
      aspectSq:'rgba(200,50,50,0.45)',aspectTrine:'rgba(50,160,90,0.45)',aspectOpp:'rgba(200,50,50,0.5)',
      isDark:false,
    },
    warm: {
      bg:'#120d04',cardBg:'#1a1408',cardBorder:'rgba(200,150,60,0.2)',
      svgBgInner:'#241a08',svgBgOuter:'#120d04',
      zodiacFire:'#2e1a06',zodiacEarth:'#221608',zodiacAir:'#161408',zodiacWater:'#0e1008',
      zodiacFireS:'#d4900c',zodiacEarthS:'#aa8830',zodiacAirS:'#7080b0',zodiacWaterS:'#3080a0',
      houseEven:'#1a1408',houseOdd:'#161008',innerCircle:'#100c04',
      signTextColor:'#f0d880',tickColor:'rgba(200,160,60,',dividerColor:'rgba(180,140,40,0.3)',
      houseNumColor:'#a07030',axisLineColor:'rgba(240,200,80,0.9)',axisLabelColor:'rgba(220,180,70,0.75)',
      planetFill:'#241a08',planetStroke:'rgba(200,160,60,0.85)',planetText:'#fce8a0',
      outerPlanetText:'#c0a050',outerPlanetLine:'rgba(180,140,40,0.25)',centerDot:'#f0d060',
      titleColor:'#f0d060',subColor:'rgba(240,208,96,0.45)',
      legendBg:'rgba(180,140,40,0.05)',legendBorder:'rgba(180,140,40,0.12)',
      legendTitleColor:'#a07030',legendNameColor:'rgba(240,208,96,0.85)',legendPosColor:'#886020',
      tooltipBg:'#1a1408',tooltipBorder:'rgba(200,160,60,0.4)',tooltipText:'#fce8a0',
      aspectConj:'rgba(255,220,50,0.7)',aspectSext:'rgba(200,180,80,0.5)',
      aspectSq:'rgba(255,120,40,0.55)',aspectTrine:'rgba(160,200,80,0.5)',aspectOpp:'rgba(255,120,40,0.6)',
      isDark:true,
    },
    cosmic: {
      bg:'#07000f',cardBg:'#0d0020',cardBorder:'rgba(180,100,255,0.2)',
      svgBgInner:'#150030',svgBgOuter:'#07000f',
      zodiacFire:'#200030',zodiacEarth:'#0a1a00',zodiacAir:'#001530',zodiacWater:'#001530',
      zodiacFireS:'#cc44ff',zodiacEarthS:'#44cc88',zodiacAirS:'#44aaff',zodiacWaterS:'#44ccff',
      houseEven:'#0d0020',houseOdd:'#0a001a',innerCircle:'#07000f',
      signTextColor:'#e0ccff',tickColor:'rgba(180,100,255,',dividerColor:'rgba(160,80,240,0.25)',
      houseNumColor:'#8855cc',axisLineColor:'rgba(220,180,255,0.9)',axisLabelColor:'rgba(200,160,255,0.75)',
      planetFill:'#150030',planetStroke:'rgba(180,100,255,0.9)',planetText:'#f0e0ff',
      outerPlanetText:'#aa77dd',outerPlanetLine:'rgba(160,80,240,0.2)',centerDot:'#dd99ff',
      titleColor:'#dd99ff',subColor:'rgba(221,153,255,0.45)',
      legendBg:'rgba(160,80,240,0.05)',legendBorder:'rgba(160,80,240,0.15)',
      legendTitleColor:'#8855cc',legendNameColor:'rgba(220,180,255,0.85)',legendPosColor:'#7744bb',
      tooltipBg:'#0d0020',tooltipBorder:'rgba(180,100,255,0.4)',tooltipText:'#f0e0ff',
      aspectConj:'rgba(255,220,50,0.65)',aspectSext:'rgba(50,200,255,0.5)',
      aspectSq:'rgba(255,80,80,0.5)',aspectTrine:'rgba(80,255,160,0.5)',aspectOpp:'rgba(255,80,80,0.55)',
      isDark:true,
    },
    neon: {
      bg:'#000008',cardBg:'#04000e',cardBorder:'rgba(0,255,200,0.2)',
      svgBgInner:'#080020',svgBgOuter:'#000008',
      zodiacFire:'#0c0020',zodiacEarth:'#001808',zodiacAir:'#000c20',zodiacWater:'#001020',
      zodiacFireS:'#00ffcc',zodiacEarthS:'#00ff88',zodiacAirS:'#0088ff',zodiacWaterS:'#00ccff',
      houseEven:'#04000e',houseOdd:'#03000c',innerCircle:'#000008',
      signTextColor:'#00ffee',tickColor:'rgba(0,240,200,',dividerColor:'rgba(0,220,180,0.3)',
      houseNumColor:'#008888',axisLineColor:'rgba(0,255,200,0.9)',axisLabelColor:'rgba(0,220,180,0.75)',
      planetFill:'#080020',planetStroke:'rgba(0,255,200,0.9)',planetText:'#ccffee',
      outerPlanetText:'#00cc99',outerPlanetLine:'rgba(0,200,160,0.25)',centerDot:'#00ffcc',
      titleColor:'#00ffcc',subColor:'rgba(0,255,204,0.45)',
      legendBg:'rgba(0,220,180,0.05)',legendBorder:'rgba(0,220,180,0.15)',
      legendTitleColor:'#008888',legendNameColor:'rgba(0,240,200,0.85)',legendPosColor:'#006666',
      tooltipBg:'#04000e',tooltipBorder:'rgba(0,255,200,0.4)',tooltipText:'#ccffee',
      aspectConj:'rgba(255,255,0,0.7)',aspectSext:'rgba(0,200,255,0.55)',
      aspectSq:'rgba(255,0,100,0.55)',aspectTrine:'rgba(0,255,120,0.55)',aspectOpp:'rgba(255,0,100,0.6)',
      isDark:true,
    },
  }

  // Return first matched single color theme
  for (const id of colorIds) {
    if (singleThemes[id]) return singleThemes[id]
  }

  // Fallback random pool (excluding black to avoid always black)
  const randomPool = ['blue','navy','purple','teal','cosmic','warm','green','red','gold']
  const pick = randomPool[Math.floor(Math.random() * randomPool.length)]
  return singleThemes[pick]
}

// Main theme picker — explicit colors take priority
function pickChartTheme(prompt) {
  const colorIds = parseExplicitColors(prompt)
  if (colorIds.length > 0) {
    return buildThemeFromColors(colorIds, prompt)
  }
  // No explicit colors — pick randomly from varied pool
  const randomThemes = ['blue','navy','purple','teal','cosmic','warm','green','red','gold','sage','pink','orange']
  const pick = randomThemes[Math.floor(Math.random() * randomThemes.length)]
  return buildThemeFromColors([pick], prompt)
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
      .replace(/\s*\(R\)\s*/gi,'').replace(/\s*\(AC\)\s*/gi,'')
      .replace(/\s*\(MC\)\s*/gi,'').replace(/\s*\(Black Moon\)\s*/gi,'').trim()
    if (/rising\s*sign/i.test(name)||/^ascendant/i.test(name)) name='Ascendant'
    if (/^midheaven/i.test(name)) name='Midheaven'
    if (/north\s*node/i.test(name)) name='North Node'
    if (/south\s*node/i.test(name)) name='South Node'
    if (/lilith/i.test(name)) name='Lilith'
    if (/pallas/i.test(name)) name='Pallas Athena'
    if (/pholus/i.test(name)) name='Pholus'
    const signRaw = m[2]
    const sign = signRaw[0].toUpperCase() + signRaw.slice(1).toLowerCase()
    const deg = parseInt(m[3]||'0',10)
    const min = parseInt(m[4]||'0',10)
    const base = SIGN_BASE_DEGS[sign.toLowerCase()]??0
    const absolute = base + deg + min/60
    const isRetrograde = /\(R\)/i.test(line)
    const houseMatch = line.match(/\((\d{1,2})(?:st|nd|rd|th)?\s*[Hh]ouse\)/)
    const houseNum = houseMatch ? parseInt(houseMatch[1],10) : null
    placements.push({
      name, sign,
      glyph: PLANET_GLYPHS[name]||'•',
      signGlyph: SIGN_GLYPHS[sign]||'',
      absolute, deg, min,
      label: `${deg}°${String(min).padStart(2,'0')}'`,
      isRetrograde, houseNum,
      isOuter: OUTER_BODIES.has(name),
    })
  }
  return placements
}

function extractHouseCusps(placements) {
  const ascP = placements.find(p=>p.name==='Ascendant')
  const mcP  = placements.find(p=>p.name==='Midheaven')
  const asc = ascP ? ascP.absolute : 0
  const mc  = mcP  ? mcP.absolute  : (asc+270)%360
  const ic  = (mc+180)%360
  const dsc = (asc+180)%360
  function bwd(f,t){ return (((f-t)%360)+360)%360 }
  const s14=bwd(asc,ic), s47=bwd(ic,dsc), s710=bwd(dsc,mc), s101=bwd(mc,asc)
  return [
    asc,
    ((asc-s14*0.36+360)%360),
    ((asc-s14*0.70+360)%360),
    ic,
    ((ic-s47*0.34+360)%360),
    ((ic-s47*0.68+360)%360),
    dsc,
    ((dsc-s710*0.36+360)%360),
    ((dsc-s710*0.70+360)%360),
    mc,
    ((mc-s101*0.34+360)%360),
    ((mc-s101*0.68+360)%360),
  ]
}

// ─── SVG Math ─────────────────────────────────────────────────────────────────

function e2s(ecl, asc) { return (((asc-ecl+270)%360)+360)%360 }
function polar(a,r,cx,cy) {
  const rad=(a-90)*Math.PI/180
  return {x:cx+r*Math.cos(rad), y:cy+r*Math.sin(rad)}
}
function arc(a1,a2,ro,ri,cx,cy) {
  let end=a2; while(end<=a1) end+=360
  const span=end-a1, lg=span>180?1:0
  const p1=polar(a1,ro,cx,cy), p2=polar(a1+span,ro,cx,cy)
  const p3=polar(a1+span,ri,cx,cy), p4=polar(a1,ri,cx,cy)
  return `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A${ro} ${ro} 0 ${lg} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A${ri} ${ri} 0 ${lg} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}Z`
}

// ─── Chart Builder ────────────────────────────────────────────────────────────

function buildBirthChartHTML(prompt) {
  const placements = extractBirthChartData(prompt)
  const T = pickChartTheme(prompt)
  const houseCusps = extractHouseCusps(placements)

  const ascP = placements.find(p=>p.name==='Ascendant')
  const mcP  = placements.find(p=>p.name==='Midheaven')
  const ASC  = ascP ? ascP.absolute : 0
  const MC   = mcP  ? mcP.absolute  : (ASC+270)%360

  const SIZE=580, cx=SIZE/2, cy=SIZE/2
  const R_OUT=254, R_ZIN=214, R_HOU_O=211, R_HOU_I=162
  const R_PLN=133, R_ASP=104

  const showHouseNums = prompt.toLowerCase().includes('house number') ||
    prompt.toLowerCase().includes('numbered') || Math.random()>0.28

  // Zodiac ring
  const zodSVG = ZODIAC_ORDER.map(sign => {
    const se=SIGN_BASE_DEGS[sign.toLowerCase()]
    const svgA=e2s(se,ASC), svgB=e2s(se+30,ASC), svgM=e2s(se+15,ASC)
    const el=SIGN_ELEMENTS[sign]
    const fill=el==='Fire'?T.zodiacFire:el==='Earth'?T.zodiacEarth:el==='Air'?T.zodiacAir:T.zodiacWater
    const stroke=el==='Fire'?T.zodiacFireS:el==='Earth'?T.zodiacEarthS:el==='Air'?T.zodiacAirS:T.zodiacWaterS
    const d=arc(svgB,svgA,R_OUT,R_ZIN,cx,cy)
    const mp=polar(svgM,(R_OUT+R_ZIN)/2,cx,cy)
    return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="0.9"/>
<text x="${mp.x.toFixed(2)}" y="${mp.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${T.signTextColor}" font-size="16" font-family="serif">${SIGN_GLYPHS[sign]}</text>`
  }).join('\n')

    // Ticks
  const tickSVG = Array.from({length:360},(_,i)=>{
    const sv=e2s(i,ASC)
    const maj=i%10===0,mid=i%5===0
    const r1=polar(sv,R_ZIN,cx,cy),r2=polar(sv,R_ZIN-(maj?10:mid?6:3),cx,cy)
    const op=maj?0.6:mid?0.3:0.15
    return `<line x1="${r1.x.toFixed(2)}" y1="${r1.y.toFixed(2)}" x2="${r2.x.toFixed(2)}" y2="${r2.y.toFixed(2)}" stroke="${T.tickColor}${op})" stroke-width="${maj?1:0.6}"/>`
  }).join('\n')

  // Sign boundary spokes
  const spokeSVG = ZODIAC_ORDER.map(sign=>{
    const sv=e2s(SIGN_BASE_DEGS[sign.toLowerCase()],ASC)
    const p1=polar(sv,R_ZIN,cx,cy),p2=polar(sv,R_HOU_I,cx,cy)
    return `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${T.dividerColor}" stroke-width="0.7"/>`
  }).join('\n')

  // House ring
  const houseSVG = houseCusps.map((cuspEcl,i)=>{
    const nextEcl=houseCusps[(i+1)%12]
    const svgC=e2s(cuspEcl,ASC), svgN=e2s(nextEcl,ASC)
    let spanBwd=(((cuspEcl-nextEcl)%360)+360)%360
    const midEcl=((cuspEcl-spanBwd/2)+360)%360
    const svgM=e2s(midEcl,ASC)
    const d=arc(svgN,svgC,R_HOU_O,R_HOU_I,cx,cy)
    const isAng=i===0||i===3||i===6||i===9
    const p1=polar(svgC,R_HOU_O,cx,cy),p2=polar(svgC,R_ASP-6,cx,cy)
    const mp=polar(svgM,(R_HOU_O+R_HOU_I)/2,cx,cy)
    const numTag=showHouseNums
      ?`<text x="${mp.x.toFixed(2)}" y="${mp.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${T.houseNumColor}" font-size="10" font-family="sans-serif">${i+1}</text>`
      :''
    return `<path d="${d}" fill="${i%2===0?T.houseEven:T.houseOdd}" stroke="${T.tickColor}0.06)" stroke-width="0.4"/>
<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${T.tickColor}${isAng?0.8:0.25})" stroke-width="${isAng?2:0.8}"/>
${numTag}`
  }).join('\n')

  // Axis lines AC/DC/MC/IC
  const axesSVG=[
    {ecl:ASC,label:'AC'},{ecl:(ASC+180)%360,label:'DC'},
    {ecl:MC,label:'MC'},{ecl:(MC+180)%360,label:'IC'},
  ].map(({ecl,label})=>{
    const sv=e2s(ecl,ASC)
    const p1=polar(sv,R_HOU_O,cx,cy),p2=polar(sv,8,cx,cy)
    const lp=polar(sv,R_HOU_I-14,cx,cy)
    return `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${T.axisLineColor}" stroke-width="1.8"/>
<text x="${lp.x.toFixed(2)}" y="${lp.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${T.axisLabelColor}" font-size="9" font-weight="700" font-family="sans-serif">${label}</text>`
  }).join('\n')

  // Separate inner vs outer planets
  const innerPlanets=placements.filter(p=>p.name!=='Ascendant'&&p.name!=='Midheaven'&&!p.isOuter)
  const outerPlanets=placements.filter(p=>p.isOuter)

  // Spread inner planets
  const innerWithSVG=innerPlanets.map(p=>({...p,svgAngle:e2s(p.absolute,ASC)}))
    .sort((a,b)=>a.svgAngle-b.svgAngle)
  const MIN_SEP=16
  const disp=innerWithSVG.map(p=>p.svgAngle)
  for(let pass=0;pass<14;pass++){
    for(let i=0;i<disp.length;i++){
      const j=(i+1)%disp.length
      let diff=(((disp[j]-disp[i])%360)+360)%360
      if(diff<MIN_SEP&&diff>0){
        const push=(MIN_SEP-diff)/2
        disp[i]=((disp[i]-push)+360)%360
        disp[j]=(disp[j]+push)%360
      }
    }
  }

  // Aspect lines
  const ASPECTS=[
    {angle:0,  orb:8,color:T.aspectConj, width:1.5,dash:''},
    {angle:60, orb:6,color:T.aspectSext, width:1,  dash:''},
    {angle:90, orb:6,color:T.aspectSq,   width:1.2,dash:''},
    {angle:120,orb:8,color:T.aspectTrine,width:1,  dash:''},
    {angle:180,orb:8,color:T.aspectOpp,  width:1.5,dash:'4,3'},
  ]
  const aspectBodies=innerWithSVG.filter(p=>
    ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'].includes(p.name)
  )
  const aspectSVG=[]
  for(let i=0;i<aspectBodies.length;i++){
    for(let j=i+1;j<aspectBodies.length;j++){
      const diff=Math.abs(aspectBodies[i].absolute-aspectBodies[j].absolute)
      const norm=Math.min(diff,360-diff)
      for(const asp of ASPECTS){
        if(Math.abs(norm-asp.angle)<=asp.orb){
          const p1=polar(aspectBodies[i].svgAngle,R_ASP,cx,cy)
          const p2=polar(aspectBodies[j].svgAngle,R_ASP,cx,cy)
          const da=asp.dash?` stroke-dasharray="${asp.dash}"`:''
          aspectSVG.push(`<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${asp.color}" stroke-width="${asp.width}"${da}/>`)
          break
        }
      }
    }
  }

  // Inner planet markers
  const innerSVG=innerWithSVG.map((p,idx)=>{
    const da=disp[idx]
    const displaced=Math.abs(da-p.svgAngle)>2
    const tp1=polar(p.svgAngle,R_HOU_I-1,cx,cy),tp2=polar(p.svgAngle,R_HOU_I-8,cx,cy)
    let leader=''
    if(displaced){
      const lp1=polar(p.svgAngle,R_HOU_I-9,cx,cy),lp2=polar(da,R_PLN+15,cx,cy)
      leader=`<line x1="${lp1.x.toFixed(2)}" y1="${lp1.y.toFixed(2)}" x2="${lp2.x.toFixed(2)}" y2="${lp2.y.toFixed(2)}" stroke="${T.tickColor}0.2)" stroke-width="0.7"/>`
    }
    const pos=polar(da,R_PLN,cx,cy)
    const retroMark=p.isRetrograde?`<text x="${(pos.x+10).toFixed(2)}" y="${(pos.y-10).toFixed(2)}" fill="${T.planetText}" font-size="7" opacity="0.75">℞</text>`:''
    const el=SIGN_ELEMENTS[p.sign]||''
    const mod=SIGN_MODALITIES[p.sign]||''
    const hInfo=p.houseNum?` · House ${p.houseNum}`:''
    const info=`${p.name}|${p.signGlyph} ${p.sign} ${p.label}${p.isRetrograde?' ℞':''}|${el} · ${mod}${hInfo}`
    return `<line x1="${tp1.x.toFixed(2)}" y1="${tp1.y.toFixed(2)}" x2="${tp2.x.toFixed(2)}" y2="${tp2.y.toFixed(2)}" stroke="${T.planetStroke}" stroke-width="1"/>
${leader}
<g class="planet-group" data-info="${info}" style="cursor:pointer">
  <circle cx="${pos.x.toFixed(2)}" cy="${pos.y.toFixed(2)}" r="13" fill="${T.planetFill}" stroke="${T.planetStroke}" stroke-width="1.2" class="planet-circle"/>
  <text x="${pos.x.toFixed(2)}" y="${pos.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${T.planetText}" font-size="12" font-family="serif" pointer-events="none">${p.glyph}</text>
  ${retroMark}
</g>`
  }).join('\n')

  // Outer planet markers (outside wheel)
  const outerWithSVG=outerPlanets.map(p=>({...p,svgAngle:e2s(p.absolute,ASC)}))
    .sort((a,b)=>a.svgAngle-b.svgAngle)
  const outerDisp=outerWithSVG.map(p=>p.svgAngle)
  const MIN_SEP_O=22
  for(let pass=0;pass<14;pass++){
    for(let i=0;i<outerDisp.length;i++){
      const j=(i+1)%outerDisp.length
      let diff=(((outerDisp[j]-outerDisp[i])%360)+360)%360
      if(diff<MIN_SEP_O&&diff>0){
        const push=(MIN_SEP_O-diff)/2
        outerDisp[i]=((outerDisp[i]-push)+360)%360
        outerDisp[j]=(outerDisp[j]+push)%360
      }
    }
  }

  const outerSVG=outerWithSVG.map((p,idx)=>{
    const da=outerDisp[idx]
    const tp1=polar(p.svgAngle,R_OUT+2,cx,cy),tp2=polar(p.svgAngle,R_OUT+8,cx,cy)
    const lp1=polar(p.svgAngle,R_OUT+9,cx,cy),lp2=polar(da,R_OUT+22,cx,cy)
    const labelPos=polar(da,R_OUT+34,cx,cy)
    const el=SIGN_ELEMENTS[p.sign]||''
    const mod=SIGN_MODALITIES[p.sign]||''
    const hInfo=p.houseNum?` · House ${p.houseNum}`:''
    const info=`${p.name}|${p.signGlyph} ${p.sign} ${p.label}${p.isRetrograde?' ℞':''}|${el} · ${mod}${hInfo}`
    return `<line x1="${tp1.x.toFixed(2)}" y1="${tp1.y.toFixed(2)}" x2="${tp2.x.toFixed(2)}" y2="${tp2.y.toFixed(2)}" stroke="${T.outerPlanetLine}" stroke-width="1"/>
<line x1="${lp1.x.toFixed(2)}" y1="${lp1.y.toFixed(2)}" x2="${lp2.x.toFixed(2)}" y2="${lp2.y.toFixed(2)}" stroke="${T.outerPlanetLine}" stroke-width="0.7"/>
<g class="planet-group" data-info="${info}" style="cursor:pointer">
  <circle cx="${labelPos.x.toFixed(2)}" cy="${labelPos.y.toFixed(2)}" r="11" fill="${T.planetFill}" stroke="${T.outerPlanetLine}" stroke-width="1" class="planet-circle"/>
  <text x="${labelPos.x.toFixed(2)}" y="${labelPos.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="${T.outerPlanetText}" font-size="10" font-family="serif" pointer-events="none">${p.glyph}</text>
</g>`
  }).join('\n')

  // Legend
  const legendHTML=placements.map(p=>{
    const isAM=p.name==='Ascendant'||p.name==='Midheaven'
    const prefix=p.name==='Ascendant'?'AC':p.name==='Midheaven'?'MC':''
    return `<div class="bc-row${isAM?' bc-row-axis':''}">
  <span class="bc-glyph">${prefix||p.glyph}</span>
  <span class="bc-name">${p.name}${p.isRetrograde?'<span class="bc-retro"> ℞</span>':''}</span>
  <span class="bc-sign">${p.signGlyph}</span>
  <span class="bc-pos">${p.sign} ${p.label}${p.houseNum?` · H${p.houseNum}`:''}</span>
</div>`
  }).join('')

  const titleMatch=prompt.match(/^([A-Z][a-zA-Z\s'\-]+?)(?:\s*[-–—:]|\s+birth|\s+natal|\s+chart|\s+astrological)/i)
  const chartTitle=titleMatch?titleMatch[1].trim():'Natal Chart'
  const bdMatch=prompt.match(/birth\s*details?\s*[:\-]?\s*([^\n]+)/i)
  const birthDetails=bdMatch?bdMatch[1].trim():''

  const VSIZE=SIZE+90, OFFSET=45

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
  .planet-group:hover .planet-circle{stroke-width:2.5!important;filter:brightness(1.35);}
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
    <p class="bc-sub">${birthDetails||'Astrological Birth Chart · Placidus Houses · Hover or click planets for details'}</p>
  </div>
  <div class="bc-layout">
    <div class="bc-svg-box" id="bcCont">
      <div class="bc-tooltip" id="bcTip">
        <div class="bc-tt-name" id="bcTipName"></div>
        <div class="bc-tt-pos" id="bcTipPos"></div>
        <div class="bc-tt-sub" id="bcTipSub"></div>
      </div>
      <svg viewBox="${-OFFSET} ${-OFFSET} ${VSIZE} ${VSIZE}" width="${VSIZE}" height="${VSIZE}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bcBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${T.svgBgInner}"/>
            <stop offset="100%" stop-color="${T.svgBgOuter}"/>
          </radialGradient>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${R_OUT+55}" fill="url(#bcBg)"/>
        ${zodSVG}
        ${tickSVG}
        ${spokeSVG}
        ${houseSVG}
        <circle cx="${cx}" cy="${cy}" r="${R_HOU_I-1}" fill="${T.innerCircle}" opacity="0.96"/>
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
  const tip=document.getElementById('bcTip');
  const tName=document.getElementById('bcTipName');
  const tPos=document.getElementById('bcTipPos');
  const tSub=document.getElementById('bcTipSub');
  const cont=document.getElementById('bcCont');
  if(!tip||!cont) return;
  function show(e,info){
    const parts=info.split('|');
    tName.textContent=parts[0]||'';
    tPos.textContent=parts[1]||'';
    tSub.textContent=parts[2]||'';
    tip.classList.add('vis');
    move(e);
  }
  function move(e){
    const r=cont.getBoundingClientRect();
    let x=e.clientX-r.left+14, y=e.clientY-r.top-10;
    const tw=tip.offsetWidth||160, th=tip.offsetHeight||72;
    if(x+tw>r.width-6) x=e.clientX-r.left-tw-14;
    if(y+th>r.height-6) y=e.clientY-r.top-th-10;
    tip.style.left=Math.max(4,x)+'px';
    tip.style.top=Math.max(4,y)+'px';
  }
  function hide(){ tip.classList.remove('vis'); }
  document.querySelectorAll('.planet-group').forEach(function(g){
    const info=g.getAttribute('data-info');
    g.addEventListener('mouseenter',function(e){ show(e,info); });
    g.addEventListener('mousemove', function(e){ move(e); });
    g.addEventListener('mouseleave',hide);
    g.addEventListener('click',function(e){
      e.stopPropagation();
      if(tip.classList.contains('vis')&&tName.textContent===info.split('|')[0]){ hide(); }
      else{ show(e,info); }
    });
  });
  document.addEventListener('click',hide);
})();
</script>`
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

  // Detect explicit color intent in non-glass, non-birth-chart prompts
  const lower = prompt.toLowerCase()
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
AVATARS: Never img. Use gradient circle div with initials span.
JAVASCRIPT: Single script at bottom. Unique ids on interactive elements.
BANNED: writing-mode, text-orientation, transform:rotate on text, vertical text of any kind.

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
    </div>
  )
}

export default App