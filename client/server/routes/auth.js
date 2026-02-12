// server/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Helper: create JWT
function createToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /auth/register
 * body: { email, password }
 * returns: { id, email }
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ error: 'Email already registered' });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({ email, passwordHash });

    // Auto-login: create JWT + cookie
    const token = createToken(user._id);
    res.cookie('auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return res.status(201).json({
      id: user._id,
      email: user.email
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/login
 * body: { email, password }
 * returns: { id, email }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ error: 'Invalid credentials' });

    // Create JWT + cookie
    const token = createToken(user._id);
    res.cookie('auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return res.json({
      id: user._id,
      email: user.email
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('auth');
  return res.json({ ok: true });
});

/**
 * GET /auth/me
 * returns: { id, email } if logged in
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.auth;
    if (!token) return res.json({ user: null });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).lean();

    if (!user) return res.json({ user: null });

    return res.json({
      user: {
        id: user._id,
        email: user.email
      }
    });

  } catch {
    return res.json({ user: null });
  }
});

export default router;
