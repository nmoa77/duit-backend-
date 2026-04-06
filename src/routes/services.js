import { Router } from "express"
import prisma from "../prisma.js"
import { authRequired, requireRole } from "../middleware/auth.js"

const router = Router()

// ======================
// LISTAR
// ======================
router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  const services = await prisma.service.findMany({
    orderBy: { name: "asc" }
  })

  res.json(services)
})

// ======================
// OBTER POR ID
// ======================
router.get("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const service = await prisma.service.findUnique({
    where: { id: req.params.id }
  })

  if (!service) {
    return res.status(404).json({ error: "Serviço não encontrado" })
  }

  res.json(service)
})

// ======================
// CRIAR
// ======================
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  const { name, price, billing } = req.body

  const service = await prisma.service.create({
    data: {
      name,
      price: parseFloat(price)
    }
  })

  res.json(service)
})

// ======================
// UPDATE
// ======================
router.put("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const { name, price, billing } = req.body

  const service = await prisma.service.update({
    where: { id: req.params.id },
    data: {
      name,
      price: parseFloat(price)
    }
  })

  res.json(service)
})

// ======================
// DELETE
// ======================
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  await prisma.service.delete({
    where: { id: req.params.id }
  })

  res.json({ ok: true })
})

export default router
