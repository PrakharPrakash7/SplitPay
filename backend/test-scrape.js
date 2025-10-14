import { fetchProduct } from './utils/scrapeCache.js';

const testUrl = 'https://www.flipkart.com/motorola-edge-60-pro-pantone-sparkling-grape-256-gb/p/itm72c35d843cd5f?pid=MOBH9C9JWM2Y5FZP';

console.log('🔍 Testing Flipkart scraping...\n');
console.log('URL:', testUrl);
console.log('\n' + '='.repeat(60) + '\n');

fetchProduct(testUrl)
  .then(product => {
    console.log('✅ SCRAPING RESULT:\n');
    console.log('Title:', product.title);
    console.log('Price: ₹' + product.price);
    console.log('Image:', product.image);
    console.log('\nBank Offers Found:', product.bankOffers.length);
    
    if (product.bankOffers.length > 0) {
      console.log('\n📌 Credit Card Offers:');
      product.bankOffers.forEach((offer, idx) => {
        console.log(`\n  ${idx + 1}. ${offer.bank} Bank`);
        console.log(`     Discount: ${offer.discount || 'N/A'}`);
        console.log(`     Card Type: ${offer.cardType}`);
        console.log(`     Details: ${offer.description.substring(0, 100)}...`);
      });
    } else {
      console.log('\n⚠️  No bank credit card offers found');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✓ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ SCRAPING FAILED:');
    console.error(error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  });
