import jwt from "jsonwebtoken"

export function authRequired(req, res, next) {
  try {
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({ error: "Sem token" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded

    next()
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Não autenticado" })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Sem permissão" })
    }

    next()
  }
}