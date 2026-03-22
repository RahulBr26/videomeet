/**
 * JWT Authentication Middleware (Optional)
 * Protects API routes with token-based auth
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Generate a JWT token for a user
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * Verify a JWT token
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware to require authentication
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth — attaches user if token exists, continues either way
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      req.user = verifyToken(token);
    } catch (err) {
      // Invalid token, proceed without user
    }
  }

  next();
}

module.exports = { generateToken, verifyToken, requireAuth, optionalAuth };
