# 🔧 Frontend Login Issues - Troubleshooting Guide

## ✅ Status Check (Just Verified):

### Backend:
- ✅ Running on port 5000
- ✅ Buyer login endpoint works: `/api/buyer/login`
- ✅ Cardholder signup endpoint works: `/api/auth/signup`
- ✅ Cardholder login endpoint works: `/api/auth/login`
- ✅ CORS enabled
- ✅ MongoDB connected
- ✅ Redis connected

### Frontend:
- ✅ Running on port 5173
- ✅ Firebase config file exists with valid credentials
- ✅ No compilation errors
- ⚠️ May need restart to load env variables

---

## 🐛 Common Issues & Solutions:

### Issue 1: "Firebase not defined" or "auth is undefined"

**Cause:** Frontend server not restarted after adding Firebase env vars

**Solution:**
```bash
# Stop frontend (Ctrl+C in terminal)
cd frontend
npm run dev
```

---

### Issue 2: Login button doesn't work / No response

**Cause:** Browser console errors, check F12 Developer Tools

**Solution:**
1. Open browser
2. Press F12
3. Go to Console tab
4. Try to login
5. Check for errors (red text)

**Common errors:**
- `Firebase: Error (auth/invalid-api-key)` → Check `.env` file
- `Network Error` → Check backend is running
- `CORS error` → Already fixed in backend

---

### Issue 3: "Cannot read properties of undefined (reading 'displayName')"

**Cause:** Google Sign-In failing

**Solution:**
Use Email/Password login instead:
1. Enter Name: "Test Buyer"
2. Enter Email: "buyer@test.com"  
3. Enter Password: "password123"
4. Click "Sign Up" (first time) or "Login" (returning)

---

### Issue 4: Redirects to wrong dashboard

**Cause:** Role not set correctly in localStorage

**Solution:**
```javascript
// Check in browser console (F12):
localStorage.getItem('role')  // Should be "buyer" or "cardholder"

// If wrong, clear and re-login:
localStorage.clear()
```

---

### Issue 5: "Invalid credentials" for cardholder

**Cause:** 
- Wrong email/password
- User doesn't exist
- Need to sign up first

**Solution:**
1. Use Sign Up button first time
2. Then use Login button with same credentials

---

## 🧪 Testing Steps:

### Test Buyer Login:

1. **Go to:** `http://localhost:5173/`

2. **Sign Up (First Time):**
   - Name: "Test Buyer"
   - Email: "buyer1@test.com"
   - Password: "password123"
   - Click "Sign Up"
   
3. **Login (Returning):**
   - Email: "buyer1@test.com"
   - Password: "password123"
   - Click "Login"

4. **Expected Result:**
   - ✅ Toast: "Signed up as buyer1@test.com" or "Logged in as buyer1@test.com"
   - ✅ Redirected to `/buyer-dashboard`
   - ✅ See "Create Deal" interface

---

### Test Cardholder Login:

1. **Go to:** `http://localhost:5173/cardholder`

2. **Sign Up (First Time):**
   - Name: "Test Cardholder"
   - Email: "card1@test.com"
   - Password: "password123"
   - Click "Sign Up"

3. **Login (Returning):**
   - Email: "card1@test.com"
   - Password: "password123"
   - Click "Login"

4. **Expected Result:**
   - ✅ Toast: "Cardholder signed up: Test Cardholder" or "Cardholder logged in: Test Cardholder"
   - ✅ Redirected to `/cardholder-dashboard`
   - ✅ See "Available Deals" section

---

## 🔍 Backend Verification (Already Working):

Tested via PowerShell:
```powershell
# Cardholder Signup - ✅ Works
Invoke-WebRequest -Uri "http://localhost:5000/api/auth/signup" -Method POST -ContentType "application/json" -Body '{"name":"Test","email":"test@test.com","password":"test123"}'
# Response: 200 OK with token

# Buyer Login - ✅ Works  
Invoke-WebRequest -Uri "http://localhost:5000/api/buyer/login" -Method POST -ContentType "application/json" -Body '{"name":"Test","email":"buyer@test.com"}'
# Response: 200 OK with token
```

---

## 🚀 Quick Fix Checklist:

- [ ] Backend running? → `netstat -ano | findstr :5000`
- [ ] Frontend running? → `netstat -ano | findstr :5173`
- [ ] Firebase config exists? → Check `frontend/.env`
- [ ] Restart frontend? → Stop (Ctrl+C) and `npm run dev`
- [ ] Clear browser cache? → Ctrl+Shift+Delete
- [ ] Clear localStorage? → Browser console: `localStorage.clear()`
- [ ] Check browser console? → F12 → Console tab
- [ ] Try different browser? → Chrome/Firefox/Edge

---

## 📱 Specific Error Messages:

### "Failed to fetch"
**Solution:** Backend not running
```bash
cd backend
node server.js
```

### "auth/invalid-api-key"
**Solution:** Firebase config wrong in `.env`

### "Network request failed"  
**Solution:** Check if ports 5000 and 5173 are accessible

### "Unexpected token < in JSON"
**Solution:** Backend returning HTML instead of JSON (wrong URL or CORS)

---

## 🔧 Restart Everything Fresh:

```bash
# Terminal 1: Backend
cd backend
node server.js

# Terminal 2: Frontend  
cd frontend
npm run dev

# Wait for both to start completely
# Then test in browser
```

---

## ✅ What to Check Next:

1. **Open browser console (F12)**
2. **Try to login**
3. **Look for red error messages**
4. **Share the exact error message**

**Common patterns:**
- Red error in Console → JavaScript/API error
- Yellow warning → Non-critical issue
- Network tab 404/500 → Backend endpoint issue

---

## 🎯 If Still Not Working:

Please provide:
1. **Exact error message** from browser console (F12)
2. **Which login not working?** Buyer or Cardholder or both?
3. **What happens?** Nothing? Redirect? Error message?
4. **Browser?** Chrome, Firefox, Edge?

---

## 💡 Known Working State:

- Backend endpoints: ✅ Tested and working
- Frontend serving: ✅ Port 5173 active
- Firebase config: ✅ File exists with values
- Routes configured: ✅ All routes in App.jsx
- No compilation errors: ✅ Verified

**Most likely issue:** Frontend needs restart to load Firebase env vars

**Quick fix:** Stop frontend (Ctrl+C) and restart with `npm run dev`
