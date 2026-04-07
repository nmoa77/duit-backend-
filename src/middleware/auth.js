import jwt from "jsonwebtoken"

export function authRequired(req, res, next) {
  try {
    const token = req.cookies.token // 👈 vem do cookie

    if (!token) {
      return res.status(401).json({ message: "Não autenticado" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = decoded

    next()
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" })
  }
}