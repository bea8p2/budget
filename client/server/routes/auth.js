// server/routes/auth.js
import express from 'express';
// TODO (Phase 5): import bcrypt, jsonwebtoken, and User model
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken';
// import User from '../models/User.js';

const router = express.Router();

/**
 * POST /auth/register
 * body: { email, password }
 * returns: { id, email }   (later: maybe auto-login and return token)
 */
router.post('/register', async (req, res) => {
  try {
    // const { email, password } = req.body;
    // TODO: validate inputs
    // TODO: check if user exists
    // const passwordHash = await bcrypt.hash(password, 12);
    // const user = await User.create({ email, passwordHash });
    // return res.status(201).json({ id: user._id, email: user.email });
    return res.status(501).json({ todo: 'Implement register in Phase 5' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /auth/login
 * body: { email, password }
 * returns: { token }  (JWT)
 */
router.post('/login', async (req, res) => {
  try {
    // const { email, password } = req.body;
    // const user = await User.findOne({ email });
    // if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    // const ok = await bcrypt.compare(password, user.passwordHash);
    // if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    // const token = jwt.sign({ sub: user._id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    // return res.json({ token });
    return res.status(501).json({ todo: 'Implement login in Phase 5' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;