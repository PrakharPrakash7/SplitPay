import { io } from 'socket.io-client';

let socket = null;

/**
 * Initialize Socket.io connection with JWT authentication
 * @param {string} token - JWT token from localStorage
 * @returns {Socket} - Socket.io client instance
 */
export const initializeSocket = (token) => {
  if (socket && socket.connected) {
    console.log('✅ Socket already connected');
    return socket;
  }

  socket = io('http://localhost:5000', {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔴 Socket connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
  });

  return socket;
};

/**
 * Get current socket instance
 * @returns {Socket|null} - Socket.io client instance or null
 */
export const getSocket = () => {
  if (!socket) {
    console.warn('⚠️ Socket not initialized. Call initializeSocket() first.');
  }
  return socket;
};

/**
 * Disconnect socket connection
 */
export const disconnectSocket = () => {
  if (socket) {
    console.log('👋 Disconnecting socket...');
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join a deal-specific room
 * @param {string} dealId - Deal ID to join
 */
export const joinDealRoom = (dealId) => {
  if (socket) {
    socket.emit('joinDeal', dealId);
    console.log(`🔗 Joined deal room: deal_${dealId}`);
  }
};

/**
 * Setup socket listeners for real-time deal updates
 * @param {Function} callbacks - Object with callback functions for each event
 */
export const setupDealListeners = (callbacks = {}) => {
  if (!socket) {
    console.warn('⚠️ Socket not initialized');
    return () => {};
  }

  const {
    onNewDeal,
    onDealAccepted,
    onDealTaken,
    onOrderCreated,
    onPaymentAuthorized,
    onBuyerPaid,
    onAddressReceived,
    onOrderPlaced,
    onPaymentCaptured,
    onPayoutInitiated,
    onPayoutCompleted,
    onDealCompleted,
    onPaymentFailed,
    onPaymentRefunded,
    onShippingStatusChanged
  } = callbacks;

  // Cardholder: New deal available
  if (onNewDeal) {
    socket.on('newDeal', onNewDeal);
  }

  // Buyer: Deal accepted by cardholder
  if (onDealAccepted) {
    socket.on('dealAccepted', onDealAccepted);
  }

  // Cardholder: Deal taken by another cardholder
  if (onDealTaken) {
    socket.on('dealTaken', onDealTaken);
  }

  // Buyer: Razorpay order created
  if (onOrderCreated) {
    socket.on('orderCreated', onOrderCreated);
  }

  // Both: Payment authorized (held in escrow)
  if (onPaymentAuthorized) {
    socket.on('paymentAuthorized', onPaymentAuthorized);
  }

  // Cardholder: Buyer paid
  if (onBuyerPaid) {
    socket.on('buyerPaid', onBuyerPaid);
  }

  // Cardholder: Received shipping address
  if (onAddressReceived) {
    socket.on('addressReceived', onAddressReceived);
  }

  // Buyer: Order placed by cardholder
  if (onOrderPlaced) {
    socket.on('orderPlaced', onOrderPlaced);
  }

  // Both: Payment captured from escrow
  if (onPaymentCaptured) {
    socket.on('paymentCaptured', onPaymentCaptured);
  }

  // Cardholder: Payout initiated
  if (onPayoutInitiated) {
    socket.on('payoutInitiated', onPayoutInitiated);
  }

  // Cardholder: Payout completed
  if (onPayoutCompleted) {
    socket.on('payoutCompleted', onPayoutCompleted);
  }

  // Both: Deal completed
  if (onDealCompleted) {
    socket.on('dealCompleted', onDealCompleted);
  }

  // Both: Payment failed
  if (onPaymentFailed) {
    socket.on('paymentFailed', onPaymentFailed);
  }

  // Both: Payment refunded
  if (onPaymentRefunded) {
    socket.on('paymentRefunded', onPaymentRefunded);
  }

  // Both: Shipping status changed
  if (onShippingStatusChanged) {
    socket.on('shippingStatusChanged', onShippingStatusChanged);
  }

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('newDeal');
      socket.off('dealAccepted');
      socket.off('dealTaken');
      socket.off('orderCreated');
      socket.off('paymentAuthorized');
      socket.off('buyerPaid');
      socket.off('addressReceived');
      socket.off('orderPlaced');
      socket.off('paymentCaptured');
      socket.off('payoutInitiated');
      socket.off('payoutCompleted');
      socket.off('dealCompleted');
      socket.off('paymentFailed');
      socket.off('paymentRefunded');
      socket.off('shippingStatusChanged');
    }
  };
};

export default {
  initializeSocket,
  getSocket,
  disconnectSocket,
  joinDealRoom,
  setupDealListeners
};
