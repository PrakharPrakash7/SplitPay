// backend/utils/redisClient.js
import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const client = createClient({ url });

client.on("error", (e) => console.error("Redis error", e));

await client.connect()
  .then(() => console.log("✓ Redis connected successfully"))
  .catch(e => console.warn("⚠ Redis connect failed:", e.message));

export default client;
