import express from "express"
import prisma from "../prisma.js"
import { authRequired, requireRole } from "../middleware/auth.js"

const router = express.Router()

function toCents(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return Math.round(value * 100)

  const n = Number(String(value).replace(",", "."))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

// LISTAR (ADMIN)
router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.query

    const where = {}

    if (status) {
      where.status = status
    }

 const subscriptions = await prisma.subscription.findMany({
  where,
  include: {
    client: true,
    mediaPlan: true,
    services: {
      include: {
        service: true
      }
    }
  },
  orderBy: {
    createdAt: "desc",
  },
})

    res.json({ subscriptions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Erro ao listar subscrições" })
  }
})

// DETALHE (ADMIN)
router.get("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        client: true,
        mediaPlan: true,
        services: {
          include: {
            service: true,
          },
        },
      },
    })

    if (!subscription) {
      return res.status(404).json({
        message: "Subscrição não encontrada",
      })
    }

    const history = await prisma.subscription.findMany({
      where: {
        clientId: subscription.clientId,
      },
      include: {
        mediaPlan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    res.json({
      subscription,
      history,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Erro ao obter detalhe da subscrição" })
  }
})

// CRIAR (ADMIN)
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { clientId, mediaPlanId, serviceIds = [] } = req.body

    if (!clientId || !mediaPlanId) {
      return res.status(400).json({ message: "Dados inválidos" })
    }

    const plan = await prisma.mediaPlan.findUnique({
      where: { id: mediaPlanId },
    })

    if (!plan) {
      return res.status(404).json({ message: "Plano não encontrado" })
    }

    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
      },
    })

    const servicesTotal = services.reduce(
      (sum, s) => sum + toCents(s.price),
      0
    )

    const totalPrice = plan.basePrice + servicesTotal

    await prisma.subscription.updateMany({
      where: {
        clientId,
        status: {
          in: ["ativa", "cancel_request"],
        },
      },
      data: {
        status: "cancelada",
        cancelRequestedAt: new Date(),
      },
    })

    const subscription = await prisma.subscription.create({
      data: {
        clientId,
        mediaPlanId,
        status: "ativa",
      },
    })

    if (serviceIds.length > 0) {
      await prisma.subscriptionService.createMany({
        data: serviceIds.map((serviceId) => ({
          subscriptionId: subscription.id,
          serviceId,
        })),
      })
    }

    const full = await prisma.subscription.findUnique({
      where: { id: subscription.id },
      include: {
        client: true,
        mediaPlan: true,
        services: {
          include: {
            service: true,
          },
        },
      },
    })

    res.json(full)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Erro ao criar subscrição" })
  }
})

// ATUALIZAR / MUDAR ESTADO (ADMIN)
router.put("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params
    const { clientId, mediaPlanId, serviceIds, status } = req.body

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        services: true,
      },
    })

    if (!subscription) {
      return res.status(404).json({ message: "Subscrição não encontrada" })
    }

    // CANCELAR
    if (status === "cancelada") {
      const cancelled = await prisma.subscription.update({
        where: { id },
        data: {
          status: "cancelada",
          cancelRequestedAt: new Date(),
        },
      })

      return res.json(cancelled)
    }

 // REATIVAR
if (status === "ativa") {

  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      status: "ativa",
      cancelRequestedAt: null
    }
  })

  return res.json(updated)
}

    // EDIÇÃO COMPLETA
    if (!mediaPlanId) {
      return res.status(400).json({
        message: "Plano obrigatório para editar subscrição",
      })
    }

    const plan = await prisma.mediaPlan.findUnique({
      where: { id: mediaPlanId },
    })

    if (!plan) {
      return res.status(404).json({ message: "Plano não encontrado" })
    }

    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds || [] },
      },
    })

    const servicesTotal = services.reduce(
      (sum, s) => sum + toCents(s.price),
      0
    )

    const totalPrice = plan.basePrice + servicesTotal

    await prisma.subscription.update({
      where: { id },
      data: {
        clientId: clientId ?? subscription.clientId,
        mediaPlanId,
        status: status ?? subscription.status,
      },
    })

    await prisma.subscriptionService.deleteMany({
      where: { subscriptionId: id },
    })

    if (serviceIds?.length > 0) {
      await prisma.subscriptionService.createMany({
        data: serviceIds.map((serviceId) => ({
          subscriptionId: id,
          serviceId,
        })),
      })
    }

    const full = await prisma.subscription.findUnique({
      where: { id },
      include: {
        client: true,
        mediaPlan: true,
        services: {
          include: {
            service: true,
          },
        },
      },
    })

    res.json(full)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Erro ao atualizar subscrição" })
  }
})

export default router