import prisma from "../lib/prisma.js"

// Criar ticket
export async function createTicket(req, res) {
  const { subject, description } = req.body
  const user = req.user

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      description,
      clientId: user.id,
    },
  })

  res.json(ticket)
}

// Listar tickets
export async function getTickets(req, res) {
  const user = req.user

  const tickets = await prisma.ticket.findMany({
    where: user.role === "admin" ? {} : { clientId: user.id },
    orderBy: { createdAt: "desc" }
  })

  res.json(tickets)
}

// Obter ticket por ID
export async function getTicketById(req, res) {
  const { id } = req.params
  const user = req.user

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { updates: true }
  })

  if (!ticket) return res.status(404).json({ error: "Não encontrado" })

  if (user.role !== "admin" && ticket.clientId !== user.id) {
    return res.status(403).json({ error: "Sem acesso" })
  }

  res.json(ticket)
}

// Adicionar atualização
export async function addUpdate(req, res) {
  const { id } = req.params
  const { content } = req.body
  const user = req.user

  const update = await prisma.ticketUpdate.create({
    data: {
      ticketId: id,
      author: user.role,
      content,
    },
  })

  

  res.json(update)
}