# 🔐 Admin Dashboard - Complete Guide

## 📊 Overview

The Admin Dashboard is a powerful interface for managing SplitPay orders and shipping approvals. It provides real-time visibility into all deals and allows instant shipping approval for testing.

---

## 🚀 Quick Start

### Access Admin Dashboard:

**URL:** `http://localhost:5173/admin`

**Default Credentials:**
- **Email:** `admin@splitpay.com`
- **Password:** `admin123`

> ⚠️ **Security Note:** Change these credentials in production by setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`

---

## ✨ Features

### 1. **📈 Real-time Statistics Dashboard**
- Total deals count
- Pending deals
- Orders placed (awaiting shipping approval)
- Shipped orders
- Completed deals

### 2. **📋 Complete Orders Table**
View all deals with:
- Product details with image
- Buyer information (name, email)
- Cardholder information (name, email)
- Product price
- Order status (color-coded badges)
- Order ID from e-commerce platform
- Action buttons

### 3. **🚚 One-Click Shipping Approval**
- Mark orders as "shipped" with single click
- Automatically captures payment from escrow
- Initiates payout to cardholder
- Updates deal status to "completed"
- Sends real-time notifications to buyer and cardholder

### 4. **🔄 Auto-Refresh**
- Dashboard refreshes every 30 seconds automatically
- Manual refresh button available
- Real-time status updates

### 5. **🎨 Status-Based Filtering**
Color-coded status badges for easy identification:
- 🟡 **Yellow** - Pending
- 🔵 **Blue** - Matched
- 🟢 **Green** - Payment Authorized
- 🟣 **Purple** - Address Shared
- 🟠 **Orange** - Order Placed (Action Required!)
- 🟦 **Teal** - Shipped
- 🟢 **Green (Dark)** - Completed

---

## 🗂️ Files Created

### Frontend:
1. **`frontend/src/pages/AdminLogin.jsx`** - Beautiful gradient login page
2. **`frontend/src/pages/AdminDashboard.jsx`** - Full-featured admin dashboard with table and stats

### Backend:
1. **`backend/routes/admin.js`** - Admin authentication routes
2. **`backend/routes/adminDashboard.js`** - Admin dashboard API endpoints
3. **`backend/server.js`** - Updated with admin routes

---

## 📡 API Endpoints

### Authentication:
```
POST /api/auth/admin/login
Body: { email, password }
Response: { token, user }
```

### Get All Deals:
```
GET /api/admin/deals
Headers: Authorization: Bearer <token>
Response: { deals: [...], count: 100 }
```

### Get Statistics:
```
GET /api/admin/stats
Headers: Authorization: Bearer <token>
Response: { stats: { deals: {...}, users: {...} } }
```

### Get Deal Details:
```
GET /api/admin/deals/:id
Headers: Authorization: Bearer <token>
Response: { deal: {...} }
```

### Mark as Shipped (uses existing endpoint):
```
POST /api/payment/admin/mark-shipped
Headers: Authorization: Bearer <token>
Body: { dealId: "..." }
Response: { success: true, message: "...", deal: {...} }
```

---

## 🎯 How to Use

### Step 1: Login
1. Go to `http://localhost:5173/admin`
2. Enter admin credentials
3. Click "🔓 Login as Admin"

### Step 2: View Dashboard
- See real-time statistics at the top
- Browse all orders in the table below
- Status colors help identify orders needing attention

### Step 3: Approve Shipping
1. Find order with status "ORDER PLACED" (orange badge)
2. Verify the order details
3. Click "🚚 Mark as Shipped" button
4. Confirm the action
5. Wait for success message

### Step 4: Verify Results
- Check backend console for logs
- Order status changes to "SHIPPED" then "COMPLETED"
- Payment is captured and payout initiated
- Buyer and cardholder receive notifications

---

## 🔒 Security Features

### Current Implementation:
- ✅ JWT-based authentication
- ✅ Token verification on all admin routes
- ✅ Secure login flow
- ✅ Protected routes with role checking

### Production Recommendations:
1. **Change default credentials:**
   ```bash
   # In backend/.env
   ADMIN_EMAIL=your-admin@email.com
   ADMIN_PASSWORD=your-secure-password
   ```

2. **Add admin role to database:**
   - Create admin user in MongoDB
   - Hash password with bcrypt
   - Set role: "admin"

3. **Add IP whitelist:**
   - Restrict admin access to specific IPs
   - Use middleware to check IP addresses

4. **Enable 2FA:**
   - Add two-factor authentication
   - Use OTP or authenticator apps

5. **Audit logging:**
   - Log all admin actions
   - Track who marked orders as shipped
   - Monitor login attempts

---

## 📊 Dashboard Views

### Empty State:
```
┌────────────────────────────────────────────┐
│  🔐 Admin Dashboard                         │
│  Manage orders and shipping approvals      │
├────────────────────────────────────────────┤
│  Stats: [0] [0] [0] [0] [0]                │
├────────────────────────────────────────────┤
│  📦 Orders Awaiting Shipping Approval      │
│                                             │
│  No deals found                             │
└────────────────────────────────────────────┘
```

