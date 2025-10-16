# 💳 Razorpay Test Mode - Payment Credentials

## 🎯 Quick Reference for Testing

### ✅ **BEST METHOD: Test Card (Always Works)**

```
Card Number: 4111 1111 1111 1111
CVV:         123
Expiry:      12/25 (any future date)
Cardholder:  Any name
```

**Result:** ✅ Payment Success

---

### 🔸 **Alternative: Test Card with 3D Secure**

```
Card Number: 4000 0027 6000 0016
CVV:         123
Expiry:      12/25
OTP:         Any 6-digit number (e.g., 123456)
```

**Result:** ✅ Payment Success after OTP

---

### 📱 **UPI/VPA Testing** (if option appears)

**Success:**
```
VPA: success@razorpay
```

**Failure:**
```
VPA: failure@razorpay
```

**Note:** In Razorpay test mode, UPI might not always be visible. This is normal. Use the test card method instead.

---

### 🏦 **Netbanking Testing** (if option appears)

```
Select: Any test bank
Username: test
Password: test
```

---

### 💰 **Wallet Testing** (if option appears)

- Select any wallet (Paytm, PhonePe, etc.)
- All wallet payments are simulated in test mode

---

## 🚫 **Testing Failures**

### **Card Decline:**
```
Card Number: 4000 0000 0000 0002
CVV:         123
Expiry:      12/25
```
**Result:** ❌ Card Declined

### **Insufficient Funds:**
```
Card Number: 4000 0000 0000 9995
CVV:         123
Expiry:      12/25
```
**Result:** ❌ Insufficient Funds

---

## ⚠️ **Important Notes**

1. **UPI in Test Mode:**
   - UPI option may NOT appear in test mode for some accounts
   - This is a Razorpay limitation, not an app issue
   - ✅ **Solution:** Use the test card method (works 100% of the time)

2. **No Real Money:**
   - All test mode payments are FREE
   - No real money is charged
   - No bank account is needed

3. **Test Keys Required:**
   - Make sure you have valid Razorpay test keys
   - Keys should start with `rzp_test_`

4. **Payment Flow:**
   ```
   Click "Pay Now" 
   → Razorpay modal opens 
   → Select "Card" 
   → Enter test card details 
   → Click "Pay" 
   → ✅ Payment successful!
   ```

---

## 🔗 **More Test Cards**

| Purpose | Card Number | Result |
|---------|-------------|--------|
| Success | 4111 1111 1111 1111 | ✅ Success |
| Success (Visa) | 4012 8888 8888 1881 | ✅ Success |
| Success (Mastercard) | 5555 5555 5555 4444 | ✅ Success |
| Decline | 4000 0000 0000 0002 | ❌ Declined |
| Insufficient Funds | 4000 0000 0000 9995 | ❌ Insufficient |

---

## 📚 **Official Razorpay Docs**

More test credentials: https://razorpay.com/docs/payments/payments/test-card-details/

---

## 🎉 **Testing Tips**

1. **Keep it simple:** Just use `4111 1111 1111 1111` - it works every time!
2. **Any CVV works:** 123, 456, 789 - doesn't matter in test mode
3. **Any future expiry:** 12/25, 01/26, 05/30 - all work
4. **Any name:** "Test User", "John Doe", or even "asdf" - all work

---

## ✅ **Your Current Setup**

- ✅ Backend server running on port 5000
- ✅ Razorpay keys loaded correctly
- ✅ Pay Now button working
- ✅ Razorpay modal opening
- ✅ All payment methods configured

**You're ready to test!** 🚀

Just use the **test card: 4111 1111 1111 1111** and you're good to go!
