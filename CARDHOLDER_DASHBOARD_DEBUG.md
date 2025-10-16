# 🐛 Cardholder Dashboard Debugging Guide

## Issue: "Unable to see anything in Cardholder Dashboard"

### ✅ Fixes Applied:

1. **Added comprehensive error logging** in `fetchDeals()` function
2. **Fixed signup navigation** - now redirects to dashboard after signup
3. **Enhanced console logging** for debugging API calls

---

## 📝 How to Debug:

### Step 1: Check Backend is Running
```bash
cd backend
node server.js
```

**Expected Output:**
```
🔥 Server running on port 5000
✅ MongoDB connected
✅ Redis connected
```

### Step 2: Check Frontend is Running
```bash
cd frontend
npm run dev
```

**Expected Output:**
```
VITE ready in xxx ms
Local: http://localhost:5173/
```

### Step 3: Open Browser Console (F12)

When you load the Cardholder Dashboard, you should see these logs:

#### ✅ Good Output:
```
🔄 Fetching deals... Token exists: true
📡 API Response status: 200
📦 Raw deals data: { deals: [...], count: X }
✅ Deals refreshed: X pending deals
```

#### ❌ Problem Indicators:

**No Token:**
```
🔄 Fetching deals... Token exists: false
```
**Solution:** You're not logged in. Go to `/cardholder` and login/signup

**Backend Not Running:**
```
❌ Error fetching deals: TypeError: Failed to fetch
```
**Solution:** Start backend server with `node server.js`

**API Error:**
```
❌ Failed to fetch deals: 401 { error: 'No token provided' }
```
**Solution:** Token expired or invalid. Logout and login again

**No Deals:**
```
✅ Deals refreshed: 0 pending deals
```
**Solution:** No deals created yet. Create a deal from Buyer Dashboard

---

## 🔧 Common Issues & Solutions:

### Issue 1: Blank White Page
**Causes:**
- Frontend not compiled/running
- JavaScript error preventing render
- React component crash

**Solutions:**
1. Check browser console (F12) for errors
2. Restart frontend: `npm run dev`
3. Check if all imports are correct

---

### Issue 2: "Loading deals..." Never Stops
**Causes:**
- Backend not running
- Network error
- CORS issue

**Solutions:**
1. Start backend: `cd backend && node server.js`
2. Check backend console for errors
3. Verify `http://localhost:5000` is accessible
4. Test API manually: Open `http://localhost:5000/api/deals` in browser

---

### Issue 3: "No pending deals available"
**Causes:**
- No deals created yet
- All deals expired or taken
- Database empty

**Solutions:**
1. Create a deal from Buyer Dashboard
2. Check MongoDB: `db.deals.find({ status: 'pending' })`
3. Make sure deal hasn't expired (5-minute window)

---

### Issue 4: Not Redirected After Login
**Causes:**
- Old code (fixed now)
- Navigation blocked

**Solutions:**
1. Code is now fixed - signup redirects to dashboard
2. Clear browser cache and localStorage
3. Try logging in (not signing up)

---

### Issue 5: Toast Errors Appearing
**Check the error message:**

**"Unable to connect to server"**
- Backend is down
- Solution: Start backend

**"Failed to load deals: No token provided"**
- Not logged in or token expired
- Solution: Logout and login again

**"Failed to load deals: Invalid token"**
- Token corrupted
- Solution: `localStorage.clear()` then login

---

## 🧪 Test Checklist:

Run through these steps:

1. **Backend Running?**
   - [ ] Run `node server.js` in backend folder
   - [ ] See "Server running on port 5000"

2. **Frontend Running?**
   - [ ] Run `npm run dev` in frontend folder  
   - [ ] See "Local: http://localhost:5173/"

3. **Can Login?**
   - [ ] Go to `http://localhost:5173/cardholder`
   - [ ] Enter email/password and click "Login"
   - [ ] Redirected to `/cardholder-dashboard`

4. **Console Logs Working?**
   - [ ] Open F12 (Developer Tools)
   - [ ] See "🔄 Fetching deals..."
   - [ ] See "✅ Deals refreshed: X pending deals"

5. **Page Renders?**
   - [ ] See "Cardholder Dashboard" header
   - [ ] See "Profile" and "Logout" buttons
   - [ ] See "Available Deals" section

---

## 📊 What You Should See:

### Scenario 1: No Deals (Expected at first)
```
┌─────────────────────────────────────────┐
│  Cardholder Dashboard    [Profile] [Logout] │
├─────────────────────────────────────────┤
│  Available Deals                        │
│                                         │
│  No pending deals available.            │
│  Check back soon!                       │
└─────────────────────────────────────────┘
```

### Scenario 2: With Deals
```
┌─────────────────────────────────────────┐
│  Cardholder Dashboard    [Profile] [Logout] │
├─────────────────────────────────────────┤
│  Available Deals                        │
│                                         │
│  ┌───────────────────────────────┐    │
│  │ [Image] Product Title         │    │
│  │         Original: ₹X          │    │
│  │         Your Price: ₹Y        │    │
│  │         [Accept Deal]         │    │
│  └───────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 🚨 Emergency Reset:

If nothing works, try this:

```bash
# 1. Stop all servers (Ctrl+C)

# 2. Clear browser data
# In browser console:
localStorage.clear()
sessionStorage.clear()
# Then refresh page (F5)

# 3. Restart backend
cd backend
node server.js

# 4. Restart frontend (in new terminal)
cd frontend
npm run dev

# 5. Re-login
# Go to http://localhost:5173/cardholder
# Login with your credentials
```

---

## 📞 Still Not Working?

Check these in order:

1. **Backend Console** - Any error messages?
2. **Browser Console (F12)** - Any red errors?
3. **Network Tab (F12)** - Is `/api/deals` request succeeding?
4. **MongoDB** - Is it running? `mongosh` to test
5. **Redis** - Is it running? `redis-cli ping` to test

---

## ✅ Success Indicators:

You'll know it's working when:
- ✅ Page loads with header and buttons
- ✅ Console shows "Deals refreshed"
- ✅ Either deals appear OR "No pending deals" message
- ✅ No red errors in console
- ✅ Toasts appear when events happen

---

**The dashboard WILL show something** - even if empty, you should see:
- Header with "Cardholder Dashboard"
- Profile and Logout buttons
- "Available Deals" section
- Either deals OR "No pending deals available" message

If you see literally nothing (blank page), that's a JavaScript error - check console!
