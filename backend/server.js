import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

//import authRoutes from "./routes/auth.js"; // we will create next

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Routes
// app.use("/api/auth", authRoutes);

app.get("/", (req, res) => res.send("SplitPay Backend Running ✅"));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
