# ⚡ UI Component Lab — AI Design Engine

**Describe any UI component in plain English. Watch production-quality HTML appear in seconds.**

[![GitHub Sponsor](https://img.shields.io/badge/Sponsor-GitHub-EA4AAA?style=for-the-badge&logo=github-sponsors)](https://github.com/sponsors/IdaAkiwumi)
[![PayPal](https://img.shields.io/badge/Donate-PayPal-00457C?style=for-the-badge&logo=paypal)](https://www.paypal.com/paypalme/iakiwumi)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-22c55e?style=for-the-badge&logo=github)](https://IdaAkiwumi.github.io/ai-ui-component-lab/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Realtime%20DB-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**UI Component Lab** is a production-grade AI design tool that converts natural language prompts into clean, 
copy-paste-ready HTML components — glassmorphism cards, pricing tables, data visualizations, 
astrological birth charts, and more — all rendered live in the browser with zero setup for the end user.

---

### ✨ Why UI Component Lab?

Designers want to move fast. Developers hate writing boilerplate CSS. **UI Component Lab** solves both.

- **Multi-Model Intelligence:** Automatically routes your prompt through a cascade of six leading LLMs 
  (Llama 4, Qwen 3, GPT-OSS 120B) and serves whichever returns the best valid HTML first
- **Incognito-Proof Rate Limiting:** Guest usage is tracked via device fingerprint + Firebase Realtime Database — 
  clearing cookies, going incognito, or switching browsers does nothing. A clean, abuse-resistant architecture 
  without requiring user accounts
- **Local Birth Chart Renderer:** Astrological natal charts are rendered entirely in the browser via a 
  custom SVG engine — no API call, no latency, exact degree placement from prompt data
- **Prompt Intelligence:** Detects glassmorphism, image, chart, star rating, and emoji requests 
  and adjusts the system prompt, gradient selection, and output sanitization accordingly
- **Session History:** Every generation is stored in session state with one-click restore — 
  iterate quickly without losing previous versions

---

### 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18 + Vite 5 |
| **Styling** | Tailwind CSS |
| **AI / LLM API** | Groq Cloud (6-model cascade) |
| **Models** | Llama 3.1 8B · Llama 3.3 70B · Llama 4 Scout · Qwen3 32B · GPT-OSS 20B · GPT-OSS 120B |
| **Database** | Firebase Realtime Database |
| **Anti-Abuse** | FingerprintJS device fingerprinting |
| **Deployment** | GitHub Pages via GitHub Actions CI/CD |
| **Charts** | Custom inline SVG engine (no chart library) |

---

### 🚀 Live Demo

**[→ Try it now](https://IdaAkiwumi.github.io/ai-ui-component-lab/)**

Guest users get **10 free generations per day** — enough to explore the full range of the tool.
No account required. Works on any device.

**Try these prompts:**
- `A glassmorphic pricing card with three tiers in purple`
- `A dark analytics dashboard with a donut chart showing traffic sources`
- `A minimal job listing card for a senior frontend engineer role`
- `A glassmorphic login form with email and password fields in teal`

---

### 🧠 Architecture Highlights

**Multi-Model Cascade** — Prompts are routed through up to six Groq-hosted LLMs in priority order.
The 8B model is skipped for large prompts; failed or rate-limited calls fall through automatically
until the first valid HTML response is returned and sanitized for preview.

**Fingerprint-Keyed Rate Limiting** — FingerprintJS hashes device signals (GPU, screen, timezone,
fonts) into a key that maps to a Firebase Realtime DB counter. The daily cap is enforced by a
Firebase security rule — not client logic — so incognito mode, cookie clearing, and direct REST
calls are all blocked at the server.

**Smart Prompt Classification** — Before any API call, the prompt is scored across five dimensions
(glassmorphism, visualization, image, birth chart, star/emoji) to select the right system prompt,
CSS template, and sanitization pass. Birth chart requests bypass the API entirely and render locally
via a custom inline SVG engine.
---

### 🖥️ Local Development

```bash
# 1. Clone
git clone https://github.com/YourUsername/ui-component-lab.git
cd ui-component-lab

# 2. Install
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your Groq and Firebase credentials

# 4. Run
npm run dev
Required .env variables:

bash
VITE_GROQ_API_KEY=           # groq.com — free tier is generous
VITE_DEV_PASSWORD=           # your own secret for bypassing guest limits
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
📁 Project Structure
text
src/
├── App.jsx                  # Core app logic, model cascade, rate limiting
├── firebase.js              # Firebase initialization
├── guestLimit.js            # Fingerprint + Firebase usage tracking
├── components/
│   ├── PromptPanel.jsx      # Left panel — prompt input + controls
│   ├── PreviewPanel.jsx     # Right panel — live HTML preview in iframe
│   └── SessionHistory.jsx   # Bottom strip — session history with restore
.github/


```


### 🔒 Security Notes
* Rate limiting + daily caps prevent API abuse.
* Firebase security rules enforce server-side count validation.
* The dev-mode backdoor requires a password set in environment variables.

### 🗺️ Roadmap
* [ ] Export generated components as downloadable .html files
* [ ] Prompt history persistence via Firebase Auth
* [ ] Variation mode — generate 3 alternatives side by side
* [ ] Custom color/style presets per session

### 💡 For Hiring Managers
This project demonstrates:
* **API Orchestration:** Multi-provider fallback logic.
* **Security Thinking:** Fingerprinting and server-side validation.
* **React Architecture:** Clean separation of concerns and custom hooks.


### ☕ Support This Project
* [Sponsor on GitHub](https://github.com/sponsors/IdaAkiwumi)
* [Donate via PayPal](https://www.paypal.com/paypalme/iakiwumi)

Developed by Ida Akiwumi
*Creative Technologist | Frontend Engineer | AI Integration Specialist
