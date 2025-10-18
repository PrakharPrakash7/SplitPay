import fs from 'fs';
import path from 'path';

const filePath = path.resolve('c:/Users/prakh/Desktop/SplitPay/backend/utils/scrapeCache.js');
const marker = '// Rate limiting: Track last request time per domain';

const sanitizedBlock = `const PLATFORM_KEYWORDS = [
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

  let title = rawTitle.replace(/\\s+/g, " ").trim();

  title = title.replace(/^(buy|shop|purchase)\\s+/i, "");
  title = title.replace(/\\b(at\\s+best\\s+price|best\\s+price|with offers?)\\b.*$/i, "");
  title = title.replace(/\\b(online shopping|online store)\\b.*$/i, "");
  title = title.replace(/\\s+online\\s*(?:-|:|\\||$).*/i, "");

  for (const keyword of PLATFORM_KEYWORDS) {
    const pattern = new RegExp("\\\\s*(?:\\\\||-|:)?\\\\s*(?:official\\\\s+store)?\\\\s*(?:on|at)?\\\\s*" + keyword + "(?:\\\\.com|\\\\.in)?\\\\s*$", "i");
    title = title.replace(pattern, "");
  }

  title = title.replace(/\\s*[:|-]\\s*(official store|online store).*/i, "");

  const firstWord = title.split(/\\s+/)[0] || "";
  if (firstWord) {
    const duplicateBrandPattern = new RegExp("\\\\s*-\\\\s*" + firstWord + "\\\\s*$", "i");
    title = title.replace(duplicateBrandPattern, "");
  }

  title = title.replace(/\\s*(?:\\||-|:)\\s*$/g, "");
  title = title.trim();

  return title || fallbackTitle;
}

`;

function ensureSanitizeBlock(fileData) {
  const markerIndex = fileData.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error('Marker not found in scrapeCache.js');
  }

  const beforeMarker = fileData.slice(0, markerIndex);
  const afterMarker = fileData.slice(markerIndex);

  const existingBlockStart = beforeMarker.indexOf('const PLATFORM_KEYWORDS');
  const prefix = existingBlockStart !== -1
    ? beforeMarker.slice(0, existingBlockStart)
    : beforeMarker;

  return prefix + sanitizedBlock + afterMarker;
}

function updateCleaningBlock(fileData) {
  const cleanTitleRegex = /title = title \|\| fallback\.title;[\s\S]*?\.trim\(\);\s*/;
  if (cleanTitleRegex.test(fileData)) {
    return fileData.replace(
      cleanTitleRegex,
      'title = sanitizeTitle(title || fallback.title, fallback.title);\n\n'
    );
  }

  const simpleFallbackRegex = /title = title \|\| fallback\.title;\s+/;
  if (simpleFallbackRegex.test(fileData) && !fileData.includes('sanitizeTitle(title || fallback.title')) {
    return fileData.replace(
      simpleFallbackRegex,
      'title = sanitizeTitle(title || fallback.title, fallback.title);\n\n'
    );
  }

  return fileData;
}

const originalData = fs.readFileSync(filePath, 'utf8');

let updatedData;
try {
  updatedData = ensureSanitizeBlock(originalData);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const finalData = updateCleaningBlock(updatedData);
fs.writeFileSync(filePath, finalData);
console.log('sanitizeTitle helper applied.');
