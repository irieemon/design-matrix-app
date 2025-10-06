# Prioritas

**Smart Prioritization Suite for Teams**

A modern, collaborative prioritization tool built with React, TypeScript, and Supabase. Prioritas helps teams visualize and prioritize ideas using an interactive priority matrix with real-time collaboration features.

## ✨ Features

- **🎯 Interactive Priority Matrix** - Drag and drop ideas across value vs effort quadrants
- **👥 Real-time Collaboration** - Multiple users can work together simultaneously
- **📊 Smart Analytics** - Built-in reports and insights on idea distribution
- **💾 Data Management** - CSV import/export for easy data portability  
- **🎨 Modern UI** - Clean, responsive design with dark sidebar navigation
- **⚡ Fast Performance** - Built with Vite for lightning-fast development and builds

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd prioritas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Add your Supabase credentials to `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## 🏗️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Drag & Drop**: @dnd-kit/core
- **Database**: Supabase (PostgreSQL)
- **Build Tool**: Vite
- **Hosting**: Vercel
- **Icons**: Lucide React

## 🎯 The Priority Matrix

Prioritas uses a 2x2 matrix to help teams categorize ideas:

- **🟢 Quick Wins** (High Value, Low Effort) - Do these first for immediate impact
- **🔵 Strategic** (High Value, High Effort) - Plan carefully for long-term value  
- **🟡 Reconsider** (Low Value, Low Effort) - Maybe later when priorities shift
- **🔴 Avoid** (Low Value, High Effort) - Skip these to focus resources

## 🚀 Deployment

This project is configured for automatic deployment to Vercel when you push to the main branch.

### Environment Variables for Production

Set these in your Vercel dashboard:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

**Prioritas** - Making prioritization simple, visual, and collaborative.
## ⚠️ NEVER RUN WITH SUDO

**NEVER** run npm commands with sudo:

❌ **WRONG**: `sudo npm run dev`
✅ **RIGHT**: `npm run dev`

Running with sudo causes 35,000+ files to become root-owned, breaking the development server.
If you encounter permission errors, fix the underlying issue - don't use sudo to bypass it.

# Trigger rebuild
