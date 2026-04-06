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

    const clientId = user.client.id

    const projects = await prisma.project.findMany({
      where: {
        clientId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5
    })

    const ticketsOpen = await prisma.ticket.count({
      where: {
        clientId,
        status: {
          not: "fechado"
        }
      }
    })

    const subscription = await prisma.subscription.findFirst({
      where: {
        clientId,
        status: "ativa"
      },
      include: {
        mediaPlan: true
      }
    })

    res.json({
      projects,
      ticketsOpen,
      subscription
    })

  } catch (error) {

    

    res.status(500).json({
      message: error.message
    })

  }
})


router.get("/activity", authRequired, requireRole("client"), async (req, res) => {

  try {

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { client: true }
    })

    const clientId = user.client.id
  

    const scheduled = await prisma.socialPost.count({
      where: {
        clientId,
        status: "agendado"
      }
    })

    const published = await prisma.socialPost.count({
      where: {
        clientId,
        status: "publicado"
      }
    })

    const draft = await prisma.socialPost.count({
      where: {
        clientId,
        status: "novo"
      }
    })

    res.json({
      scheduled,
      published,
      draft
    })

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: "Erro ao carregar atividade"
    })

  }

})
export default router