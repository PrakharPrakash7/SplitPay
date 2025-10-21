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

const SCRAPE_CACHE_VERSION = 8;
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

const OFFER_SIGNAL_REGEX = /(bank|debit card|credit card|emi card|insta emi|insta emi card|card offer|card transaction|card payment|card emi|card discount|cashback|no cost emi|special price|extra.*off)/i;

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
  if (normalized.includes("insta emi card")) {
    return "emi";
  }
  if (normalized.includes("emi card")) {
    return "emi";
  }
  if (normalized.includes("prepaid card")) {
    return "prepaid";
  }
  if (
    normalized.includes("card offer") ||
    normalized.includes("card transaction") ||
    normalized.includes("card payment") ||
    normalized.includes("card emi") ||
    normalized.includes("card discount")
  ) {
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

  let normalized = text.replace(/\s+/g, " ").trim();
  
  // Remove redundant "Bank Offer" prefix
  normalized = normalized.replace(/^Bank Offer/i, "").trim();
  
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

function processOfferText(rawText, banks, source, bankOffers) {
  if (!rawText) {
    return;
  }

  const offerText = rawText.replace(/\s+/g, " ").trim();
  if (!offerText || !OFFER_SIGNAL_REGEX.test(offerText)) {
    return;
  }

  const cardType = detectCardType(offerText);
  let bankName = null;

  for (const bank of banks) {
    const bankPattern = new RegExp(bank.replace(/\s+/g, "\\s+"), 'i');
    if (bankPattern.test(offerText)) {
      bankName = bank.toUpperCase();
      if (bankName === 'CITI') bankName = 'CITIBANK';
      if (bankName === 'AMEX') bankName = 'AMERICAN EXPRESS';
      break;
    }
  }

  if (!bankName && !cardType) {
    return;
  }

  const discountInfo = extractDiscountDetails(offerText);
  bankOffers.push({
    bank: bankName ? bankName : 'BANK OFFER',
    description: normalizeDescription(offerText),
    rawDescription: offerText,
    discount: discountInfo.amount !== null ? discountInfo.amount : null,
    discountAmount: discountInfo.amount,
    discountPercent: discountInfo.percent,
    cardType: cardType,
    source
  });
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
      const parsed = JSON.parse(cached);
      if (parsed && parsed.cacheVersion === SCRAPE_CACHE_VERSION) {
        return parsed;
      }
      console.log("⏩ Cache version mismatch, refreshing scrape data");
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
    const banks = [
      'HDFC',
      'ICICI',
      'SBI',
      'Axis',
      'Axis Bank',
      'Kotak',
      'HSBC',
      'Citi',
      'Citibank',
      'Standard Chartered',
      'IndusInd',
      'Yes Bank',
      'RBL',
      'American Express',
      'AMEX',
      'Bajaj',
      'Bajaj Finserv',
      'Flipkart Axis Bank'
    ];
    
    if (isAmazon) {
      // Amazon bank offers - look in promotions section
      $('#promoPriceBlockMessage_feature_div, #applicablePromotionList, .a-section.a-spacing-none, #vipBadge_feature_div, .a-box-inner').each((i, elem) => {
        processOfferText($(elem).text(), banks, 'amazon', bankOffers);
      });
      
      // Also check for offers in special divs
      $('.vip-badge-line1, .vip-badge-line2, .deal-badge-text').each((i, elem) => {
        processOfferText($(elem).text(), banks, 'amazon', bankOffers);
      });
    } else if (isFlipkart) {
      // Flipkart bank offers - multiple selector strategies
      
      // Strategy 1: Known offer container classes
      $('._2aZn7P, .row, ._3j4Zjq, ._16N0fY, .yN+eNk, ._3LxTgx').each((i, elem) => {
        processOfferText($(elem).text(), banks, 'flipkart', bankOffers);
      });
      
      // Strategy 2: Divs and sections containing bank/offer keywords
      $('div, section, span, p').each((i, elem) => {
        const $el = $(elem);
        const nodeText = $el.text().trim();
        
        if (!nodeText || nodeText.length < 25 || nodeText.length > 600) {
          return;
        }
        
        // Must start with known offer patterns
        if (!/^(bank offer|special price|no cost emi)/i.test(nodeText)) {
          return;
        }
        
        // Avoid nested duplicates - only process leaf-ish nodes
        const directText = $el.clone().children().remove().end().text().trim();
        if (directText.length < 10) {
          return; // This element is mostly children, skip it
        }
        
        processOfferText(nodeText, banks, 'flipkart', bankOffers);
      });
      
      // Strategy 3: List items mentioning bank offers
      $('li').each((i, elem) => {
        const nodeText = $(elem).text();
        if (!nodeText || nodeText.length < 25 || nodeText.length > 500) {
          return;
        }
        if (!/bank offer|no cost emi/i.test(nodeText)) {
          return;
        }
        processOfferText(nodeText, banks, 'flipkart', bankOffers);
      });
    }
    
    console.log(`Found ${bankOffers.length} bank and card offers before filtering`);

    const offerMap = new Map();
    for (const offer of bankOffers) {
      const key = `${offer.bank}|${offer.rawDescription || offer.description}`;
      if (!offerMap.has(key)) {
        offerMap.set(key, offer);
      }
    }

    const uniqueOffers = Array.from(offerMap.values());

    if (process.env.DEBUG_SCRAPE_OFFERS === 'true') {
      console.log('🟦 Offer candidates (all unique):', uniqueOffers.map(o => ({
        bank: o.bank,
        discountAmount: o.discountAmount,
        discountPercent: o.discountPercent,
        cardType: o.cardType,
        description: o.description
      })));
    }

    // Don't filter by price cap anymore - offers may have minimum purchase requirements
    // that make them valid even if discount exceeds product price
    const filteredOffers = uniqueOffers;

    console.log(
      `Bank offers collected: ${filteredOffers.length}`
    );
    
    const product = { 
      title, 
      image, 
      price: price || fallback.price, 
      url,
      bankOffers: filteredOffers.length > 0 ? filteredOffers : [],
      cacheVersion: SCRAPE_CACHE_VERSION
    };
    
    // Cache for 1 hour
    await redisClient.setEx(key, 3600, JSON.stringify(product));
    return product;
    
  } catch (err) {
    console.warn("scrape failed:", err.message);
    return fallback;
  }
}
