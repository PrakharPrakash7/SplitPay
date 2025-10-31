import express from 'express';
import ChatMessage from '../models/ChatMessage.js';
import Deal from '../models/Deal.js';
import { authenticateBuyerOrCardholder } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all chat messages for a deal
router.get('/:dealId', authenticateBuyerOrCardholder, async (req, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.user.uid;
    const userRole = req.user.role;

    // Verify user is part of this deal
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const isBuyer = deal.buyerId.toString() === userId;
    const isCardholder = deal.cardholderId && deal.cardholderId.toString() === userId;

    if (!isBuyer && !isCardholder) {
      return res.status(403).json({ error: 'Not authorized to view this chat' });
    }

    // Fetch messages sorted by timestamp
    const messages = await ChatMessage.find({ dealId })
      .sort({ timestamp: 1 })
      .limit(100); // Limit to last 100 messages

    // Mark messages as read for the current user
    const otherRole = userRole === 'buyer' ? 'cardholder' : 'buyer';
    await ChatMessage.updateMany(
      { dealId, senderRole: otherRole, isRead: false },
      { isRead: true }
    );

    res.json({ messages });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a new chat message
router.post('/:dealId', authenticateBuyerOrCardholder, async (req, res) => {
  try {
    const { dealId } = req.params;
    const { message } = req.body;
    const userId = req.user.uid;
    const userRole = req.user.role;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }

    // Verify user is part of this deal
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const isBuyer = deal.buyerId.toString() === userId;
    const isCardholder = deal.cardholderId && deal.cardholderId.toString() === userId;

    if (!isBuyer && !isCardholder) {
      return res.status(403).json({ error: 'Not authorized to send messages in this chat' });
    }

    // Create new message
    const chatMessage = new ChatMessage({
      dealId,
      senderId: userId,
      senderRole: userRole,
      message: message.trim(),
      timestamp: new Date()
    });

    await chatMessage.save();

    res.status(201).json({ 
      success: true, 
      message: chatMessage 
    });
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get unread message count
router.get('/:dealId/unread', authenticateBuyerOrCardholder, async (req, res) => {
  try {
    const { dealId } = req.params;
    const userRole = req.user.role;
    const otherRole = userRole === 'buyer' ? 'cardholder' : 'buyer';

    const unreadCount = await ChatMessage.countDocuments({
      dealId,
      senderRole: otherRole,
      isRead: false
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

export default router;
