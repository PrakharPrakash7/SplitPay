/**
 * Authentication Helper
 * Manages role-specific tokens in localStorage to allow multiple roles
 * to be logged in simultaneously in different tabs
 */

// Role-specific token keys
const TOKEN_KEYS = {
  buyer: 'buyer_token',
  cardholder: 'cardholder_token',
  admin: 'admin_token'
};

const ROLE_KEYS = {
  buyer: 'buyer_role',
  cardholder: 'cardholder_role',
  admin: 'admin_role'
};

/**
 * Save authentication data for a specific role
 * @param {string} role - 'buyer', 'cardholder', or 'admin'
 * @param {string} token - JWT token
 */
export const saveAuth = (role, token) => {
  const tokenKey = TOKEN_KEYS[role];
  const roleKey = ROLE_KEYS[role];
  
  if (!tokenKey) {
    console.error(`Invalid role: ${role}`);
    return;
  }
  
  localStorage.setItem(tokenKey, token);
  localStorage.setItem(roleKey, role);
  
  console.log(`✅ Auth saved for ${role}`);
};

/**
 * Get authentication token for a specific role
 * @param {string} role - 'buyer', 'cardholder', or 'admin'
 * @returns {string|null} - JWT token or null
 */
export const getAuthToken = (role) => {
  const tokenKey = TOKEN_KEYS[role];
  
  if (!tokenKey) {
    console.error(`Invalid role: ${role}`);
    return null;
  }
  
  return localStorage.getItem(tokenKey);
};

/**
 * Get stored role for a specific role
 * @param {string} role - 'buyer', 'cardholder', or 'admin'
 * @returns {string|null} - Role or null
 */
export const getAuthRole = (role) => {
  const roleKey = ROLE_KEYS[role];
  
  if (!roleKey) {
    console.error(`Invalid role: ${role}`);
    return null;
  }
  
  return localStorage.getItem(roleKey);
};

/**
 * Clear authentication data for a specific role
 * @param {string} role - 'buyer', 'cardholder', or 'admin'
 */
export const clearAuth = (role) => {
  const tokenKey = TOKEN_KEYS[role];
  const roleKey = ROLE_KEYS[role];
  
  if (!tokenKey) {
    console.error(`Invalid role: ${role}`);
    return;
  }
  
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(roleKey);
  
  console.log(`🗑️ Auth cleared for ${role}`);
};

/**
 * Check if a specific role is authenticated
 * @param {string} role - 'buyer', 'cardholder', or 'admin'
 * @returns {boolean}
 */
export const isAuthenticated = (role) => {
  const token = getAuthToken(role);
  return !!token;
};

/**
 * Clear all authentication data (logout from all roles)
 */
export const clearAllAuth = () => {
  Object.keys(TOKEN_KEYS).forEach(role => {
    clearAuth(role);
  });
  console.log('🗑️ All auth data cleared');
};
