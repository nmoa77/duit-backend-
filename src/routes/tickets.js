import express from "express"
import { authRequired } from "../middleware/auth.js"

const router = express.Router()

// LISTAR TICKETS
router.get("/", authRequired, async (req, res) => {
  try {
    const db = await getDB()

    let tickets

    if (req.user.role === "admin") {
      tickets = await db.all(`
        SELECT * FROM Ticket
        ORDER BY updatedAt DESC
      `)
    } else {
      tickets = await db.all(`
        SELECT * FROM Ticket
        WHERE clientId = ?
        ORDER BY updatedAt DESC
      `, [req.user.clientId])
    }

    res.json(tickets)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao listar tickets" })
  }
})


// DETALHE DO TICKET
router.get("/:id", authRequired, async (req, res) => {
  try {
    const db = await getDB()
    const { id } = req.params

    const ticket = await db.get(`
      SELECT * FROM Ticket WHERE id = ?
    `, [id])

    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado" })
    }

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

    const db = await getDB()

    const result = await db.run(`
      INSERT INTO Ticket (
        clientId,
        subject,
        description,
        department,
        priority,
        service,
        status,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, 'aberto', datetime('now'), datetime('now'))
    `, [
      req.user.clientId,
      subject,
      description,
      department || "tecnico",
      priority || "normal",
      service || null
    ])

    res.json({
      id: result.lastID,
      subject,
      description
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao criar ticket" })
  }
})


// RESPONDER
router.post("/:id/updates", authRequired, async (req, res) => {
  try {
    const db = await getDB()
    const { id } = req.params
    const { content } = req.body

    if (!content?.trim()) {
      return res.status(400).json({ error: "Mensagem obrigatória" })
    }

    await db.run(`
      INSERT INTO TicketUpdate (
        ticketId,
        content,
        author,
        userId,
        seen,
        createdAt
      )
      VALUES (?, ?, ?, ?, 0, datetime('now'))
    `, [
      id,
      content,
      req.user.role === "admin" ? "admin" : "client",
      req.user.id
    ])

    await db.run(`
      UPDATE Ticket SET updatedAt = datetime('now')
      WHERE id = ?
    `, [id])

    res.json({ ok: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao responder" })
  }
})


// FECHAR
router.post("/:id/close", authRequired, async (req, res) => {
  try {
    const db = await getDB()
    const { id } = req.params

    await db.run(`
      UPDATE Ticket SET status = 'fechado', updatedAt = datetime('now')
      WHERE id = ?
    `, [id])

    res.json({ ok: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao fechar" })
  }
})


// REABRIR
router.post("/:id/reopen", authRequired, async (req, res) => {
  try {
    const db = await getDB()
    const { id } = req.params

    await db.run(`
      UPDATE Ticket SET status = 'aberto', updatedAt = datetime('now')
      WHERE id = ?
    `, [id])

    res.json({ ok: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao reabrir" })
  }
})

export default router