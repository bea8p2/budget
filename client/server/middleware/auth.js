// server/middleware/auth.js
// Minimal auth middleware.
// Later: verify JWT and set req.user.id
// For early testing: use 'x-demo-user' header to simulate a logged-in user.

export function requireAuth(req, res, next) {
  // TODO (Phase 5): replace this with real JWT validation
  const demoUser = req.header('x-demo-user');
  if (!demoUser) {
    return res.status(401).json({ error: 'Unauthorized. For now, pass x-demo-user header.' });
  }
  req.user = { id: demoUser }; // should be a Mongo ObjectId string later
  next();
}
``