# 🔧 Testing Guide - Recent Changes

## ✅ Changes Made (October 17, 2025)

### 1. Environment Variables
- All `localhost:5000` → `${API_BASE_URL}`
- 9 frontend files updated
- Centralized API configuration

### 2. Invoice PDF Validation
- URLs must end with `.pdf` OR contain `/invoice` OR `/order`
- Clear error message for invalid formats

### 3. Mark as Received Bug Fix
- Changed `req.user.userId` → `req.user.id`
- Added debug logging
- Authorization now works correctly

---

## 🧪 Test Commands

### Start Backend
```bash
cd backend
node server.js
```

### Start Frontend  
```bash
cd frontend
npm run dev
```

---

## ✅ Test Checklist

### Environment Variables
- [ ] API calls use `http://localhost:5000`
- [ ] Socket.io connects successfully
- [ ] No hardcoded URLs in console

### Invoice Validation
- [ ] `.pdf` URLs accepted
- [ ] `/order` URLs accepted
- [ ] `/invoice` URLs accepted
- [ ] Random URLs rejected
- [ ] Error message clear

### Mark as Received
- [ ] Button appears for `disbursed` status
- [ ] Confirmation dialog shows
- [ ] Deal changes to `completed`
- [ ] Success toast shows
- [ ] Cardholder notified
- [ ] No authorization error

---

## 🐛 Common Issues

**"Only the buyer can mark..."**
→ Fixed! Backend now uses `req.user.id`

**API calls fail**
→ Restart frontend dev server for `.env` changes

**Invoice validation too strict**
→ Add your URL pattern to validation logic

---

*All changes ready to test!* 🚀
