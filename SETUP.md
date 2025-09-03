# Setup Guide

## Supabase Database Setup

1. **Create a Supabase account**:
   - Go to [supabase.com](https://supabase.com)
   - Sign up for a free account
   - Create a new project

2. **Get your credentials**:
   - Go to Settings → API
   - Copy your Project URL and anon public key

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Create the database table**:
   - Go to your Supabase dashboard
   - Click on "SQL Editor"
   - Copy and paste the contents of `database/schema.sql`
   - Click "Run"

5. **Test the connection**:
   ```bash
   npm run dev
   ```
   
   The app should load without the sample data. Try adding a new idea to test the database connection.

## Features

✅ **Real-time sync**: Changes appear instantly for all users  
✅ **Persistent storage**: Ideas survive page refreshes  
✅ **Drag & drop**: Positions are saved to the database  
✅ **CRUD operations**: Create, read, update, delete all work  

## Troubleshooting

- **Empty matrix**: Check that your Supabase credentials are correct
- **Changes not syncing**: Verify Row Level Security policies are set correctly
- **Console errors**: Check that the `ideas` table exists in your database