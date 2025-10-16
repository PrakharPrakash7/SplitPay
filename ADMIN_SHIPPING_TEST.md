# 🚚 Quick Testing Script - Mark Order as Shipped

## How to Use This Script

### Step 1: Get Your Details

**1. Get JWT Token:**
- Open browser console (F12)
- Type: `localStorage.getItem('token')`
- Copy the token value

**2. Get Deal ID:**
- Check browser console logs when you submit the order
- OR look at the deal details in the dashboard

---

## Windows PowerShell Commands:

### Option 1: PowerShell (Recommended for Windows)

```powershell
# Set your token and deal ID here
$token = "YOUR_JWT_TOKEN_HERE"
$dealId = "YOUR_DEAL_ID_HERE"

# Make the request
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}
$body = @{
    dealId = $dealId
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/payment/admin/mark-shipped" -Method POST -Headers $headers -Body $body
```

### Option 2: CMD (Using curl.exe)

```cmd
curl.exe -X POST http://localhost:5000/api/payment/admin/mark-shipped ^
-H "Content-Type: application/json" ^
-H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" ^
-d "{\"dealId\": \"YOUR_DEAL_ID_HERE\"}"
```

---

## Example with Real Values:

```powershell
# Example (replace with your actual values)
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3Mz..."
$dealId = "673a1b2c3d4e5f6789abcdef"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}
$body = @{
    dealId = $dealId
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/payment/admin/mark-shipped" -Method POST -Headers $headers -Body $body
```

---

## Expected Response:

### Success:
```json
{
  "success": true,
  "message": "✅ Order marked as shipped and payment captured successfully!",
  "deal": {
    "id": "673a1b2c3d4e5f6789abcdef",
    "status": "payment_captured",
    "escrowStatus": "captured",
    "shippedAt": "2025-10-16T10:30:00.000Z"
  }
}
```

### What Happens:
1. ✅ Order status → "SHIPPED"
2. ✅ Payment captured from escrow
3. ✅ Payout initiated to cardholder
4. ✅ Both dashboards receive real-time updates
5. ✅ Deal status → "COMPLETED"

---

## Troubleshooting:

### Error: "Cannot mark as shipped. Current status: address_shared"
**Problem:** Order hasn't been placed yet by cardholder
**Solution:** Complete step 3.6 first (cardholder must submit order ID)

### Error: "No token provided" or "Invalid token"
**Problem:** Token is wrong or expired
**Solution:** 
1. Logout and login again
2. Get fresh token from browser console

### Error: "Deal not found"
**Problem:** Wrong deal ID
**Solution:** 
1. Check browser console for deal ID logs
2. OR use MongoDB: `db.deals.find().pretty()` to see all deals

---

## Quick Debug:

**Check Deal Status in Browser Console:**
```javascript
// In browser console (F12)
fetch('http://localhost:5000/api/deals', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(data => console.table(data.deals.map(d => ({
  id: d._id,
  status: d.status,
  buyer: d.buyerId?.email,
  cardholder: d.cardholderId?.email
}))))
```

This shows all your deals with their current status!

---

## Testing Flow Summary:

1. ✅ Buyer creates deal
2. ✅ Cardholder accepts deal  
3. ✅ Buyer pays with Razorpay
4. ✅ Buyer shares shipping address
5. ✅ Cardholder submits order ID
6. **🚚 YOU ARE HERE** → Use admin endpoint to mark as shipped
7. ✅ Payment captured & payout initiated (automatic)
8. ✅ Deal completed!

---

## 🎉 Success Indicators:

After running the script, check:

**Backend Console:**
```
🚚 [ADMIN TEST] Order marked as shipped for deal xxxxx
💰 [ADMIN TEST] Capturing payment immediately
✅ [ADMIN TEST] Payment captured: ₹xxx
✅ Payout initiated for deal xxxxx
```

**Buyer Dashboard:**
- Status shows "COMPLETED" or "DISBURSED"
- Green success indicator
- Toast: "🚚 Order has been shipped!"

**Cardholder Dashboard:**
- Multiple toasts about payment capture and payout
- Deal marked as complete
- Stats updated (earnings increased)

---

## Alternative: Use REST Client Tools

If you prefer GUI tools:

**Postman / Thunder Client / Insomnia:**
```
POST http://localhost:5000/api/payment/admin/mark-shipped

Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_JWT_TOKEN

Body (JSON):
{
  "dealId": "YOUR_DEAL_ID"
}
```

---

**Need help?** Check TESTING_GUIDE.md section 3.7 for full details!
