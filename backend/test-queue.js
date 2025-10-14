import { queueScrapeRequest, scrapeQueue } from './utils/scrapeQueue.js';

console.log('🧪 Testing Queue System with Multiple Concurrent Requests\n');
console.log('Simulating 5 users creating deals at the same time...\n');

const testUrls = [
  'https://www.flipkart.com/motorola-edge-60-pro-pantone-sparkling-grape-256-gb/p/itm72c35d843cd5f?pid=MOBH9C9JWM2Y5FZP',
  'https://www.flipkart.com/samsung-galaxy-s23-ultra/p/test1',
  'https://www.flipkart.com/iphone-15-pro/p/test2',
  'https://www.flipkart.com/oneplus-12/p/test3',
  'https://www.flipkart.com/pixel-8-pro/p/test4'
];

console.log('📊 Initial Queue Status:', scrapeQueue.getStatus());
console.log('\n' + '='.repeat(70) + '\n');

// Simulate 5 concurrent requests
const startTime = Date.now();
const promises = testUrls.map((url, index) => {
  console.log(`User ${index + 1} requesting: ${url.split('/').slice(-2)[0]}`);
  return queueScrapeRequest(url)
    .then(product => {
      console.log(`\n✅ User ${index + 1} received result:`);
      console.log(`   Title: ${product.title.substring(0, 50)}...`);
      console.log(`   Price: ₹${product.price}`);
      console.log(`   Bank Offers: ${product.bankOffers.length}`);
      return product;
    })
    .catch(error => {
      console.log(`\n❌ User ${index + 1} error: ${error.message}`);
    });
});

console.log('\n' + '='.repeat(70) + '\n');

Promise.all(promises)
  .then(() => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(70));
    console.log(`\n✅ All requests processed in ${duration} seconds`);
    console.log('\n📊 Final Queue Status:', scrapeQueue.getStatus());
    console.log('\n💡 Notice:');
    console.log('   - Requests were queued and processed in batches');
    console.log('   - Rate limiting applied between requests');
    console.log('   - User-agent rotated for each request');
    console.log('   - Cache utilized where possible');
    console.log('\n✨ This prevents overwhelming target servers!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
