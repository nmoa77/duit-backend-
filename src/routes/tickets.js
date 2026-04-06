import express from "express"
import prisma from "../prisma.js"
import { authRequired } from "../middleware/auth.js"
import { sendTicketReplyEmail } from "../utils/sendProjectStatusEmail.js"

const router = express.Router()


// LISTAR TICKETS
router.get("/", authRequired, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin"

    const where = isAdmin
      ? {}
      : { clientId: req.user.clientId }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        client: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        },
        updates: {
          select: {
            id: true,
            author: true,
            seen: true,
            createdAt: true
          },
          orderBy: { createdAt: "asc" }
        }
      }
    })

    const mapped = tickets.map((ticket) => ({
      ...ticket,
      hasUnreadClientMessage: isAdmin
        ? ticket.updates.some(u => u.author === "client" && !u.seen)
        : ticket.updates.some(u => u.author === "admin" && !u.seen)
    }))

    res.json(mapped)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao listar tickets" })
  }
})


// DETALHE DO TICKET
router.get("/:id", authRequired, async (req, res) => {
  try {
    const { id } = req.params
    const isAdmin = req.user.role === "admin"

    const existing = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, clientId: true }
    })

    if (!existing) return res.status(404).json({ error: "Ticket não encontrado" })

    if (!isAdmin && existing.clientId !== req.user.clientId) {
      return res.status(403).json({ error: "Sem permissão" })
    }

    await prisma.ticketUpdate.updateMany({
      where: {
        ticketId: id,
        author: isAdmin ? "client" : "admin",
        seen: false
      },
      data: { seen: true }
    })

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        },
        updates: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    })

    res.json(ticket)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao carregar ticket" })
  }
})


// CRIAR TICKET
router.post("/", authRequired, async (req, res) => {
  try {
    const { subject, description, department, priority, service } = req.body

    if (!req.user.clientId) {
      return res.status(403).json({ error: "Cliente não associado" })
    }

    const ticket = await prisma.ticket.create({
      data: {
        clientId: req.user.clientId,
        subject,
        description,
        department: department || "tecnico",
        priority: priority || "normal",
        service: service || null,
        updates: {
          create: {
            author: "client",
            content: description,
            userId: req.user.id,
            seen: false
          }
        }
      }
    })

    res.status(201).json(ticket)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao criar ticket" })
  }
})


// RESPONDER A TICKET
router.post("/:id/updates", authRequired, async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body

    if (!content?.trim()) {
      return res.status(400).json({ error: "Mensagem obrigatória" })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, clientId: true }
    })

    if (!ticket) return res.status(404).json({ error: "Ticket não encontrado" })

    const isAdmin = req.user.role === "admin"

    if (!isAdmin && ticket.clientId !== req.user.clientId) {
      return res.status(403).json({ error: "Sem permissão" })
    }

    await prisma.ticketUpdate.create({
      data: {
        ticketId: id,
        content,
        author: isAdmin ? "admin" : "client",
        userId: req.user.id,
        seen: false
      }
    })

    await prisma.ticket.update({
      where: { id },
      data: { updatedAt: new Date() }
    })


    // 🔥 NOTIFICAÇÃO
    if (isAdmin) {

      const ticketWithUsers = await prisma.ticket.findUnique({
        where: { id },
        include: {
          client: {
            include: {
              users: {
                select: {
                  id: true,
                  email: true,
                  notificationsEnabled: true
                }
              }
            }
          }
        }
      })

      const users = ticketWithUsers?.client?.users || []

      for (const user of users) {

        if (!user.email) continue
        if (!user.notificationsEnabled) continue
        if (user.id === req.user.id) continue

        await sendTicketReplyEmail({
          to: user.email,
          clientName: ticketWithUsers.client?.name || ticketWithUsers.client?.company || "",
          ticketSubject: ticketWithUsers.subject,
          message: content
        })
      }
    }


    const updatedTicket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        },
        updates: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    })

    res.json(updatedTicket)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao responder ao ticket" })
  }
})


// FECHAR
router.post("/:id/close", authRequired, async (req, res) => {
  try {
    const { id } = req.params

    await prisma.ticket.update({
      where: { id },
      data: { status: "fechado", updatedAt: new Date() }
    })

    const updated = await prisma.ticket.findUnique({
      where: { id },
      include: { updates: true }
    })

    res.json(updated)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao fechar ticket" })
  }
})


// REABRIR
router.post("/:id/reopen", authRequired, async (req, res) => {
  try {
    const { id } = req.params

    await prisma.ticket.update({
      where: { id },
      data: { status: "aberto", updatedAt: new Date() }
    })

    const updated = await prisma.ticket.findUnique({
      where: { id },
      include: { updates: true }
    })

    res.json(updated)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao reabrir ticket" })
  }
})

export default router