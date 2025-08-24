# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a browser extension called **mAIscam** built using WXT framework with React and TypeScript. The extension analyzes emails, websites, and social media posts for scam detection, targeting multiple Southeast Asian languages.

## Development Commands

### Essential Commands
```bash
# Install dependencies
npm install

# Start development server (Chrome)
npm run dev

# Start development for Firefox
npm run dev:firefox

# Build for production
npm run build

# Build for Firefox
npm run build:firefox

# Create distribution packages
npm run zip
npm run zip:firefox

# TypeScript compilation check
npm run compile

# Prepare WXT (run automatically after install)
npm run postinstall
```

### Development Workflow
- `npm run dev` - Starts development with hot reload, automatically opens Chrome with extension loaded
- The extension supports hot-reload, changes reflect without manually refreshing
- Use `npm run compile` to check TypeScript errors without building

## Code Architecture

### High-Level Structure

The extension follows WXT framework conventions with a multi-entrypoint architecture:

**Core Components:**
- **Background Script** (`src/entrypoints/background.ts`) - Coordinates data flow between content scripts and popup
- **Content Script** (`src/entrypoints/content.ts`) - Handles data extraction from web pages (Gmail, websites, Facebook)
- **Popup** (`src/entrypoints/popup/`) - React-based UI for user interaction

**Key Extension Features:**
1. **Email Analysis** - Extracts Gmail content and analyzes for scam patterns
2. **Website Scanning** - Captures website metadata and screenshots
3. **Facebook Post Analysis** - Interactive post selection and data extraction

### Data Flow Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Popup (UI)    │◄──►│  Background     │◄──►│ Content Script  │
│   - User Input  │    │  - Data Storage │    │ - Page Analysis │
│   - Results     │    │  - Message Hub  │    │ - Data Extract  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Mock API      │
                       │ - Scam Analysis │
                       │ - Multi-language│
                       └─────────────────┘
```

### Extension Architecture Patterns

**Message Passing System:**
- All communication between components uses Chrome extension messaging API
- Background script acts as central message hub and data store
- Content script responds to specific extraction requests
- Popup initiates actions and displays results

**State Management:**
- Background script maintains latest extracted data
- Facebook extraction uses persistent state management for multi-step user interaction
- Content script manages extraction state for Facebook posts

**Multi-Platform Data Extraction:**
- **Gmail**: Complex selector-based extraction handling various Gmail layouts and spam folders
- **Websites**: Metadata extraction plus screenshot capture via Chrome tabs API
- **Facebook**: Interactive overlay system for user-driven post selection

### Language Support

The extension supports 13 languages for scam analysis:
- English, Bahasa Malaysia, Chinese, Vietnamese, Thai, Filipino
- Indonesian, Javanese, Sundanese, Khmer, Lao, Myanmar, Tamil

Each language has localized risk assessment and recommendations in `src/utils/mockApi.ts`.

### Key Technical Patterns

**Content Script Extraction Strategy:**
- Uses multiple CSS selector fallbacks for robust data extraction
- Handles dynamic class names in modern web apps (Gmail, Facebook)
- Implements aggressive extraction methods for difficult cases (spam emails)

**Facebook Post Selection:**
- Creates overlay UI for interactive post selection
- State persists across popup open/close cycles
- Automatic timeout and cancellation handling

**Extension Permissions:**
- `activeTab`, `tabs`, `scripting` for content interaction
- `host_permissions` for Gmail and broad web access
- Content Security Policy configured for extension pages

### Mock API System

Located in `src/utils/mockApi.ts`, simulates backend scam analysis:
- Provides realistic analysis responses for different risk levels
- Supports all target languages with localized responses
- Generates mock email IDs for testing

## Configuration Files

- `wxt.config.ts` - WXT framework configuration with React module and Tailwind CSS
- `tsconfig.json` - Extends WXT TypeScript config with React JSX support
- `package.json` - Defines scripts and dependencies for WXT-based development

## Development Notes

### Content Script Debugging
- All extraction functions include extensive console logging
- Use browser DevTools on target pages (Gmail/Facebook) to debug extraction
- Content script runs on all URLs (`<all_urls>`) with UI injection mode

### Extension Testing
- Gmail extraction works best with expanded message view
- Facebook extraction requires user interaction - posts with images only
- Website scanning captures full page screenshot and metadata

### Build System
- Built on WXT framework (successor to Webextension-Polyfill)
- Uses Vite for fast development builds
- Tailwind CSS v4 for styling (note the type compatibility workaround in config)
- TypeScript with strict checking enabled
