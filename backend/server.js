import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import authRoutes from "./routes/auth.js";
import buyerRoutes from "./routes/buyer.js";
import dealRoutes from "./routes/deal.js";
import { monitorDealExpiry } from "./utils/dealExpiryWatcher.js";
import { startExpiryChecker } from "./utils/dealExpiryChecker.js";
import userRoutes from "./routes/user.js";
import monitoringRoutes from "./routes/monitoring.js";
import adminDashboardRoutes from "./routes/adminDashboard.js";
import paymentRoutes from "./routes/payment.js";
import chatRoutes from "./routes/chat.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Export io for use in other files
export { io };

// Make io available to routes
app.set('io', io);

app.use(cors());
app.use(express.json());

// Serve uploaded files (invoices) with CORS headers
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    // Set proper content type for PDF files
    if (path.endsWith('.pdf')) {
      res.set('Content-Type', 'application/pdf');
    }
  }
}));

monitorDealExpiry();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/buyer", buyerRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/users", userRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => res.send("SplitPay Backend Running ✅"));

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Verify JWT token from socket handshake
  const token = socket.handshake.auth.token;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      console.log(`✅ Authenticated: User ${decoded.id} (${decoded.role})`);
    } catch (error) {
      console.error("❌ Socket auth error:", error.message);
    }
  }

  // Join room based on user role
  socket.on("joinBuyers", () => {
    socket.join("buyers");
    //console.log(`👤 ${socket.id} joined buyers room`);
  });

  socket.on("joinCardholders", () => {
    socket.join("cardholders");
    //console.log(`💳 ${socket.id} joined cardholders room`);
  });

  socket.on("joinAdmins", () => {
    socket.join("admins");
    //console.log(`🔐 ${socket.id} joined admins room`);
  });

  // Chat room management
  socket.on("join-chat-room", (dealId) => {
    socket.join(`chat-${dealId}`);
   // console.log(`💬 ${socket.id} joined chat room for deal: ${dealId}`);
  });

  socket.on("leave-chat-room", (dealId) => {
    socket.leave(`chat-${dealId}`);
    //console.log(`💬 ${socket.id} left chat room for deal: ${dealId}`);
  });

  // Real-time chat messaging
  socket.on("send-message", (data) => {
    const { dealId, message, senderId, senderRole, timestamp } = data;
    // console.log(`💬 Message in deal ${dealId} from ${senderRole}:`, message.substring(0, 50));
    
    // Broadcast to all users in the chat room (including sender for confirmation)
    io.to(`chat-${dealId}`).emit("new-message", {
      dealId,
      message,
      senderId,
      senderRole,
      timestamp
    });
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    // Start the deal expiry checker after MongoDB connects
    startExpiryChecker();
  })
  .catch(err => console.log("❌ MongoDB Error:", err));

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  //console.log(`🚀 Server running on port ${PORT}`);
  //console.log(`🔌 Socket.io ready on port ${PORT}`);
});
