import express from "express"
import prisma from "../prisma.js"

const router = express.Router()

// GET MONTH
router.get("/month", async (req, res) => {
  const { subscriptionId, year, month } = req.query

  if (!subscriptionId || !year || !month) {
    return res.status(400).json({ error: "Missing params" })
  }

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)

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

  // agrupar por dia
  const grouped = {}

  posts.forEach((post) => {
    const key = post.scheduledFor.toISOString().split("T")[0]

    if (!grouped[key]) grouped[key] = []
    grouped[key].push(post)
  })

  res.json(grouped)
})


// GENERATE MONTH
router.post("/generate", async (req, res) => {
  const { subscriptionId, year, month, weekdays } = req.body

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { mediaPlan: true },
  })

  if (!sub) return res.status(404).json({ error: "Sub not found" })

  const postsPerWeek = Number(sub.mediaPlan.postsPerMonth || 4) / 4

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

    if (weekdays?.length) {
      selected = week.filter(d => weekdays.includes(d.getDay()))
    } else {
      const shuffled = [...week].sort(() => 0.5 - Math.random())
      selected = shuffled.slice(0, postsPerWeek)
    }

    for (const d of selected) {
      toCreate.push({
        subscriptionId,
        scheduledFor: d,
        status: "novo",
      })
    }
  }

  await prisma.socialPost.createMany({
    data: toCreate,
    skipDuplicates: true,
  })

  res.json({ ok: true })
})

export default router