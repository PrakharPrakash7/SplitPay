import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log('🔐 Auth check - Headers:', {
      authorization: authHeader ? `${authHeader.substring(0, 20)}...` : 'missing',
      path: req.path,
      method: req.method
    });

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('❌ Auth failed: No Bearer token in header');
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token || token === 'null' || token === 'undefined') {
      console.log('❌ Auth failed: Token is null or undefined');
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // { id, role }
    console.log('✅ Auth successful:', { id: decoded.id, role: decoded.role });
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Middleware for buyer or cardholder authentication
export const authenticateBuyerOrCardholder = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is buyer or cardholder
    if (decoded.role !== 'buyer' && decoded.role !== 'cardholder') {
      console.log('❌ Auth failed: User is not buyer or cardholder');
      return res.status(403).json({ message: "Access denied. Only buyers and cardholders can access this." });
    }

    req.user = { uid: decoded.id, role: decoded.role };
    console.log('✅ Auth successful (buyer/cardholder):', { id: decoded.id, role: decoded.role });
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    res.status(403).json({ message: "Invalid or expired token" });
  }
};
