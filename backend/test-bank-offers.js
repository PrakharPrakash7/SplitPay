import { fetchProduct } from './utils/scrapeCache.js';

// Test with a Flipkart product URL
const testUrl = process.argv[2] || 'https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485c78f79';

console.log('🧪 Testing bank offer scraping...');
console.log('📦 Product URL:', testUrl);
console.log('─'.repeat(80));

const product = await fetchProduct(testUrl);

console.log('\n📊 SCRAPING RESULTS:');
console.log('─'.repeat(80));
console.log('Title:', product.title);
console.log('Price: ₹' + product.price);
console.log('Image:', product.image ? 'Found ✓' : 'Not found ✗');
console.log('\n🏦 Bank Offers:', product.bankOffers.length);
console.log('─'.repeat(80));

if (product.bankOffers.length > 0) {
  product.bankOffers.forEach((offer, idx) => {
    console.log(`\n${idx + 1}. ${offer.bank}`);
    console.log(`   Description: ${offer.description}`);
    console.log(`   Card Type: ${offer.cardType || 'N/A'}`);
    console.log(`   Discount Amount: ${offer.discountAmount ? '₹' + offer.discountAmount : 'N/A'}`);
    console.log(`   Discount Percent: ${offer.discountPercent ? offer.discountPercent + '%' : 'N/A'}`);
    console.log(`   Source: ${offer.source}`);
  });
} else {
  console.log('\n⚠️  No bank offers found');
}

console.log('\n' + '─'.repeat(80));
console.log('✅ Test complete\n');

process.exit(0);
