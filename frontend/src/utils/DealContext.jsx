import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

const DealContext = createContext();

export const useDealContext = () => {
  const context = useContext(DealContext);
  if (!context) {
    throw new Error('useDealContext must be used within a DealProvider');
  }
  return context;
};

export const DealProvider = ({ children }) => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Fetch deals from backend
  const fetchDeals = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/deals`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDeals(data.deals || []);
        console.log('✅ Deals fetched:', data.deals?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize Socket.io connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io(API_BASE_URL, {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to Socket.io');
      const role = localStorage.getItem('role');
      
      if (role === 'buyer') {
        newSocket.emit('joinBuyers');
      } else if (role === 'cardholder') {
        newSocket.emit('joinCardholders');
      } else if (role === 'admin') {
        newSocket.emit('joinAdmins');
      }
    });

    // Listen for new deals
    newSocket.on('newDeal', (data) => {
      console.log('📢 New deal received:', data);
      fetchDeals(); // Refresh deals
    });

    // Listen for deal acceptance
    newSocket.on('dealAcceptedByCardholder', (data) => {
      console.log('🎉 Deal accepted:', data);
      fetchDeals(); // Refresh deals
    });

    // Listen for deal updates
    newSocket.on('dealUpdated', (data) => {
      console.log('🔄 Deal updated:', data);
      fetchDeals(); // Refresh deals
    });

    // Listen for deal completion
    newSocket.on('dealCompleted', (data) => {
      console.log('✅ Deal completed:', data);
      fetchDeals(); // Refresh deals
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [fetchDeals]);

  // Initial fetch
  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Update a single deal in the state
  const updateDeal = useCallback((updatedDeal) => {
    setDeals(prevDeals => 
      prevDeals.map(deal => 
        deal._id === updatedDeal._id ? { ...deal, ...updatedDeal } : deal
      )
    );
  }, []);

  // Add a new deal
  const addDeal = useCallback((newDeal) => {
    setDeals(prevDeals => [newDeal, ...prevDeals]);
  }, []);

  // Remove a deal
  const removeDeal = useCallback((dealId) => {
    setDeals(prevDeals => prevDeals.filter(deal => deal._id !== dealId));
  }, []);

  const value = {
    deals,
    loading,
    socket,
    fetchDeals,
    updateDeal,
    addDeal,
    removeDeal
  };

  return (
    <DealContext.Provider value={value}>
      {children}
    </DealContext.Provider>
  );
};
