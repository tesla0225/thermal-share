# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 application that analyzes user voice input to detect body temperature feelings (hot/cold) using Google's Gemini AI models. The app generates visual and audio responses creating a "feeling timeline" with cards showing AI-generated images and TTS audio.

**Tech Stack:**
- Next.js 16 (App Router) with React 19
- TypeScript
- Tailwind CSS 4
- Google Gemini AI (@google/genai 1.30.0)
  - gemini-2.5-flash for audio analysis
  - gemini-2.5-flash-image for image generation
  - gemini-2.5-flash-preview-tts for text-to-speech
- Zod for schema validation
- Vercel Blob & KV for production storage (optional, falls back to local storage)

## Common Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:3000

# Build & Production
npm run build        # Build for production
npm start           # Start production server

# Linting
npm run lint        # Run ESLint
```

## Environment Variables

Required:
- `GEMINI_API_KEY` - Google Gemini API key

Optional (for production deployment on Vercel):
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token
- `KV_REST_API_URL` - Vercel KV REST API URL
- `KV_REST_API_TOKEN` - Vercel KV REST API token

When these Vercel tokens are not set, the app falls back to in-memory storage and local filesystem (`/public/generated/`).

## Architecture

### Data Flow

1. **Audio Input** → User records voice via browser MediaRecorder API
2. **Analysis** → Audio uploaded to `/api/items` (POST)
3. **Gemini Processing** → Three parallel Gemini API calls:
   - Audio analysis with structured output (Zod schema)
   - Image generation from feeling prompt
   - TTS generation from feeling response
4. **Storage** → Results saved to Vercel KV/Blob or local fallback
5. **Display** → Timeline component shows all generated items

### Key Modules

**[lib/gemini.ts](lib/gemini.ts)** - Gemini AI integration
- `analyzeFeelingFromAudio()` - Analyzes audio and returns structured FeelingAnalysis using Zod schema
- `generateImageFromFeeling()` - Generates 1:1 aspect ratio image from prompt
- `generateTtsFromFeeling()` - Generates TTS audio using "Kore" voice, returns WAV format

**[lib/storage.ts](lib/storage.ts)** - Storage abstraction layer
- Auto-detects Vercel Blob/KV availability
- Falls back to local filesystem and in-memory storage for development
- `storeGeneratedFile()` - Saves images/audio to Blob or `/public/generated/`
- `saveItem()` / `getItems()` - Persists items to KV (sorted set) or memory

**[lib/items.ts](lib/items.ts)** - Business logic
- `createItem()` - Orchestrates the full pipeline: analyze → generate image + TTS → save
- Uses `Promise.all()` to parallelize image and TTS generation

**[lib/types.ts](lib/types.ts)** - Zod schemas and TypeScript types
- `FeelingAnalysisSchema` - Structured output schema for Gemini API
- Fields: `label` (hot/cold/neutral), `degree` (-1.0 to 1.0), prompts for image/TTS, summaries in Japanese

**[lib/audio.ts](lib/audio.ts)** - Audio utilities
- `pcmToWav()` - Converts raw PCM buffer from Gemini TTS to WAV format (no external dependencies)

**[lib/use-audio-recorder.ts](lib/use-audio-recorder.ts)** - Browser audio recording hook
- Wraps MediaRecorder API
- Returns WebM audio blob for upload

### API Routes

**[app/api/items/route.ts](app/api/items/route.ts)**
- `GET /api/items?limit=20` - Fetch recent items from storage
- `POST /api/items` - Accept audio FormData, process through pipeline, return GeneratedItem

### UI Components

**[components/record-button.tsx](components/record-button.tsx)** - Recording button with states (idle/recording/processing)

**[components/feeling-card.tsx](components/feeling-card.tsx)** - Displays individual feeling with image, audio player, metadata

**[components/timeline.tsx](components/timeline.tsx)** - Grid layout of FeelingCard components

**[app/page.tsx](app/page.tsx)** - Main page coordinating recording flow and timeline display

## Development Notes

### Gemini API Usage
- All Gemini calls happen server-side in [lib/gemini.ts](lib/gemini.ts)
- Audio files are uploaded to Gemini Files API before content generation
- Structured output uses `responseMimeType: "application/json"` with Zod schema
- Image/TTS generation uses `responseModalities: ["IMAGE"]` or `["AUDIO"]`

### Storage Strategy
The app adapts to available infrastructure:
- **Production (Vercel):** Uses Blob for files, KV for metadata/indexing
- **Development:** Uses `public/generated/` for files, in-memory array for metadata
- Check flags via `hasBlob` and `hasKv` in [lib/storage.ts](lib/storage.ts:10-12)

### Audio Handling
- Browser records in WebM format (browser-dependent codec)
- Gemini accepts WebM directly for audio analysis
- Gemini TTS outputs raw PCM (16-bit, 24kHz, mono)
- [lib/audio.ts](lib/audio.ts) converts PCM to WAV by adding header

### Path Aliases
- `@/*` resolves to project root (see [tsconfig.json](tsconfig.json:21-23))
- Example: `@/lib/types` → `./lib/types`

### Japanese Language
This app is designed for Japanese users:
- UI text is in Japanese
- Gemini prompts request Japanese responses for `summaryJa`, `promptForTts`, `userUtteranceJa`
- Image prompts (`promptForImage`) are in English for better Gemini image generation quality
