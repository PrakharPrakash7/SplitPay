# Scraping Optimization & Best Practices

## 🎯 Overview
This document explains how SplitPay minimizes scraping impact and avoids IP bans when handling 400-500+ concurrent users.

## 🛡️ Current Implementation

### 1. **Redis Caching (1 Hour TTL)**
- **Purpose**: Avoid repeated scraping of the same product
- **Impact**: Reduces scraping by ~80-90% for popular products
- **Configuration**: `backend/utils/scrapeCache.js` - 3600 second cache

### 2. **Rate Limiting (5 Second Delay)**
- **Purpose**: Space out requests to avoid overwhelming servers
- **Implementation**: Per-domain tracking with 5-second minimum intervals
- **Configuration**: `RATE_LIMIT_DELAY = 5000` in `scrapeCache.js`

### 3. **User-Agent Rotation**
- **Purpose**: Mimic different browsers/devices
- **Implementation**: 7 different user agents rotated randomly
- **Browsers**: Chrome, Firefox, Safari, Edge on Windows/Mac/Linux

### 4. **Queue System**
- **Purpose**: Manage multiple concurrent scraping requests
- **Configuration**: 
  - Max 2 concurrent requests
  - 5 second delay between batches
  - Automatic queue management
- **File**: `backend/utils/scrapeQueue.js`

## 📊 Performance Metrics

### Without Optimization:
- 500 users creating deals = 500 immediate scrapes
- Risk of IP ban: **HIGH**
- Server response time: Poor (timeouts likely)

### With Current Optimization:
- 500 users creating deals = ~100 actual scrapes (80% cache hit)
- Scraping rate: 2 requests per 5 seconds = ~24 requests/minute
- Risk of IP ban: **LOW**
- Queue processing time: ~8 minutes for 100 requests

## 🔧 Configuration Guide

### Adjusting Rate Limits

**File**: `backend/utils/scrapeCache.js`
```javascript
const RATE_LIMIT_DELAY = 5000; // Change to 8000 for 8 seconds
```

### Adjusting Queue Settings

**File**: `backend/utils/scrapeQueue.js`
```javascript
export const scrapeQueue = new ScrapeQueue({
  concurrentLimit: 2,        // Increase to 3-4 for faster processing
  delayBetweenBatches: 5000  // Increase to 8000 for more caution
});
```

### Adjusting Cache Duration

**File**: `backend/utils/scrapeCache.js`
```javascript
await redisClient.setEx(key, 3600, JSON.stringify(product)); 
// Change 3600 to 7200 for 2 hours
```

## 🌐 Proxy Integration (For Scaling)

### When You Need Proxies:
- **50+ requests/day**: Consider free proxies
- **200+ requests/day**: Use paid rotating proxies
- **1000+ requests/day**: Essential (use services below)

### Recommended Proxy Services:

#### 1. **ScrapingBee** (Easiest)
- **Cost**: $49/month for 150k requests
- **Features**: Handles proxies, JS rendering, CAPTCHA
- **Setup**:
  ```bash
  npm install scrapingbee
  ```
  Add to `.env`:
  ```
  SCRAPINGBEE_API_KEY=your_api_key_here
  ```

#### 2. **BrightData** (Most Reliable)
- **Cost**: Pay as you go (~$0.001 per request)
- **Features**: Residential IPs, 99.9% uptime
- **Setup**: See `backend/utils/proxyConfig.js`

#### 3. **Oxylabs** (Enterprise)
- **Cost**: Contact for pricing
- **Features**: Premium residential proxies
- **Best for**: Large scale (10k+ requests/day)

### Enabling Proxy Support

**Option A: Simple Proxy**
Add to `.env`:
```
PROXY_ENABLED=true
PROXY_HOST=proxy.example.com
PROXY_PORT=8080
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password
```

**Option B: ScrapingBee**
Add to `.env`:
```
SCRAPINGBEE_API_KEY=your_api_key
```

Update `scrapeCache.js`:
```javascript
import { getScrapingBeeUrl } from './proxyConfig.js';

// In fetchProduct function:
const scrapingBeeUrl = getScrapingBeeUrl(url);
if (scrapingBeeUrl) {
  url = scrapingBeeUrl; // Use ScrapingBee endpoint
}
```

## 📈 Monitoring

### Check Scraping Health
```bash
# Via API
curl http://localhost:5000/api/monitoring/scrape-status
```

### Clear Queue (Emergency)
```bash
curl -X POST http://localhost:5000/api/monitoring/clear-queue
```

### Monitor Logs
Look for these indicators:
- ✅ `Product loaded from cache` = Good (no scraping)
- ⏱️ `Rate limiting: Waiting Xs` = Working correctly
- 📋 `Scrape request queued` = Queue system active
- ❌ `Scraping failed` = May need proxies

## 🚀 Scaling Recommendations

### For 50-100 Users/Day
- ✅ Current setup is perfect
- No proxies needed
- Keep cache at 1 hour

### For 100-500 Users/Day
- ✅ Current setup works
- Consider increasing cache to 2 hours
- Monitor for any IP blocks
- Have backup proxy service ready

### For 500-1000 Users/Day
- ⚠️ Proxies recommended
- Use ScrapingBee or BrightData
- Increase cache to 2-3 hours
- Consider queue priority system

### For 1000+ Users/Day
- ❗ Proxies required
- Use premium rotating proxies
- Implement fallback scraping services
- Consider API alternatives (if available)

## 🎓 Best Practices

### DO:
✅ Always check cache first  
✅ Use queue system for all scraping  
✅ Rotate user agents  
✅ Monitor scraping health regularly  
✅ Increase cache TTL during peak hours  
✅ Have error handling and fallbacks  

### DON'T:
❌ Scrape the same URL multiple times  
❌ Make parallel requests to same domain  
❌ Use static user agents  
❌ Ignore rate limits  
❌ Scrape during peak hours (if avoidable)  
❌ Store scraped data longer than needed  

## 🔍 Troubleshooting

### Issue: Getting Blocked/Banned
**Solution**: 
1. Increase `RATE_LIMIT_DELAY` to 8-10 seconds
2. Enable proxy rotation
3. Add more user agents
4. Check if you're hitting CAPTCHA

### Issue: Slow Queue Processing
**Solution**:
1. Increase cache TTL (less scraping needed)
2. Increase `concurrentLimit` (carefully)
3. Optimize scraping selectors
4. Use faster proxies

### Issue: Cache Misses
**Solution**:
1. Verify Redis is running
2. Check Redis memory limits
3. Increase cache TTL
4. Monitor cache hit rate

## 📞 Support

For issues or questions:
1. Check monitoring endpoint: `/api/monitoring/scrape-status`
2. Review logs for error patterns
3. Test with `backend/test-scrape.js`
4. Consider proxy services if scaling

## 🔄 Version History

- **v1.0** (Current): Basic rate limiting + queue system
- **v2.0** (Future): Proxy rotation + priority queue
- **v3.0** (Future): Machine learning for optimal scraping times
