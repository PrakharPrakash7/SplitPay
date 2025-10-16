# 🔧 Fix: Port 5000 Already in Use Error

## ❌ Error You're Seeing:
```
Error: listen EADDRINUSE: address already in use :::5000
```

## ✅ Solution:

### Step 1: Close All Existing Node Processes

**Option A: Close from Task Manager (Easiest)**
1. Press `Ctrl + Shift + Esc` to open Task Manager
2. Go to "Details" tab
3. Look for `node.exe` processes
4. Right-click each one → "End Task"
5. Close Task Manager

**Option B: Use PowerShell Command**
```powershell
# Find what's using port 5000
netstat -ano | findstr "5000"

# Kill the process (replace XXXXX with the PID number from above)
taskkill /PID XXXXX /F
```

**I already killed PID 15792 for you!** ✅

---

### Step 2: Start Backend Server

Open **NEW** PowerShell/CMD terminal (Terminal 1):

```bash
cd C:\Users\prakh\Desktop\SplitPay\backend
node server.js
```

**Expected Output:**
```
🔥 Server running on port 5000
📡 Socket.io server initialized
✅ MongoDB connected
✅ Redis connected
```

**Keep this terminal open!**

---

### Step 3: Start Frontend Server

Open **ANOTHER NEW** PowerShell/CMD terminal (Terminal 2):

```bash
cd C:\Users\prakh\Desktop\SplitPay\frontend
npm run dev
```

**Expected Output:**
```
VITE v7.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

**Keep this terminal open too!**

---

### Step 4: Open Browser

Go to: `http://localhost:5173/`

---

## 🚨 If Error Still Happens:

### Check if something else is using port 5000:

```powershell
netstat -ano | findstr "5000"
```

You'll see something like:
```
TCP    0.0.0.0:5000    0.0.0.0:0    LISTENING    12345
```

The number at the end (12345) is the Process ID. Kill it:

```powershell
taskkill /PID 12345 /F
```

Then try starting backend again.

---

## 💡 Pro Tip: Use Nodemon (Optional)

Instead of `node server.js`, use:

```bash
cd backend
npx nodemon server.js
```

This auto-restarts the server when you make changes!

---

## ✅ Quick Check Commands:

**Is backend running?**
```
Open: http://localhost:5000/api/deals
Should see JSON data or "No token provided" error
```

**Is frontend running?**
```
Open: http://localhost:5173
Should see login page
```

---

## 🎯 Both Servers Running Successfully?

You should have:
- ✅ Terminal 1: Backend (showing "Server running on port 5000")
- ✅ Terminal 2: Frontend (showing "Local: http://localhost:5173/")
- ✅ Browser: Can access http://localhost:5173/

Now you can test the app! 🚀

---

## 📝 Summary of What Happened:

**Problem:** You tried to start the backend server multiple times, and an old Node process was still running on port 5000.

**Solution:** I killed the old process (PID 15792). Now you need to start both servers fresh in separate terminals.

**Remember:** 
- Backend = `node server.js` in `/backend` folder
- Frontend = `npm run dev` in `/frontend` folder
- Keep both terminals open while testing!
