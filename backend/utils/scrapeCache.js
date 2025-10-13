import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import redisClient from "./redisClient.js"; // see next snippet

const fallback = { title: "Mock Product", image: "https://via.placeholder.com/300", price: 999, url: "https://example.com/mock" };

function urlHash(url) {
  return crypto.createHash("sha1").update(url).digest("hex");
}

export async function fetchProduct(url) {
  const key = `product:${urlHash(url)}`;
  // try cache
  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  } catch (e) { console.warn("redis get failed", e.message); }

  // fetch + scrape
  try {
    const { data: html } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 8000 });
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || fallback.title;
    const image = $('meta[property="og:image"]').attr('content') || fallback.image;
    // price heuristics
    let price = null;
    const selectors = ['#priceblock_ourprice', '#priceblock_dealprice', '.price', '._30jeq3._16Jk6d'];
    for (const s of selectors) {
      const txt = $(s).text() || $(s).attr('content');
      if (txt) {
        const num = txt.replace(/[^\d.]/g, '');
        if (num) { price = parseFloat(num.replace(/,/g,'')); break; }
      }
    }
    if (!price) {
      const match = html.match(/₹\s?([\d,]+(\.\d+)?)/) || html.match(/INR\s?([\d,]+(\.\d+)?)/);
      if (match) price = parseFloat(match[1].replace(/,/g,''));
    }
    const product = { title, image, price: price || fallback.price, url };
    // cache for 1 hour
    await redisClient.setEx(key, 3600, JSON.stringify(product));
    return product;
  } catch (err) {
    console.warn("scrape failed:", err.message);
    return fallback;
  }
}
