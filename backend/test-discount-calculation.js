// Test discount calculation logic

const testOffers = [
  {
    bank: 'HDFC',
    discount: '750',
    discountAmount: 750,
    description: 'Bank Offer Upto ₹750.00 discount on HDFC Bank Credit Cards'
  },
  {
    bank: 'ICICI',
    discount: '1574',
    discountAmount: 1574,
    description: 'Cashback Upto ₹1,574.00 cashback as Amazon Pay Balance'
  },
  {
    bank: 'AXIS',
    discount: '4000',
    discountAmount: 4000,
    description: 'Flat ₹4000 off on Axis Bank Credit Card'
  }
];

// Extract all discount amounts
const discounts = testOffers.map(offer => {
  if (offer.discountAmount && typeof offer.discountAmount === 'number') {
    return offer.discountAmount;
  } else if (offer.discount && typeof offer.discount === 'number') {
    return offer.discount;
  } else if (offer.discount && typeof offer.discount === 'string') {
    const discountMatch = offer.discount.match(/[₹\s]?([\d,]+)/);
    if (discountMatch) {
      return parseInt(discountMatch[1].replace(/,/g, ''));
    }
  }
  return 0;
}).filter(amount => amount > 0);

const totalBankDiscount = Math.max(...discounts);

console.log('📊 Bank Offers Analysis:');
console.log('─'.repeat(60));
testOffers.forEach((offer, idx) => {
  console.log(`${idx + 1}. ${offer.bank}: ₹${offer.discountAmount || offer.discount}`);
});
console.log('─'.repeat(60));
console.log(`\n💳 All Discounts Found: [${discounts.join(', ')}]`);
console.log(`🎯 Maximum Discount: ₹${totalBankDiscount}`);
console.log('─'.repeat(60));

// Calculate split
const buyerDiscount = Math.round(totalBankDiscount * 0.80);
const cardholderCommission = Math.round(totalBankDiscount * 0.15);
const platformFee = Math.round(totalBankDiscount * 0.05);

console.log('\n💰 Discount Split (80-15-5):');
console.log('─'.repeat(60));
console.log(`• Buyer Savings (80%):       ₹${buyerDiscount}`);
console.log(`• Cardholder Commission (15%): ₹${cardholderCommission}`);
console.log(`• Platform Fee (5%):         ₹${platformFee}`);
console.log(`• Total:                     ₹${buyerDiscount + cardholderCommission + platformFee}`);
console.log('─'.repeat(60));

// Test with example price
const originalPrice = 39999;
const discountedPrice = originalPrice - buyerDiscount;

console.log('\n🛒 Price Calculation:');
console.log('─'.repeat(60));
console.log(`• Original Price:    ₹${originalPrice}`);
console.log(`• Buyer Discount:    -₹${buyerDiscount}`);
console.log(`• Discounted Price:  ₹${discountedPrice}`);
console.log(`• You Pay:           ₹${discountedPrice}`);
console.log(`• You Save:          ₹${buyerDiscount} (${((buyerDiscount/originalPrice)*100).toFixed(1)}%)`);
console.log('─'.repeat(60));

console.log('\n✅ Calculation Test Complete\n');
