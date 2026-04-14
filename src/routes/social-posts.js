import express from "express"
import prisma from "../prisma.js"
import { authRequired, requireRole } from "../middleware/auth.js"

const router = express.Router()

// GET posts por mês
router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { month, year, subscriptionId } = req.query

    const where = {}

    if (subscriptionId) {
      where.subscriptionId = subscriptionId
    }

    if (month && year) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)

      where.date = {
        gte: start,
        lt: end
      }
    }

    const posts = await prisma.socialPost.findMany({
      where,
      include: {
        client: true,
        subscription: true
      },
      orderBy: {
        date: "asc"
      }
    })

    res.json(posts)

  } catch (err) {
    console.error("Erro calendário:", err)
    res.status(500).json({ message: "Erro ao buscar posts" })
  }
})

// CREATE MANUAL
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { clientId, subscriptionId, date } = req.body

    const post = await prisma.socialPost.create({
      data: {
        clientId,
        subscriptionId,
        date: new Date(date),
        status: "novo"
      }
    })

    res.json(post)

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Erro ao criar post" })
  }
})

// UPDATE POST
router.put("/:id", async (req, res) => {
  const { id } = req.params
  const { content, status, scheduledFor } = req.body

  const updated = await prisma.socialPost.update({
    where: { id },
    data: {
      content,
      status,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    },
  })

  res.json(updated)
})

// CLIENT SUGGESTION
router.post("/:id/suggestion", async (req, res) => {
  const { id } = req.params
  const { suggestion } = req.body

  const updated = await prisma.socialPost.update({
    where: { id },
    data: {
      clientSuggestion: suggestion,
    },
  })

  res.json(updated)
})

export default router
