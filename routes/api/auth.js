// routes/api/auth.js - Authentication endpoints (simplified version)
const express = require('express');
const router = express.Router();

// In-memory user store (replace with database in production)
const users = new Map();

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email and password required' 
    });
  }

  // Simple validation (replace with real auth)
  const user = users.get(email);
  
  if (!user || user.password !== password) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid credentials' 
    });
  }

  // Generate simple token (use JWT in production)
  const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');

  res.json({
    success: true,
    token,
    user: {
      email: user.email,
      name: user.name,
      role: user.role || 'user'
    }
  });
});

/**
 * POST /api/auth/register
 * User registration
 */
router.post('/register', (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email, password, and name required' 
    });
  }

  if (users.has(email)) {
    return res.status(409).json({ 
      success: false, 
      error: 'User already exists' 
    });
  }

  // Create user (hash password in production)
  const user = {
    email,
    password, // NEVER store plain text passwords!
    name,
    role: 'user',
    createdAt: new Date().toISOString()
  };

  users.set(email, user);

  // Generate token
  const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');

  res.status(201).json({
    success: true,
    token,
    user: {
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', (req, res) => {
  // In a real app, invalidate the token
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

/**
 * GET /api/auth/verify
 * Verify token
 */
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      error: 'No token provided' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // Simple decode (use JWT verify in production)
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [email] = decoded.split(':');
    
    const user = users.get(email);
    
    if (!user) {
      throw new Error('User not found');
    }

    res.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
});

module.exports = router;