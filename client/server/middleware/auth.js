// server/middleware/auth.js
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.cookies.auth;
  if (!token) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
