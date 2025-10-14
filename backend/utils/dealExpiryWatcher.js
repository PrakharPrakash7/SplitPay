import Deal from "../models/Deal.js";
import redisClient from "./redisClient.js";

export const monitorDealExpiry = async () => {
  const subscriber = redisClient.duplicate();
  await subscriber.connect();

  await subscriber.configSet("notify-keyspace-events", "Ex"); // enable expire events
  await subscriber.subscribe("__keyevent@0__:expired", async (key) => {
    if (key.startsWith("deal_expiry_")) {
      const dealId = key.split("deal_expiry_")[1];
      const deal = await Deal.findById(dealId);
      if (deal && deal.status === "pending") {
        deal.status = "expired";
        await deal.save();
        console.log(`⏰ Deal ${dealId} expired automatically`);
      }
    }
  });
};
