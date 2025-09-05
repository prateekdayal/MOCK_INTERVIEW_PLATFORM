// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js'; // Ensure path is correct and User is default exported

const protect = async (req, res, next) => {
  // --- DIAGNOSTIC LOGS ---
  console.log("DEBUG: Auth middleware 'protect' started.");
  // --- END DIAGNOSTIC LOGS ---

  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    // --- DIAGNOSTIC LOGS ---
    console.log("DEBUG: Token found in headers (partial):", token ? token.substring(0, 10) + '...' : 'none');
    // --- END DIAGNOSTIC LOGS ---
  }

  // Make sure token exists
  if (!token) {
    // --- DIAGNOSTIC LOGS ---
    console.warn("DEBUG: No token found. Sending 401.");
    // --- END DIAGNOSTIC LOGS ---
    return res.status(401).json({ success: false, message: 'Not authorized to access this route (no token).' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // --- DIAGNOSTIC LOGS ---
    console.log("DEBUG: Token verified. Decoded ID:", decoded.id);
    // --- END DIAGNOSTIC LOGS ---

    // Attach user to the request object
    // Find user by ID from the token payload
    req.user = await User.findById(decoded.id);

    if (!req.user) {
        // --- DIAGNOSTIC LOGS ---
        console.warn("DEBUG: User not found for token. Sending 401.");
        // --- END DIAGNOSTIC LOGS ---
        return res.status(401).json({ success: false, message: 'User associated with token not found.' });
    }

    // --- DIAGNOSTIC LOGS ---
    console.log("DEBUG: User authenticated:", req.user.username);
    // --- END DIAGNOSTIC LOGS ---
    next(); // Proceed to the next middleware/route handler
  } catch (error) {
    // --- DIAGNOSTIC LOGS ---
    console.error('DEBUG: Error in authentication middleware (invalid token or JWT error):', error.message);
    // --- END DIAGNOSTIC LOGS ---
    // Often, a malformed or expired token will result in a specific JWT error
    return res.status(401).json({ success: false, message: 'Not authorized to access this route (invalid or expired token).' });
  }
};

export default protect;