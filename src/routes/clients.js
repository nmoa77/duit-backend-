import express from "express"
import prisma from "../prisma.js"
import bcrypt from "bcryptjs"
import { authRequired, requireRole } from "../middleware/auth.js"
import { sendPasswordChangedEmail, sendActivationEmail } from "../utils/sendProjectStatusEmail.js"
import { randomBytes } from "crypto"

const router = express.Router()

/* =========================
   CRIAR CLIENTE
========================= */


// CRIAR CLIENTE
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  console.log("🔥 A ENTRAR NA ROTA DE CRIAR CLIENTE")
  const { name, company, email, phone } = req.body

  if (!name || !email) {
    return res.status(400).json({ error: "Dados incompletos" })
  }

  try {

    // 🔐 token
const token = randomBytes(32).toString("hex")

    const result = await prisma.$transaction(async (tx) => {

      const client = await tx.client.create({
        data: { name, company, email, phone }
      })

      const user = await tx.user.create({
        data: {
          email,
          role: "client",
          clientId: client.id,
          activationToken: token
        }
      })

      return { client, user }
    })

    // 🔗 link
    const link = `${process.env.APP_URL}/clt/set-password?token=${token}`

    console.log("📩 NOVO CLIENTE - EMAIL:", email)

    await sendActivationEmail({
      to: email,
      clientName: name,
      activationLink: link
    })

    res.json(result)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao criar cliente" })
  }
})

/* =========================
   ATIVAR / REENVIAR ACESSO
========================= */
router.post("/:id/activate", async (req, res) => {
  try {
    const clientId = req.params.id

    const client = await prisma.client.findUnique({
      where: { id: clientId }
    })

    if (!client) {
      return res.status(404).json({ error: "Cliente não encontrado" })
    }

    // 🔐 gerar token
    const token = randomBytes(32).toString("hex")

    // 🔍 ver se já existe user
    let user = await prisma.user.findUnique({
      where: { email: client.email }
    })

    if (!user) {
      // criar user
      user = await prisma.user.create({
        data: {
          email: client.email,
          role: "client",
          clientId: client.id,
          activationToken: token
        }
      })
    } else {
      // atualizar user existente
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          activationToken: token,
          clientId: client.id
        }
      })
    }

    const link = `${process.env.APP_URL}/clt/set-password?token=${token}`



  try {


  await sendActivationEmail({
    to: client.email,
    clientName: client.name,
    activationLink: link
  })

  console.log("EMAIL DE ATIVAÇÃO ENVIADO")
} catch (emailError) {
  console.error("ERRO AO ENVIAR EMAIL DE ATIVAÇÃO:", emailError)
}

    res.json({ ok: true })

  } catch (err) {
    console.error("ERRO ATIVAR:", err)
    res.status(500).json({ error: "Erro ao ativar acesso" })
  }
})

/* =========================
   DEFINIR PASSWORD (ATIVAÇÃO)
========================= */
router.post("/set-password", async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({ error: "Dados inválidos" })
    }

    const user = await prisma.user.findFirst({
      where: { activationToken: token }
    })

    if (!user) {
      return res.status(400).json({ error: "Token inválido" })
    }

    const hash = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hash,
        activationToken: null
      }
    })

    console.log("PASSWORD DEFINIDA")

    res.json({ ok: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao definir password" })
  }
})

/* =========================
   LISTAR CLIENTES
========================= */
router.get("/", authRequired, async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    res.json(clients)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Erro ao listar clientes" })
  }
})

/* =========================
   EDITAR CLIENTE
========================= */
router.put("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const { id } = req.params
  const { name, company, email, phone, password, isActive } = req.body

  try {
    await prisma.client.update({
      where: { id },
      data: {
        name,
        company,
        email,
        phone,
        ...(isActive !== undefined ? { isActive } : {})
      }
    })

    const existingUser = await prisma.user.findFirst({
      where: { clientId: id }
    })

    if (!existingUser) {
      return res.status(400).json({ error: "User não encontrado" })
    }

    const userUpdateData = { email }

    if (password && password.trim() !== "") {
      const hashed = await bcrypt.hash(password, 10)
      userUpdateData.password = hashed
    }

    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: userUpdateData
    })

    if (password && password.trim() !== "") {
      await sendPasswordChangedEmail(updatedUser.email)
    }

    res.json({ success: true })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Erro ao editar cliente" })
  }
})

/* =========================
   DETALHE CLIENTE
========================= */
router.get("/:id", authRequired, async (req, res) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { users: true }
    })

    if (!client) {
      return res.status(404).json({ error: "Cliente não encontrado" })
    }

    res.json(client)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao obter cliente" })
  }
})

export default router