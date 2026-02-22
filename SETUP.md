# SETUP.md - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Move Frontend Files
Open file explorer or terminal and move:
```
index.html    → frontend/
script.js     → frontend/
styles.css    → frontend/
```

Or via terminal:
```bash
mv index.html frontend/
mv script.js frontend/
mv styles.css frontend/
cd frontend
```

### Step 2: Backend Setup
```bash
cd backend
npm install
```

### Step 3: Configure API Keys
```bash
cp .env.example .env
```

Then edit `.env` with your API keys:
```
GROQ_API_KEY=your_groq_key_here
GOOGLE_API_KEY=your_google_gemini_key_here
PORT=3000
NODE_ENV=development
```

Get your API keys:
- **Groq**: https://console.groq.com/keys
- **Google Gemini**: https://aistudio.google.com/app/apikey

### Step 4: Start Backend Server
```bash
npm start
```

You should see:
```
✅ Backend running at http://localhost:3000
📁 Frontend served from: ../frontend
```

### Step 5: Open in Browser
Navigate to: **http://localhost:3000**

---

## 📊 Project Structure

```
Hacnovation2.0/
│
├─ frontend/                  ⬅️ Frontend Application
│  ├─ index.html            
│  ├─ script.js             
│  ├─ styles.css            
│  └─ README.md             
│
├─ backend/                  ⬅️ Backend API Server
│  ├─ server.js             (Main entry point)
│  ├─ package.json          (Dependencies)
│  ├─ .env.example          (Config template)
│  ├─ .gitignore
│  │
│  ├─ src/
│  │  ├─ routes/
│  │  │  └─ apiRoutes.js    (All /api/* endpoints)
│  │  │
│  │  ├─ logic/             (Business logic layer)
│  │  │  ├─ spoilageLogic.js
│  │  │  ├─ diseaseLogic.js
│  │  │  └─ marketLogic.js
│  │  │
│  │  ├─ models/
│  │  │  └─ cropDatabase.js (Crop data & constants)
│  │  │
│  │  └─ utils/
│  │     └─ aiService.js    (Groq & Gemini wrappers)
│  │
│  └─ tests/
│     ├─ list-groq-models.js
│     └─ test-gemini-final.js
│
├─ README.md                 (Main documentation)
├─ COMMIT_GUIDE.md          (Git commit guidelines)
├─ SETUP.md                 (This file)
└─ .gitignore
```

---

## 🐛 Troubleshooting

### "Can't find module 'cors'"
```bash
cd backend
npm install
```

### "Port 3000 already in use"
```bash
# Find what's using port 3000 and kill it, or use different port:
# Edit backend/.env and change PORT=3001
```

### "API keys not working"
- Double-check your .env file (no quotes needed unless spaces)
- Verify keys from console.groq.com and aistudio.google.com
- Test with: `node backend/tests/test-gemini-final.js`

### "Frontend files show 404"
- Ensure you moved index.html, script.js, styles.css to frontend/ folder
- Backend server should serve from ../frontend directory

---

## 📝 Making First Commit

```bash
# From project root
git add .

# Make organized commits
git commit -m "📦 refactor: Reorganize project into modular structure

- Separated frontend and backend folders
- Modularized backend logic (routes, logic, models, utils)
- Added comprehensive documentation
- Created setup and commit guidelines"

git log --oneline  # View commit
```

---

## 🎯 Next Steps

1. ✅ Complete this setup guide
2. ✅ Move frontend files to frontend/ folder
3. ✅ Configure .env with API keys
4. ✅ Start backend server
5. ✅ Test frontend at http://localhost:3000
6. ✅ Make your first organized commit
7. ✅ Push to GitHub

---

## 📚 Documentation Files

- **README.md** - Main project documentation
- **COMMIT_GUIDE.md** - Git workflow & best practices
- **backend/README.md** - Backend API documentation
- **frontend/README.md** - Frontend structure
- **backend/tests/README.md** - Testing utilities
- **SETUP.md** - This setup guide

---

## 🚨 Important: Never Commit These

These should be in .gitignore (already configured):
- ❌ `.env` (contains your API keys!)
- ❌ `node_modules/` (reinstall with npm install)
- ❌ `.DS_Store`, `Thumbs.db`
- ❌ `*.log` files

---

**You're all set! Happy coding! 🎉**

Questions? Check the README.md or COMMIT_GUIDE.md files.
