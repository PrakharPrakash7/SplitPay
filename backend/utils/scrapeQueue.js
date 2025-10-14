import { fetchProduct } from './scrapeCache.js';

/**
 * Queue system for scraping requests
 * Handles multiple concurrent users by staggering requests
 * Prevents overwhelming target servers
 */
class ScrapeQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.concurrentLimit = options.concurrentLimit || 2; // Max 2 concurrent requests
    this.delayBetweenBatches = options.delayBetweenBatches || 3000; // 3 seconds between batches
    this.activeRequests = 0;
  }

  /**
   * Add a scraping request to the queue
   * Returns a promise that resolves when scraping is complete
   */
  async add(url) {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject, addedAt: Date.now() });
      
      // Log queue status
      const waitTime = this.queue.length * (this.delayBetweenBatches / 1000);
      console.log(`📋 Scrape request queued. Position: ${this.queue.length}, Est. wait: ~${Math.round(waitTime)}s`);
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued scraping requests
   */
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Process up to concurrentLimit requests at once
      const batch = this.queue.splice(0, this.concurrentLimit);
      
      console.log(`\n🔄 Processing batch of ${batch.length} scrape request(s)...`);
      
      // Process batch concurrently
      const promises = batch.map(async (item) => {
        try {
          this.activeRequests++;
          const result = await fetchProduct(item.url);
          item.resolve(result);
        } catch (error) {
          console.error(`❌ Scraping failed for ${item.url}:`, error.message);
          item.reject(error);
        } finally {
          this.activeRequests--;
        }
      });

      await Promise.all(promises);

      // Delay between batches to avoid overwhelming servers
      if (this.queue.length > 0) {
        console.log(`⏸️  Pausing ${this.delayBetweenBatches / 1000}s before next batch (${this.queue.length} requests remaining)...`);
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }

    this.processing = false;
    console.log('✅ Queue processing complete\n');
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      activeRequests: this.activeRequests,
      concurrentLimit: this.concurrentLimit
    };
  }

  /**
   * Clear all pending requests
   */
  clear() {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    console.log('🗑️  Queue cleared');
  }
}

// Export singleton instance
export const scrapeQueue = new ScrapeQueue({
  concurrentLimit: 2,        // Process 2 URLs at a time
  delayBetweenBatches: 5000  // 5 seconds between batches
});

// Export convenience method
export async function queueScrapeRequest(url) {
  return scrapeQueue.add(url);
}

export default scrapeQueue;
