import express from "express"
import prisma from "../prisma.js"
import { authRequired, requireRole } from "../middleware/auth.js"

const router = express.Router()

const VALID_STATUS = new Set(["novo", "agendado", "publicado", "cancelado"])

function clampInt(n, def) {
  const v = Number(n)
  return Number.isFinite(v) ? v : def
}

function startOfMonthUTC(year, month1to12) {
  return new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0))
}
function endOfMonthExclusiveUTC(year, month1to12) {
  return new Date(Date.UTC(year, month1to12, 1, 0, 0, 0))
}
function daysInMonthUTC(year, month1to12) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

function normalizeWeekdays(arr) {
  if (!Array.isArray(arr)) return null

  return arr
    .map(Number)
    .map(n => (n === 7 ? 6 : n - 1)) // 🔥 converter 1-7 → 0-6
    .filter(n => n >= 0 && n <= 6)
}

// usamos “meio-dia UTC” para evitar DST / horas inválidas
function dateUTCNoon(year, month1to12, day) {
  return new Date(Date.UTC(year, month1to12 - 1, day, 12, 0, 0))
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * GET /calendar/month?subscriptionId=...&year=2026&month=2
 * -> posts do mês (inclui client)
 */
router.get("/month", authRequired, requireRole("admin"), async (req, res) => {
  const subscriptionId = String(req.query.subscriptionId || "").trim()
  const year = clampInt(req.query.year, new Date().getUTCFullYear())
  const month = clampInt(req.query.month, new Date().getUTCMonth() + 1)

  if (!subscriptionId) return res.status(400).json({ message: "subscriptionId é obrigatório" })
  if (month < 1 || month > 12) return res.status(400).json({ message: "month inválido (1..12)" })

  const from = startOfMonthUTC(year, month)
  const to = endOfMonthExclusiveUTC(year, month)

  const posts = await prisma.socialPost.findMany({
    where: {
      subscriptionId,
      scheduledFor: { gte: from, lt: to }
    },
    include: { client: true },
    orderBy: { scheduledFor: "asc" }
  })

  res.json({ posts })
})

/**
 * GET /calendar/day?date=2026-02-19
 * -> posts do dia (todos, sem filtrar por status!)
 */
router.get("/day", authRequired, requireRole("admin"), async (req, res) => {
  const dateStr = String(req.query.date || "").trim()
  if (!dateStr) return res.status(400).json({ message: "date é obrigatório (YYYY-MM-DD)" })

  const start = new Date(dateStr + "T00:00:00.000Z")
  const end = new Date(dateStr + "T23:59:59.999Z")

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ message: "date inválida" })
  }

  const posts = await prisma.socialPost.findMany({
    where: {
      scheduledFor: { gte: start, lte: end }
    },
    include: {
      client: true,
      subscription: { include: { mediaPlan: true, client: true } }
    },
    orderBy: { scheduledFor: "asc" }
  })

  res.json({ posts })
})

/**
 * GET /calendar/week?date=2026-02-19
 * -> semana (Dom..Sáb) que contém essa data
 */
/**
 * GET /calendar/week?date=2026-02-19
 * -> semana (Seg..Dom) ISO que contém essa data
 */
router.get("/week", authRequired, requireRole("admin"), async (req, res) => {
  const dateStr = String(req.query.date || "").trim()
  if (!dateStr) return res.status(400).json({ message: "date é obrigatório (YYYY-MM-DD)" })

  const d = new Date(dateStr + "T12:00:00.000Z")
  if (Number.isNaN(d.getTime())) return res.status(400).json({ message: "date inválida" })

  // ISO weekday: 0=Seg ... 6=Dom
  const isoWeekday = (d.getUTCDay() + 6) % 7

  const weekStart = new Date(d)
  weekStart.setUTCDate(d.getUTCDate() - isoWeekday)
  weekStart.setUTCHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)

  const posts = await prisma.socialPost.findMany({
    where: {
      scheduledFor: { gte: weekStart, lte: weekEnd }
    },
    include: { client: true, subscription: { include: { client: true } } },
    orderBy: { scheduledFor: "asc" }
  })

  res.json({ from: weekStart, to: weekEnd, posts })
})

/**
 * POST /calendar/generate
 * body: { subscriptionId, year, month, weekdays?: number[] }
 *
 * Regras:
 * - Usa mediaPlan.periodDays como “posts por semana” (1..7)
 * - Se weekdays vazio -> aleatório
 * - Se weekdays tiver menos dias do que X -> completa aleatório dentro da semana
 * - Não duplica (tem @@unique(subscriptionId, scheduledFor) + pre-check)
 */