### With Orders:
```
┌────────────────────────────────────────────┐
│  🔐 Admin Dashboard                         │
│  Manage orders and shipping approvals      │
├────────────────────────────────────────────┤
│  [Total: 15] [Pending: 3] [Placed: 5]     │
│  [Shipped: 4] [Completed: 3]               │
├────────────────────────────────────────────┤
│  📦 Orders Awaiting Shipping Approval      │
│                                             │
│  Product | Buyer | Cardholder | Price      │
│  ─────────────────────────────────────────  │
│  iPhone  | John  | Alice      | ₹50,000    │
│  Status: ORDER PLACED 🟠                    │
│  [🚚 Mark as Shipped]                       │
└────────────────────────────────────────────┘
```

---

## 🔄 Workflow Integration

### Complete Testing Flow:

```
1. Buyer creates deal
2. Cardholder accepts deal
3. Buyer pays via Razorpay
4. Buyer shares shipping address
5. Cardholder places order on e-commerce
6. Cardholder submits order ID
   
   👇 ORDER STATUS: "ORDER_PLACED"
   
7. ADMIN logs into dashboard
8. ADMIN sees order in table (orange badge)
9. ADMIN clicks "Mark as Shipped"
   
   👇 AUTOMATIC ACTIONS:
   
   • Order status → SHIPPED
   • Payment captured from escrow
   • Payout initiated to cardholder
   • Deal status → COMPLETED
   • Notifications sent to both parties
   
10. ✅ Flow complete!
```

---

## 💡 Tips & Best Practices

### For Testing:
1. **Keep admin dashboard open** in separate window
2. **Use auto-refresh** or click refresh button regularly
3. **Check backend console** for detailed logs
4. **Verify notifications** in buyer/cardholder dashboards

### For Production:
1. **Change admin credentials** immediately
2. **Implement proper admin user management**
3. **Add role-based access control** (RBAC)
4. **Enable audit logging** for all actions
5. **Set up monitoring alerts** for admin activities

---

## 🐛 Troubleshooting

### Issue: Cannot login
**Solutions:**
- Check backend is running: `http://localhost:5000`
- Verify credentials: `admin@splitpay.com` / `admin123`
- Check browser console for errors
- Clear localStorage and try again

### Issue: "Forbidden: Admin access required"
**Solutions:**
- Logout and login again
- Check JWT token in localStorage
- Verify role is set to "admin"

### Issue: Deals not loading
**Solutions:**
- Check MongoDB connection
- Verify deals exist in database
- Check browser Network tab for API errors
- Restart backend server

### Issue: "Mark as Shipped" fails
**Solutions:**
- Verify order status is "order_placed"
- Check Razorpay keys are valid
- Ensure payment was authorized
- Check backend console for detailed error

---

## 📸 Screenshots

### Login Page:
- Beautiful purple gradient background
- Clean, modern login form
- Secure admin access only message

### Dashboard:
- 5 statistics cards at top
- Full-width orders table
- Color-coded status badges
- Action buttons for each order
- Help section at bottom

---

## 🎊 Success Indicators

When shipping approval works correctly, you'll see:

**Backend Console:**
```
🚚 [ADMIN TEST] Order marked as shipped for deal xxxxx
💰 [ADMIN TEST] Capturing payment immediately
✅ [ADMIN TEST] Payment captured: ₹xxx
✅ Payout initiated for deal xxxxx: ₹xxx
```

**Admin Dashboard:**
- Status badge changes from orange to teal
- Button text changes to "✅ Shipped"
- Stats update automatically

**Buyer Dashboard:**
- Toast: "🚚 Order has been shipped!"
- Status: "COMPLETED" with green color

**Cardholder Dashboard:**
- Multiple toasts about payment and payout
- Stats updated (earnings increased)
- Deal marked complete

---

## 🚀 Future Enhancements

Potential features to add:

1. **Search & Filters:**
   - Search by buyer/cardholder name
   - Filter by status
   - Date range filtering

2. **Bulk Actions:**
   - Mark multiple orders as shipped
   - Export to CSV/Excel
   - Bulk status updates

3. **Analytics:**
   - Charts and graphs
   - Revenue tracking
   - Performance metrics

4. **Notifications:**
   - Email alerts for new orders
   - SMS notifications
   - Slack/Discord integration

5. **User Management:**
   - Multiple admin accounts
   - Permission levels
   - Activity history

6. **Refund Management:**
   - Handle disputes
   - Initiate refunds
   - Track refund status

---

## ✅ Checklist

Before going live:

- [ ] Change admin credentials
- [ ] Test login flow
- [ ] Verify all API endpoints work
- [ ] Test shipping approval process
- [ ] Check notifications are sent
- [ ] Verify payment capture works
- [ ] Test payout initiation
- [ ] Add IP whitelist (optional)
- [ ] Enable audit logging (optional)
- [ ] Set up monitoring alerts (optional)

---

## 📞 Support

For issues or questions:
1. Check this guide first
2. Review backend console logs
3. Check browser developer tools
4. Verify all services (MongoDB, Redis) are running
5. Test with sample data first

---

**Admin Dashboard is now ready for use! 🎉**

Access at: `http://localhost:5173/admin`

Default credentials:
- Email: `admin@splitpay.com`
- Password: `admin123`

Happy managing! 🚀
