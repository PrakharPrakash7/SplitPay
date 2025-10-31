// Razorpay Payment Gateway Test Script
// Run this in browser console on the payment page

console.log('🧪 Running Razorpay Payment Gateway Tests...\n');

// Test 1: Check if Razorpay script is loaded
console.log('Test 1: Razorpay Script Loading');
if (typeof window.Razorpay !== 'undefined') {
  console.log('✅ PASS: Razorpay script loaded successfully');
} else {
  console.error('❌ FAIL: Razorpay script not loaded');
  console.log('💡 Fix: Check if https://checkout.razorpay.com/v1/checkout.js is accessible');
}

// Test 2: Check localStorage for auth token
console.log('\nTest 2: Authentication Token');
const buyerToken = localStorage.getItem('buyer_token');
const cardholderToken = localStorage.getItem('cardholder_token');

if (buyerToken || cardholderToken) {
  console.log('✅ PASS: Auth token found');
  console.log('Token type:', buyerToken ? 'buyer' : 'cardholder');
} else {
  console.error('❌ FAIL: No auth token found');
  console.log('💡 Fix: Please login again');
}

// Test 3: Check API endpoint accessibility
console.log('\nTest 3: Backend API Connectivity');
fetch('http://localhost:5000/')
  .then(res => res.text())
  .then(text => {
    if (text.includes('SplitPay Backend Running')) {
      console.log('✅ PASS: Backend server is running');
    } else {
      console.warn('⚠️ WARNING: Unexpected backend response');
    }
  })
  .catch(err => {
    console.error('❌ FAIL: Cannot connect to backend');
    console.log('💡 Fix: Start backend server with `npm run dev`');
    console.error('Error:', err.message);
  });

// Test 4: Check if payment button exists
console.log('\nTest 4: Payment Button Presence');
const payButtons = document.querySelectorAll('button');
const paymentButtons = Array.from(payButtons).filter(btn => 
  btn.textContent.includes('Pay') || btn.textContent.includes('Retry')
);

if (paymentButtons.length > 0) {
  console.log('✅ PASS: Payment button(s) found:', paymentButtons.length);
  paymentButtons.forEach((btn, i) => {
    console.log(`  Button ${i + 1}: "${btn.textContent.trim()}"`);
  });
} else {
  console.warn('⚠️ WARNING: No payment buttons found on page');
  console.log('💡 Note: This is normal if deal status is not matched/awaiting_payment');
}

// Test 5: Console errors check
console.log('\nTest 5: Console Error Check');
const errorCount = performance.getEntriesByType('resource')
  .filter(r => r.name.includes('razorpay') && r.duration === 0).length;

if (errorCount === 0) {
  console.log('✅ PASS: No Razorpay resource loading errors');
} else {
  console.error('❌ FAIL: Razorpay script failed to load');
  console.log('💡 Fix: Check network tab, disable ad blockers');
}

// Test 6: Environment check
console.log('\nTest 6: Environment Variables');
console.log('API Base URL:', 'http://localhost:5000');
console.log('Frontend URL:', window.location.origin);

if (window.location.origin === 'http://localhost:5173') {
  console.log('✅ PASS: Running on correct port');
} else {
  console.warn('⚠️ WARNING: Frontend may not be on default port');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log('Run this test before attempting payment.');
console.log('All tests should PASS for successful payment flow.');
console.log('\n💡 Test Cards for Razorpay Test Mode:');
console.log('   Success: 4111 1111 1111 1111');
console.log('   Failure: 4000 0000 0000 0002');
console.log('   CVV: Any 3 digits');
console.log('   Expiry: Any future date');
console.log('='.repeat(60));
