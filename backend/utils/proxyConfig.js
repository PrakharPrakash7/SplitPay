/**
 * Proxy Configuration for Scraping
 * 
 * For 400-500 concurrent users, you may need rotating proxies
 * to avoid IP bans from Flipkart/Amazon
 * 
 * FREE OPTIONS (Limited):
 * - Your own IP (current setup) - Good for <50 requests/day
 * 
 * PAID OPTIONS (Recommended for scale):
 * 1. ScrapingBee (https://www.scrapingbee.com/)
 *    - $49/month for 150k requests
 *    - Handles proxies, JS rendering, CAPTCHA
 * 
 * 2. BrightData (https://brightdata.com/)
 *    - Pay as you go
 *    - Residential proxies
 * 
 * 3. Oxylabs (https://oxylabs.io/)
 *    - Enterprise-grade
 *    - Good for large scale
 * 
 * To enable proxy support:
 * 1. Add to .env:
 *    PROXY_ENABLED=true
 *    PROXY_HOST=proxy.example.com
 *    PROXY_PORT=8080
 *    PROXY_USERNAME=your_username
 *    PROXY_PASSWORD=your_password
 * 
 * 2. Uncomment the proxy configuration in scrapeCache.js
 */

export function getProxyConfig() {
  if (process.env.PROXY_ENABLED !== 'true') {
    return null;
  }

  const config = {
    host: process.env.PROXY_HOST,
    port: parseInt(process.env.PROXY_PORT || '8080'),
  };

  // Add authentication if provided
  if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
    config.auth = {
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD
    };
  }

  return config;
}

// For rotating proxies (if you have a list)
const PROXY_LIST = [
  // Add your proxy list here
  // { host: 'proxy1.example.com', port: 8080 },
  // { host: 'proxy2.example.com', port: 8080 },
];

let proxyIndex = 0;

export function getRotatingProxy() {
  if (PROXY_LIST.length === 0) {
    return null;
  }

  const proxy = PROXY_LIST[proxyIndex];
  proxyIndex = (proxyIndex + 1) % PROXY_LIST.length;
  return proxy;
}

// ScrapingBee integration example
export function getScrapingBeeUrl(targetUrl) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    api_key: apiKey,
    url: targetUrl,
    render_js: 'false', // Set to true if you need JavaScript rendering
    premium_proxy: 'false', // Set to true for residential proxies
  });

  return `https://app.scrapingbee.com/api/v1/?${params.toString()}`;
}

export default {
  getProxyConfig,
  getRotatingProxy,
  getScrapingBeeUrl
};
