# 🎯 Design Matrix - Interactive Idea Prioritization Tool

A modern, interactive design thinking tool built with React that allows you to prioritize ideas using a value vs. complexity matrix.

## ✨ Features

- **🖱️ Drag & Drop**: Smooth, intuitive card repositioning on the matrix
- **👆 Double-Click Editing**: Quick access to edit any idea
- **📊 Real-time Visualization**: See ideas organized by quadrants (Quick Wins, Strategic, Avoid, Reconsider)
- **💾 Persistent Storage**: All ideas saved in Supabase with real-time sync
- **🎨 Modern UI**: Clean, professional interface with Tailwind CSS
- **📱 Responsive**: Works great on desktop and mobile devices

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   cd design-matrix-app
   npm install
   ```

2. **Set up Supabase**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy `.env.example` to `.env.local`
   - Add your Supabase URL and anon key to `.env.local`
   - Run the SQL from `database/schema.sql` in your Supabase SQL editor

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to `http://localhost:5173`

## 🎮 How to Use

### Adding Ideas
1. Click the **"Add Idea"** button in the header
2. Describe your idea
3. Set the implementation difficulty (0-10)
4. Set the business value (0-10)
5. Choose a priority level
6. Click "Add Idea"

### Interacting with Ideas
- **Double-click any card** → Opens edit modal
- **Drag cards** → Repositions them on the matrix
- **Hover over card** → Shows delete button
- **Click delete (×)** → Removes the idea

### Matrix Quadrants
- 🟢 **Quick Wins**: High value, low difficulty - Do these first!
- 🔵 **Strategic**: High value, high difficulty - Plan carefully
- 🔴 **Avoid**: Low value, low difficulty - Skip to focus resources
- 🟠 **Reconsider**: Low value, high difficulty - Maybe later

## 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript
- **Drag & Drop**: @dnd-kit (best-in-class React drag library)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL with real-time subscriptions)

## 📦 Project Structure

```
src/
├── components/
│   ├── DesignMatrix.tsx      # Main matrix visualization
│   ├── IdeaCardComponent.tsx # Individual idea cards
│   ├── AddIdeaModal.tsx      # Modal for adding new ideas
│   └── EditIdeaModal.tsx     # Modal for editing ideas
├── types/
│   └── index.ts              # TypeScript interfaces
├── App.tsx                   # Main app component
└── main.tsx                  # Entry point
```

## 🚀 Deployment

Ready to deploy anywhere:

### Vercel (Recommended)
```bash
npm run build
# Connect to Vercel and deploy
```

### Netlify
```bash
npm run build
# Drag the `dist` folder to Netlify
```

## ✅ Features Complete

- **🔄 Real-time Collaboration**: ✅ Multiple users editing simultaneously
- **☁️ Cloud Storage**: ✅ Supabase backend integration
- **📊 Live Statistics**: ✅ Real-time quadrant analysis

## 🔜 Coming Soon

- **📊 Advanced Analytics**: Detailed insights on your idea portfolio  
- **🔒 User Authentication**: Personal accounts and team workspaces
- **📱 Mobile App**: Native iOS and Android versions

## 🎨 Why This is Better Than Streamlit

✅ **Smooth Interactions**: Real drag & drop, no iframe limitations  
✅ **Professional Polish**: Modern UI that users will love  
✅ **Real-time Ready**: Built for multi-user collaboration  
✅ **Mobile Friendly**: Works perfectly on all devices  
✅ **Scalable**: Can grow with your needs  
✅ **Fast**: Instant interactions, no page refreshes  

## 🤝 Contributing

This is a modern, extensible codebase. Easy to add features like:
- Team collaboration
- Advanced filtering
- Custom quadrant labels  
- Data export/import
- Integration with project management tools

---

**Ready to prioritize your ideas like a pro?** 🎯

Run `npm run dev` and start organizing your thoughts in the most intuitive way possible!