import express from "express"
import prisma from "../prisma.js"
import { authRequired, requireRole } from "../middleware/auth.js"

const router = express.Router()

// GET
router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  const plans = await prisma.mediaPlan.findMany({
    orderBy: { createdAt: "desc" }
  })

  res.json(plans)
})

// CREATE
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  const {
    title,
    description,
    channels,
    periodDays,
    price,
    isActive
  } = req.body

  const plan = await prisma.mediaPlan.create({
    data: {
      title,
      description,
      channels,
      periodDays,
      price,
      isActive
    }
  })

  res.json(plan)
})

// UPDATE
router.put("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const {
    title,
    description,
    channels,
    periodDays,
    price,
    isActive
  } = req.body

  const plan = await prisma.mediaPlan.update({
    where: { id: req.params.id },
    data: {
      title,
      description,
      channels,
      periodDays,
      price,
      isActive
    }
  })

  res.json(plan)
})

// DELETE
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  await prisma.mediaPlan.delete({
    where: { id: req.params.id }
  })

  res.json({ ok: true })
})

export default router