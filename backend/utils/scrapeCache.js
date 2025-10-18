import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import redisClient from "./redisClient.js";

const fallback = { 
  title: "Mock Product", 
  image: "https://via.placeholder.com/300", 
  price: 999, 
  url: "https://example.com/mock",
  bankOffers: []
};

const PLATFORM_KEYWORDS = [
  "amazon",
  "flipkart",
  "myntra",
  "ajio",
  "meesho",
  "tatacliq",
  "croma",
  "reliance digital"
];

function sanitizeTitle(rawTitle, fallbackTitle = "") {
  if (!rawTitle || typeof rawTitle !== "string") {
    return fallbackTitle;
  }

  let title = rawTitle.replace(/\s+/g, " ").trim();

  title = title.replace(/^(buy|shop|purchase)\s+/i, "");
  title = title.replace(/\b(at\s+best\s+price|best\s+price|with offers?)\b.*$/i, "");
  title = title.replace(/\b(online shopping|online store)\b.*$/i, "");
  title = title.replace(/\s+online\s*(?:-|:|\||$).*/i, "");

  for (const keyword of PLATFORM_KEYWORDS) {
    const pattern = new RegExp("\\s*(?:\\||-|:)?\\s*(?:official\\s+store)?\\s*(?:on|at)?\\s*" + keyword + "(?:\\.com|\\.in)?\\s*$", "i");
    title = title.replace(pattern, "");
  }

  title = title.replace(/\s*[:|-]\s*(official store|online store).*/i, "");

  const firstWord = title.split(/\s+/)[0] || "";
  if (firstWord) {
    const duplicateBrandPattern = new RegExp("\\s*-\\s*" + firstWord + "\\s*$", "i");
    title = title.replace(duplicateBrandPattern, "");
  }

  title = title.replace(/\s*(?:\||-|:)\s*$/g, "");
  title = title.trim();

  return title || fallbackTitle;
}

function detectCardType(offerText) {
  if (!offerText) {
    return null;
  }

  const normalized = offerText.toLowerCase();

  if (normalized.includes("debit card")) {
    return "debit";
  }
  if (normalized.includes("credit card")) {
    return "credit";
  }
  if (normalized.includes("emi card")) {
    return "emi";
  }
  if (normalized.includes("prepaid card")) {
    return "prepaid";
  }
  if (normalized.includes("card")) {
    return "card";
  }
  return null;
}

function extractDiscountDetails(offerText) {
  if (!offerText) {
    return { amount: null, percent: null };
  }

  const compactText = offerText.replace(/\s+/g, " ");
  const amountMatch = compactText.match(/₹\s*([\d,]+)/i);
  const percentMatch = compactText.match(/(\d+)\s*%/i);

  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : null;
  const percent = percentMatch ? parseFloat(percentMatch[1]) : null;

  return { amount: Number.isFinite(amount) ? amount : null, percent: Number.isFinite(percent) ? percent : null };
}

function normalizeDescription(text, maxLength = 280) {
  if (!text) {
    return "";
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

// Rate limiting: Track last request time per domain
const domainLastRequest = new Map();
const RATE_LIMIT_DELAY = 5000; // 5 seconds between requests to same domain

// User-Agent rotation to mimic different browsers
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0'
];

function urlHash(url) {
  return crypto.createHash("sha1").update(url).digest("hex");
}

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return 'unknown';
  }
}

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function rateLimitDelay(domain) {
  const lastRequest = domainLastRequest.get(domain);
  if (lastRequest) {
    const timeSinceLastRequest = Date.now() - lastRequest;
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      const delayNeeded = RATE_LIMIT_DELAY - timeSinceLastRequest;
      console.log(`⏱️  Rate limiting: Waiting ${Math.round(delayNeeded / 1000)}s before scraping ${domain}`);
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
  }
  domainLastRequest.set(domain, Date.now());
}

