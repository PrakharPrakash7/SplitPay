import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAuthToken } from '../utils/authHelper';
import toast from 'react-hot-toast';

const ChatBox = ({ dealId, userRole }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch existing messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = getAuthToken(userRole);
        const response = await fetch(`http://localhost:5000/api/chat/${dealId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        } else {
          console.error('Failed to fetch messages');
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [dealId, userRole]);

  // Socket.io real-time messaging
  useEffect(() => {
    const token = getAuthToken(userRole);
    
    // Connect to socket
    const socket = io('http://localhost:5000', {
      auth: { token }
    });
    socketRef.current = socket;

    // Join chat room
    socket.emit('join-chat-room', dealId);
    console.log('💬 Joined chat room:', dealId);

    // Listen for new messages
    socket.on('new-message', (data) => {
      console.log('💬 New message received:', data);
      
      // Add message to list if not already present
      setMessages(prev => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some(msg => 
          msg.senderId === data.senderId && 
          msg.timestamp === data.timestamp &&
          msg.message === data.message
        );
        
        if (exists) return prev;
        
        return [...prev, {
          senderId: data.senderId,
          senderRole: data.senderRole,
          message: data.message,
          timestamp: data.timestamp
        }];
      });

      // Show notification if message is from other user
      if (data.senderRole !== userRole) {
        const senderLabel = data.senderRole === 'buyer' ? 'Buyer' : 'Cardholder';
        toast.success(`💬 New message from ${senderLabel}`);
      }
    });

    // Cleanup on unmount
    return () => {
      socket.emit('leave-chat-room', dealId);
      socket.disconnect();
      console.log('💬 Left chat room:', dealId);
    };
  }, [dealId, userRole]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) {
      toast.error('Message cannot be empty');
      return;
    }

    if (newMessage.length > 1000) {
      toast.error('Message too long (max 1000 characters)');
      return;
    }

    setSending(true);

    try {
      const token = getAuthToken(userRole);
      const response = await fetch(`http://localhost:5000/api/chat/${dealId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: newMessage.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Emit socket event for real-time delivery
        socketRef.current?.emit('send-message', {
          dealId,
          message: data.message.message,
          senderId: data.message.senderId,
          senderRole: data.message.senderRole,
          timestamp: data.message.timestamp
        });

        setNewMessage('');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] bg-gray-50 rounded-lg border border-gray-200">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-t-lg">
        <h3 className="font-semibold flex items-center gap-2">
          💬 Chat with {userRole === 'buyer' ? 'Cardholder' : 'Buyer'}
        </h3>
        <p className="text-xs text-blue-100 mt-1">
          Messages are only visible to you and the other party
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-4xl mb-2">💬</p>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwnMessage = msg.senderRole === userRole;
            return (
              <div
                key={index}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">
                      {isOwnMessage ? 'You' : msg.senderRole === 'buyer' ? '👤 Buyer' : '💳 Cardholder'}
                    </span>
                    <span className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4 bg-white rounded-b-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            maxLength={1000}
            disabled={sending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {newMessage.length}/1000 characters
        </p>
      </form>
    </div>
  );
};

export default ChatBox;
