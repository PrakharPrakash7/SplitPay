import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

// Load service account key from environment or JSON file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  fs.readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // optional
  });
}

export default admin;