router.post("/generate", authRequired, requireRole("admin"), async (req, res) => {
  const subscriptionId = String(req.body.subscriptionId || "").trim()
  const year = clampInt(req.body.year, new Date().getUTCFullYear())
  const month = clampInt(req.body.month, new Date().getUTCMonth() + 1)
  const weekdayPick = normalizeWeekdays(req.body.weekdays)

  if (!subscriptionId) {
    return res.status(400).json({ message: "subscriptionId é obrigatório" })
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { client: true, mediaPlan: true }
  })

  if (!sub || !sub.mediaPlan) {
    return res.status(400).json({ message: "Subscrição inválida" })
  }

  const postsPerWeek = Number(sub.mediaPlan.periodDays || 0)

  const from = startOfMonthUTC(year, month)
  const to = endOfMonthExclusiveUTC(year, month)

  // 🔍 evitar duplicados
  const existing = await prisma.socialPost.findMany({
    where: {
      subscriptionId,
      scheduledFor: { gte: from, lt: to }
    },
    select: { scheduledFor: true }
  })

  const existingSet = new Set(
    existing.map(e => e.scheduledFor.toISOString().slice(0, 10))
  )

  // 🔥 DIAS DO MÊS (ISO weekday: 0=Seg ... 6=Dom)
  const totalDays = daysInMonthUTC(year, month)
  const monthDays = []

  for (let day = 1; day <= totalDays; day++) {
    const dt = dateUTCNoon(year, month, day)

    monthDays.push({
      dt,
      isoWeekday: (dt.getUTCDay() + 6) % 7
    })
  }

  // 🔥 FILTRAR DIAS (respeitar escolha do utilizador)
  const toCreateDates = []

  for (const d of monthDays) {
    if (weekdayPick && !weekdayPick.includes(d.isoWeekday)) continue
    toCreateDates.push(d.dt)
  }

  // 🔥 LIMITAR QUANTIDADE (baseado no plano)
 const finalSelection = toCreateDates

  // 🔥 REMOVER DUPLICADOS
  const uniq = new Map()

  for (const d of finalSelection) {
    const key = d.toISOString().slice(0, 10)
    if (!existingSet.has(key)) {
      uniq.set(key, d)
    }
  }

  const finalDates = [...uniq.values()].sort((a, b) => a - b)

  let created = 0

  if (finalDates.length) {
    await prisma.socialPost.createMany({
      data: finalDates.map(d => ({
        subscriptionId,
        clientId: sub.clientId,
        scheduledFor: d,
        status: "novo"
      }))
    })

    created = finalDates.length
  }

  const posts = await prisma.socialPost.findMany({
    where: {
      subscriptionId,
      scheduledFor: { gte: from, lt: to }
    },
    include: { client: true },
    orderBy: { scheduledFor: "asc" }
  })

  res.json({ created, posts })
})
/**
 * PATCH /calendar/:id
 * body: { status }
 */
/**
 * PATCH /calendar/:id
 * body: { status?: "novo|agendado|publicado|cancelado", scheduledFor?: "YYYY-MM-DD" }
 */
router.patch("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params
    const { status, scheduledFor } = req.body

    const data = {}

    if (status) data.status = String(status)

    if (scheduledFor) {
      const s = String(scheduledFor).trim()
      const dt = new Date(s + "T12:00:00.000Z")
      if (Number.isNaN(dt.getTime())) {
        return res.status(400).json({ message: "scheduledFor inválido (YYYY-MM-DD)" })
      }
      data.scheduledFor = dt
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ message: "Nada para atualizar" })
    }

    const updated = await prisma.socialPost.update({
      where: { id },
      data,
      include: { client: true }
    })

    res.json(updated)

  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "Já existe um post para esse cliente nesse dia." })
    }
    console.error(err)
    res.status(500).json({ message: "Erro ao atualizar post" })
  }
})

/**
 * DELETE /calendar/:id
 */
// 1️⃣ BULK PRIMEIRO
router.delete("/bulk", authRequired, requireRole("admin"), async (req, res) => {
    console.log("BODY:", req.body)
  try {
    const { subscriptionId, year, month, mode } = req.body

    if (!subscriptionId || !year || !month) {
      return res.status(400).json({ message: "subscriptionId, year e month são obrigatórios" })
    }

    const y = Number(year)
    const m = Number(month)

    const from = startOfMonthUTC(y, m)
    const to = endOfMonthExclusiveUTC(y, m)

    let result

    if (mode === "month_novo") {
      result = await prisma.socialPost.deleteMany({
        where: {
          subscriptionId,
          status: "novo",
          scheduledFor: { gte: from, lt: to }
        }
      })
    } else {
      result = await prisma.socialPost.deleteMany({
        where: {
          subscriptionId,
          scheduledFor: { gte: from, lt: to }
        }
      })
    }

    return res.json({ deleted: result.count })
  } catch (err) {
    console.error("Erro bulk delete:", err)
    return res.status(500).json({ message: "Erro ao apagar em massa" })
  }
})


// 2️⃣ DEPOIS A ROTA COM PARAM
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  await prisma.socialPost.deleteMany({ where: { id: req.params.id } })
  res.json({ ok: true })
})

/**
 * POST /calendar/manual
 * body: { subscriptionId, date: "YYYY-MM-DD" }
 */
router.post("/manual", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { subscriptionId, date } = req.body

    if (!subscriptionId || !date) {
      return res.status(400).json({ message: "subscriptionId e date são obrigatórios" })
    }

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    })

    if (!sub) {
      return res.status(404).json({ message: "Subscrição não encontrada" })
    }

    const dt = new Date(date + "T12:00:00.000Z")

    const created = await prisma.socialPost.create({
      data: {
        subscriptionId,
        clientId: sub.clientId,
        scheduledFor: dt,
        status: "novo"
      },
      include: { client: true }
    })

    res.json(created)

  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "Já existe um post para este cliente neste dia." })
    }

    console.error(err)
    res.status(500).json({ message: "Erro ao criar post manual" })
  }
})



export default router
