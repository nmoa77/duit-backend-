import express from "express"
import prisma from "../prisma.js"
import { authRequired, requireRole } from "../middleware/auth.js"

const router = express.Router()


router.get("/", authRequired, requireRole("client"), async (req, res) => {
  try {

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { client: true }
    })

    if (!user || !user.client) {
      return res.status(403).json({
        error: "Cliente não associado ao utilizador"
      })
    }

    // ✅ 1. Buscar subscription (SEM subject)
    const subscription = await prisma.subscription.findFirst({
      where: {
        clientId: user.client.id
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        mediaPlan: true,
        services: {
          include: {
            service: true
          }
        }
      }
    })

    // ✅ 2. Buscar ticket de reativação (SEPARADO)
    const reactivationTicket = await prisma.ticket.findFirst({
      where: {
        clientId: user.client.id,
        subject: {
          contains: "reativação"
        }
      }
    })

    // ✅ 3. Enviar tudo junto
    res.json({
      ...subscription,
      reactivationRequested: !!reactivationTicket
    })

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: "Erro ao carregar subscrição"
    })

  }
})


router.post(
  "/cancel-request",
  authRequired,
  requireRole("client"),
  async (req, res) => {

    try {

      const { reason } = req.body

      if (!reason) {
        return res.status(400).json({
          error: "Motivo obrigatório"
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { client: true }
      })

      if (!user || !user.client) {
        return res.status(403).json({
          error: "Cliente não associado"
        })
      }

      const clientId = user.client.id

      await prisma.subscription.updateMany({
        where: {
          clientId: clientId,
          status: "ativa"
        },
        data: {
          status: "cancel_request",
          cancelReason: reason,
          cancelRequestedAt: new Date()
        }
      })

await prisma.ticket.create({
  data: {
    clientId: clientId,
    subject: "Pedido de cancelamento da subscrição",
    description: reason || "Pedido de cancelamento",

    department: "financeiro",
    priority: "normal",

    updates: {
      create: {
        content: reason || "Pedido de cancelamento",
        author: "client",
        userId: req.user.id
      }
    }
  }
})

      res.json({ success: true })

    } catch (err) {

      console.error(err)

      res.status(500).json({
        error: "Erro ao enviar pedido"
      })

    }

  }
)

export default router