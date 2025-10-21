import { fetchProduct } from './utils/scrapeCache.js';

const testUrl = 'https://www.flipkart.com/truke-bass-h1-wired-earphones-w-type-c-jack-rich-bass-13mm-drivers-smart-controls/p/itm1dd8a30a193f1?pid=ACCHERZFFVHVFHMG';

console.log('🔍 Testing Truke product scraping...\n');
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
      console.log('\n📌 All Bank Offers:');
      product.bankOffers.forEach((offer, idx) => {
        console.log(`\n  ${idx + 1}. ${offer.bank}`);
        console.log(`     Card Type: ${offer.cardType}`);
        console.log(`     Discount: ₹${offer.discount || 'N/A'}`);
        console.log(`     Description: ${offer.description}`);
      });
    } else {
      console.log('\n⚠️  No bank offers found');
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