export async function fetchProduct(url) {
  const key = `product:${urlHash(url)}`;
  
  // Try cache first - avoid scraping if we have recent data
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      console.log("✓ Product loaded from cache (no scraping needed)");
      return JSON.parse(cached);
    }
  } catch (e) { 
    console.warn("redis get failed", e.message); 
  }

  // Apply rate limiting before scraping
  const domain = getDomain(url);
  await rateLimitDelay(domain);

  // Fetch and scrape
  try {
    const userAgent = getRandomUserAgent();
    console.log(`🌐 Scraping ${domain} with rate limit...`);
    
    const { data: html } = await axios.get(url, { 
      headers: { 
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      }, 
      timeout: 15000 // Increased timeout for reliability
    });
    
    const $ = cheerio.load(html);
    
    // Detect platform
    const isAmazon = url.includes('amazon');
    const isFlipkart = url.includes('flipkart');
    
    // Extract title
    let title = $('meta[property="og:title"]').attr('content') 
      || $('title').text().trim();
    
    if (isAmazon) {
      title = title || $('#productTitle').text().trim() 
        || $('h1.a-size-large').text().trim();
    } else if (isFlipkart) {
      title = title || $('span.VU-ZEz').text().trim() 
        || $('h1.yhB1nd').text().trim();
    }
    
    title = sanitizeTitle(title || fallback.title, fallback.title);

    // Extract image
    let image = $('meta[property="og:image"]').attr('content');
    
    if (!image && isAmazon) {
      image = $('#landingImage').attr('data-old-hires')
        || $('#landingImage').attr('src') 
        || $('#imgBlkFront').attr('src')
        || $('.a-dynamic-image').first().attr('data-old-hires')
        || $('.a-dynamic-image').first().attr('src')
        || $('img[data-a-image-name="landingImage"]').attr('src');
    } else if (!image && isFlipkart) {
      image = $('._53J4C-._3kHy7B img').attr('src')
        || $('._396cs4._2amPTt img').attr('src');
    }
    
    image = image || fallback.image;
    
    console.log(`Extracted image: ${image ? 'Found' : 'Using fallback'}`);
    
    // Extract price - Try platform-specific selectors first
    let price = null;
    
    if (isAmazon) {
      // Amazon India specific selectors
      const amazonSelectors = [
        '.a-price-whole',              // Current Amazon price
        '#priceblock_ourprice',        // Our price
        '#priceblock_dealprice',       // Deal price
        '.a-price .a-offscreen',       // Screen reader price
        '#corePriceDisplay_desktop_feature_div .a-price-whole',
        '.priceToPay .a-price-whole'   // New Amazon layout
      ];
      
      for (const selector of amazonSelectors) {
        const priceText = $(selector).first().text().trim();
        if (priceText) {
          console.log(`Found price with selector "${selector}": ${priceText}`);
          const num = priceText.replace(/[^\d.]/g, '');
          if (num) {
            price = parseFloat(num.replace(/,/g, ''));
            if (price > 0) {
              // Fix: Sometimes Amazon shows price twice (e.g., "24999.24999")
              const priceStr = price.toString();
              if (priceStr.includes('.') && priceStr.split('.')[1].length > 2) {
                // Likely duplicate, take first part
                price = Math.floor(price);
              }
              break;
            }
          }
        }
      }
    } else if (isFlipkart) {
      // Flipkart specific selectors
      const flipkartPriceSelectors = [
        '.Nx9bqj.CxhGGd',              // Current Flipkart price class
        '._30jeq3._16Jk6d',            // Older Flipkart price
        '.CEmiEU div',                  // Alternative
        '[data-test-id="selling-price"]'
      ];
      
      for (const selector of flipkartPriceSelectors) {
        const priceText = $(selector).first().text().trim();
        if (priceText) {
          console.log(`Found price with selector "${selector}": ${priceText}`);
          const num = priceText.replace(/[^\d.]/g, '');
          if (num) {
            price = parseFloat(num.replace(/,/g, ''));
            if (price > 0) break;
          }
        }
      }
    }
    
    // Regex fallback for price
    if (!price) {
      const match = html.match(/₹\s?([\d,]+(\.\d+)?)/) || html.match(/INR\s?([\d,]+(\.\d+)?)/);
      if (match) price = parseFloat(match[1].replace(/,/g, ''));
    }
    
    console.log(`Extracted price: ₹${price || 'not found'}`);
    
    // Extract bank offers (credit card specific)
    const bankOffers = [];
    const banks = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'HSBC', 'Citi', 'Citibank', 'Standard Chartered', 'IndusInd', 'Yes Bank', 'RBL', 'American Express', 'AMEX'];
    
    if (isAmazon) {
      // Amazon bank offers - look in promotions section
      $('#promoPriceBlockMessage_feature_div, #applicablePromotionList, .a-section.a-spacing-none, #vipBadge_feature_div, .a-box-inner').each((i, elem) => {
        const offerText = $(elem).text().trim();
        
        // Check if it's a bank offer with credit card
        if (offerText.match(/bank|credit card|card offer|instant discount|cashback/i)) {
          let bankName = null;
          
          for (const bank of banks) {
            if (offerText.match(new RegExp(bank, 'i'))) {
              bankName = bank.toUpperCase();
              if (bankName === 'CITI') bankName = 'CITIBANK';
              if (bankName === 'AMEX') bankName = 'AMERICAN EXPRESS';
              break;
            }
          }
          
          // Extract discount amount or percentage
          const discountMatch = offerText.match(/₹\s?([\d,]+)|(\d+)%\s*off|(\d+)%\s*instant|(\d+)%\s*cashback/i);
          const discount = discountMatch ? (discountMatch[1] || discountMatch[2] || discountMatch[3] || discountMatch[4]) : null;
          
          // Only add if it mentions credit card or card
          if (bankName && offerText.match(/credit card|card|instant|cashback/i)) {
            // Avoid duplicates - check if similar offer already exists
            const isDuplicate = bankOffers.find(o => 
              o.bank === bankName && 
              (o.discount === discount || Math.abs(o.description.length - offerText.length) < 20)
            );
            
            if (!isDuplicate) {
              bankOffers.push({
                bank: bankName,
                description: offerText.substring(0, 200),
                discount: discount,
                cardType: 'credit'
              });
            }
          }
        }
      });
      
      // Also check for offers in special divs
      $('.vip-badge-line1, .vip-badge-line2, .deal-badge-text').each((i, elem) => {
        const offerText = $(elem).text().trim();
        if (offerText.length > 10) {
          for (const bank of banks) {
            if (offerText.match(new RegExp(bank, 'i'))) {
              let bankName = bank.toUpperCase();
              if (bankName === 'CITI') bankName = 'CITIBANK';
              if (bankName === 'AMEX') bankName = 'AMERICAN EXPRESS';
              
              const discountMatch = offerText.match(/₹\s?([\d,]+)|(\d+)%/i);
              const discount = discountMatch ? (discountMatch[1] || discountMatch[2]) : null;
              
              if (!bankOffers.find(o => o.bank === bankName)) {
                bankOffers.push({
                  bank: bankName,
                  description: offerText.substring(0, 200),
                  discount: discount,
                  cardType: 'credit'
                });
              }
              break;
            }
          }
        }
      });
    } else if (isFlipkart) {
      // Flipkart bank offers
      $('._2aZn7P, .row, ._3j4Zjq').each((i, elem) => {
        const offerText = $(elem).text().trim();
        
        // Check if it's a bank offer with credit card
        if (offerText.match(/bank|credit card|card offer/i)) {
          let bankName = null;
          
          for (const bank of banks) {
            if (offerText.match(new RegExp(bank, 'i'))) {
              bankName = bank.toUpperCase();
              break;
            }
          }
          
          // Extract discount amount or percentage
          const discountMatch = offerText.match(/₹\s?([\d,]+)|(\d+)%\s*off/i);
          const discount = discountMatch ? (discountMatch[1] || discountMatch[2]) : null;
          
          // Only add if it mentions credit card
          if (bankName && offerText.match(/credit card/i)) {
            bankOffers.push({
              bank: bankName,
              description: offerText.substring(0, 200),
              discount: discount,
              cardType: 'credit'
            });
          }
        }
      });
    }
    
    console.log(`Found ${bankOffers.length} bank credit card offers (before deduplication)`);
    
    // Deduplicate offers - keep only the best offer per bank
    const uniqueOffers = [];
    const bankMap = new Map();
    
    for (const offer of bankOffers) {
      const existing = bankMap.get(offer.bank);
      if (!existing) {
        bankMap.set(offer.bank, offer);
      } else {
        // Keep the offer with higher discount
        const existingDiscount = parseFloat((existing.discount || '0').toString().replace(/,/g, ''));
        const currentDiscount = parseFloat((offer.discount || '0').toString().replace(/,/g, ''));
        
        if (currentDiscount > existingDiscount) {
          bankMap.set(offer.bank, offer);
        }
      }
    }
    
    bankMap.forEach(offer => uniqueOffers.push(offer));
    
    console.log(`Deduplicated to ${uniqueOffers.length} unique bank offers`);
    
    const product = { 
      title, 
      image, 
      price: price || fallback.price, 
      url,
      bankOffers: uniqueOffers.length > 0 ? uniqueOffers : []
    };
    
    // Cache for 1 hour
    await redisClient.setEx(key, 3600, JSON.stringify(product));
    return product;
    
  } catch (err) {
    console.warn("scrape failed:", err.message);
    return fallback;
  }
}
