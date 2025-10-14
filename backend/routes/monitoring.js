import express from 'express';
import { scrapeQueue } from '../utils/scrapeQueue.js';
import redisClient from '../utils/redisClient.js';

const router = express.Router();

/**
 * GET /api/monitoring/scrape-status
 * Monitor scraping queue and cache health
 */
router.get('/scrape-status', async (req, res) => {
  try {
    const queueStatus = scrapeQueue.getStatus();
    
    // Check Redis cache stats
    let cacheStats = { connected: false };
    try {
      const info = await redisClient.info();
      cacheStats = {
        connected: true,
        keyCount: await redisClient.dbSize(),
        memory: 'Check Redis info'
      };
    } catch (e) {
      cacheStats.error = e.message;
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      scraping: {
        queueLength: queueStatus.queueLength,
        processing: queueStatus.processing,
        activeRequests: queueStatus.activeRequests,
        concurrentLimit: queueStatus.concurrentLimit,
        status: queueStatus.queueLength === 0 ? 'idle' : 'busy'
      },
      cache: cacheStats,
      recommendations: {
        queueHealth: queueStatus.queueLength > 10 ? 'HIGH_LOAD' : 'HEALTHY',
        suggestion: queueStatus.queueLength > 10 
          ? 'Consider increasing cache TTL or adding proxies'
          : 'System running smoothly'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring/clear-queue
 * Emergency endpoint to clear scraping queue
 */
router.post('/clear-queue', (req, res) => {
  try {
    scrapeQueue.clear();
    res.json({
      success: true,
      message: 'Scraping queue cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
