# Security Implementation

## Overview

This application implements a secure server-side proxy for AI API calls to protect API keys from client-side exposure.

## Security Architecture

### ✅ **Secure Implementation**

1. **Server-Side AI API Proxy**
   - All AI API calls go through `/api/ai/*` endpoints
   - API keys are stored server-side only (without VITE_ prefix)
   - Client never has direct access to OpenAI/Anthropic keys

2. **Environment Variables**
   - **Client-side** (VITE_ prefix): Only Supabase public keys
   - **Server-side**: OpenAI/Anthropic keys in deployment environment

3. **Rate Limiting**
   - IP-based rate limiting for anonymous users (5 requests/minute)
   - User-based rate limiting for authenticated users (20 requests/minute)
   - Per-endpoint limits to prevent abuse

4. **Authentication Integration**
   - Optional Supabase authentication for higher rate limits
   - Graceful degradation for unauthenticated users

## API Endpoints

### `/api/ai/generate-ideas`
- **Method**: POST
- **Auth**: Optional (higher limits with auth)
- **Rate Limit**: 5/min anonymous, 20/min authenticated
- **Body**: `{ title, description, projectType }`

### `/api/ai/generate-insights` 
- **Method**: POST
- **Auth**: Optional
- **Rate Limit**: 8/min anonymous, 16/min authenticated
- **Body**: `{ ideas, projectName, projectType }`

### `/api/ai/generate-roadmap`
- **Method**: POST
- **Auth**: Optional  
- **Rate Limit**: 5/min anonymous, 10/min authenticated
- **Body**: `{ projectName, projectType, ideas }`

## Deployment Configuration

### Vercel Environment Variables

Set these in your Vercel project settings (Environment Variables):

```bash
# Required for AI features (server-side only)
OPENAI_API_KEY=sk-your-openai-key-here
# OR
ANTHROPIC_API_KEY=your-anthropic-key-here

# Optional: Supabase keys for server-side auth verification
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Local Development

For local testing with AI features, create a `.env.local` file:

```bash
# Server-side AI keys (no VITE_ prefix)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## Security Benefits

1. **API Key Protection**: Keys never exposed to client-side JavaScript
2. **Rate Limiting**: Prevents abuse and controls costs
3. **Authentication Integration**: Enhanced limits for legitimate users
4. **Graceful Fallbacks**: Mock responses when AI services unavailable
5. **Error Handling**: Secure error messages without key exposure

## Testing

The AI features will work in three modes:

1. **Full AI Mode**: With valid API keys set in deployment environment
2. **Mock Mode**: Fallback responses when no API keys available
3. **Error Mode**: Graceful handling of API failures

## Migration Notes

- Old client-side configuration automatically migrated
- Existing AI features continue working through secure proxy
- No breaking changes to component interfaces
- Enhanced security with better rate limiting