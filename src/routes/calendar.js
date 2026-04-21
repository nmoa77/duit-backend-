import express from "express"
import prisma from "../prisma.js"

const router = express.Router()

// ======================
// GET MONTH
// ======================
router.get("/month", async (req, res) => {
  try {
    const { subscriptionId, year, month } = req.query

    if (!subscriptionId || !year || !month) {
      return res.status(400).json({ error: "Missing params" })
    }

    // 🔥 FIX UTC
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59))

    console.log("🔎 RANGE:", start, end)

    const posts = await prisma.socialPost.findMany({
      where: {
        subscriptionId,
        scheduledFor: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { scheduledFor: "asc" },
    })

    console.log("📊 POSTS FOUND:", posts.length)

    const grouped = {}

    posts.forEach((p) => {
      const key = p.scheduledFor.toISOString().split("T")[0]
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(p)
    })

    return res.json(grouped)

  } catch (err) {
    console.error("❌ GET MONTH ERROR:", err)
    return res.status(500).json({ error: "Erro ao carregar calendário" })
  }
})


// ======================
// GENERATE
// ======================
router.post("/generate", async (req, res) => {
  try {
    const { subscriptionId, year, month, weekdays } = req.body

    console.log("📦 GENERATE INPUT:", req.body)

    if (!subscriptionId || !year || !month) {
      return res.status(400).json({ error: "Missing params" })
    }

    // 🔥 buscar subscription + client
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { client: true, mediaPlan: true },
    })

    if (!sub) {
      return res.status(404).json({ error: "Subscrição não encontrada" })
    }

    // 🔥 posts por semana
    const postsPerWeek = Math.max(
      1,
      Math.round((sub.mediaPlan?.postsPerMonth || 4) / 4)
    )

    console.log("📊 postsPerWeek:", postsPerWeek)

    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)

    // 🔥 criar lista de dias
    const days = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d))
    }

    // 🔥 dividir por semanas
    const weeks = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    // 🔥 criar array de posts
    const toCreate = []

    for (const week of weeks) {
      let selected = []

      if (weekdays && weekdays.length) {
        selected = week.filter(d => weekdays.includes(d.getDay()))
      } else {
        const shuffled = [...week].sort(() => 0.5 - Math.random())
        selected = shuffled.slice(0, postsPerWeek)
      }

      for (const d of selected) {
        toCreate.push({
          subscriptionId: sub.id,
          clientId: sub.clientId, // 🔥 FIX PRINCIPAL
          scheduledFor: new Date(d),
          status: "novo",
        })
      }
    }

    console.log("🧠 posts to create:", toCreate.length)

    // 🔥 criar posts (sem rebentar duplicados)
    for (const post of toCreate) {
      try {
        await prisma.socialPost.create({
          data: post
        })
      } catch (err) {
        // ignora duplicados
        if (err.code !== "P2002") {
          console.error("❌ CREATE ERROR:", err)
        }
      }
    }

    return res.json({
      ok: true,
      created: toCreate.length,
    })

  } catch (err) {
    console.error("❌ GENERATE ERROR:", err)

    return res.status(500).json({
      error: "Erro ao gerar calendário",
      detail: err.message,
    })
  }
})


// ======================
// DELETE BULK
// ======================
router.delete("/bulk", async (req, res) => {
  try {
    const { subscriptionId, year, month } = req.body

    const start = new Date(Date.UTC(year, month - 1, 1))
const end = new Date(Date.UTC(year, month, 0, 23, 59, 59))

    const result = await prisma.socialPost.deleteMany({
      where: {
        subscriptionId,
        scheduledFor: {
          gte: start,
          lte: end,
        },
      },
    })

    return res.json({ deleted: result.count })

  } catch (err) {
    console.error("❌ DELETE BULK ERROR:", err)
    return res.status(500).json({ error: "Erro ao apagar calendário" })
  }
})

export default router