import express from "express"
import prisma from "../prisma.js"

const router = express.Router()

// ======================
// GET MONTH
// ======================
router.get("/month", async (req, res) => {
  try {
    const { subscriptionId, year, month, weekdays } = req.body

    if (!year || !month) {
      return res.status(400).json({ error: "Missing params" })
    }

   

  

    if (subscriptionId) {
      where.subscriptionId = subscriptionId
    }

    const posts = await prisma.socialPost.findMany({
      where,
      orderBy: { scheduledFor: "asc" },
      include: { client: true },
    })

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

    if (!subscriptionId || !year || !month) {
      return res.status(400).json({ error: "Missing params" })
    }

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { client: true, mediaPlan: true },
    })

    if (!sub) {
      return res.status(404).json({ error: "Subscrição não encontrada" })
    }

    const postsPerWeek = Math.max(
      1,
      Math.round((sub.mediaPlan?.postsPerMonth || 4) / 4)
    )

    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)

    const days = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d))
    }

    const weeks = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

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
          clientId: sub.clientId,
          scheduledFor: new Date(d),
          status: "novo",
        })
      }
    }

    for (const post of toCreate) {
      try {
        await prisma.socialPost.create({ data: post })
      } catch (err) {
        if (err.code !== "P2002") {
          console.error(err)
        }
      }
    }

    return res.json({ ok: true, created: toCreate.length })

  } catch (err) {
    console.error("❌ GENERATE ERROR:", err)
    return res.status(500).json({ error: "Erro ao gerar calendário" })
  }
})


// ======================
// DELETE BULK (MÊS)
// ======================
router.delete("/bulk", async (req, res) => {
  try {
    const { subscriptionId, year, month } = req.body

    if (!subscriptionId || !year || !month) {
      return res.status(400).json({ error: "Missing params" })
    }

    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59)

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


// ======================
// UPDATE POST
// ======================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { content, status, scheduledFor } = req.body

    const updated = await prisma.socialPost.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(status !== undefined && { status }),
        ...(scheduledFor && { scheduledFor: new Date(scheduledFor) }),
      },
    })

    return res.json(updated)

  } catch (err) {
    console.error("❌ UPDATE ERROR:", err)
    return res.status(500).json({ error: "Erro ao atualizar post" })
  }
})


// ======================
// DELETE SINGLE POST
// ======================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params

    await prisma.socialPost.delete({
      where: { id },
    })

    return res.json({ ok: true })

  } catch (err) {
    console.error("❌ DELETE ERROR:", err)
    return res.status(500).json({ error: "Erro ao apagar post" })
  }
})

export default router