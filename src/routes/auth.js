import express from "express"
import prisma from "../prisma.js"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { sendResetPasswordEmail  } from "../utils/sendProjectStatusEmail.js"
import { randomBytes } from "crypto"

const router = express.Router()

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({
      where: { email },
      include: { client: true }
    })

    // 1. user existe?
    if (!user) {
      return res.status(400).json({
        message: "Credenciais inválidas"
      })
    }

    // 2. password correta?
    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return res.status(400).json({
        message: "Credenciais inválidas"
      })
    }

    // 3. conta ativa?
    if (user.role === "client" && user.client && !user.client.isActive) {
      return res.status(403).json({
        message: "Conta desativada. Contacte o suporte."
      })
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        clientId: user.clientId || null
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.clientId || null
      }
    })

  } catch (err) {
    console.error("ERRO LOGIN:", err)
    res.status(500).json({
      message: "Erro no login"
    })
  }
})

// ME
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return res.status(401).json(null)
    }

    const token = authHeader.split(" ")[1]

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        clientId: true
      }
    })

    res.json(user)
  } catch {
    res.status(401).json(null)
  }
})



router.post("/set-password", async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({
        message: "Dados inválidos"
      })
    }

    // 🔍 encontrar user pelo token
    const user = await prisma.user.findFirst({
      where: { activationToken: token }
    })

    if (!user) {
      return res.status(400).json({
        message: "Token inválido ou expirado"
      })
    }

    // 🔐 criar hash
    const hashedPassword = await bcrypt.hash(password, 10)

    console.log("HASH GERADA:", hashedPassword)

    // 💾 guardar password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        activationToken: null
      }
    })

    console.log("USER ATUALIZADO")

    res.json({ ok: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({
      message: "Erro ao definir password"
    })
  }
})



// 🔐 PEDIR RESET PASSWORD
router.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email obrigatório" })
    }

    const user = await prisma.user.findUnique({
      where: { email }
    })

    // ⚠️ nunca dizer se existe ou não
    if (!user) {
      return res.json({
        ok: true,
        message: "Se existir uma conta, irá receber um email."
      })
    }

    const token = randomBytes(32).toString("hex")

    await prisma.user.update({
      where: { id: user.id },
      data: {
        activationToken: token
      }
    })

    const link = `http://localhost:5173/set-password?token=${token}`

   await sendResetPasswordEmail({
  to: email,
  clientName: user.name || "",
  resetLink: link
})

    res.json({
      ok: true,
      message: "Se existir uma conta, irá receber um email."
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({
      message: "Erro ao processar pedido"
    })
  }
})
export default router