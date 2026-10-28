// Precisa vir depois do authMiddleware (lê req.user.role).
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden', message: 'Seu perfil não tem permissão para esta ação' });
  }
  return next();
};

module.exports = requireRole;
