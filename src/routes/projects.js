import express from "express"
import prisma from "../prisma.js"
import { authRequired, requireRole } from "../middleware/auth.js"
import {
  sendProjectStatusEmail,
  sendProjectCreatedEmail
} from "../utils/sendProjectStatusEmail.js"

const router = express.Router()

function normalizeProjectStatus(status) {
  if (!status) return "novo"

  return String(status)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
}


// =========================
// CLIENT - LISTA PRÓPRIA
// =========================

router.get("/my/list", authRequired, async (req, res) => {
  try {
    if (!req.user.clientId) {
      return res.json([])
    }

    const projects = await prisma.project.findMany({
      where: { clientId: req.user.clientId },
      orderBy: { createdAt: "desc" }
    })

    res.json(projects)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao listar projetos do cliente" })
  }
})


// =========================
// LISTAGEM GERAL
// =========================

router.get("/", authRequired, async (req, res) => {
  try {
    let where = {}

    if (req.user.role === "client") {
      where.clientId = req.user.clientId
    }

    const projects = await prisma.project.findMany({
      where,
      include: { client: true },
      orderBy: { createdAt: "desc" }
    })

    res.json(projects)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao listar projetos" })
  }
})


// =========================
// DETALHE
// =========================

router.get("/:id", authRequired, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { client: true }
    })

    if (!project) {
      return res.status(404).json({ error: "Projeto não encontrado" })
    }

    if (
      req.user.role === "client" &&
      project.clientId !== req.user.clientId
    ) {
      return res.status(403).json({ error: "Sem acesso" })
    }

    res.json(project)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao obter projeto" })
  }
})


// =========================
// CRIAR PROJETO
// =========================

router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    console.log("🔥 CREATE PROJECT")

    const {
      name,
      description,
      clientId,
      durationDays,
      status
    } = req.body

    if (!clientId) {
      return res.status(400).json({ error: "clientId é obrigatório" })
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        clientId,
        durationDays: durationDays ? Number(durationDays) : null,
        status: status || "novo"
      }
    })

    console.log("✅ PROJETO CRIADO:", project.id)

    // 🔥 buscar users corretamente (sem depender de include)
    const users = await prisma.user.findMany({
      where: { clientId: project.clientId }
    })

    console.log("👥 USERS ENCONTRADOS:", users.length)

    for (const user of users) {
      if (!user.email) continue
     if (user.notificationsEnabled === false) continue

      console.log("📤 A enviar email para:", user.email)

      await sendProjectCreatedEmail({
        to: user.email,
        clientName: user.name || "",
        projectName: project.name
      })
    }

    res.json(project)

  } catch (err) {
    console.error("❌ ERRO CREATE PROJECT:", err)
    res.status(500).json({ error: "Erro ao criar projeto" })
  }
})


// =========================
// EDITAR PROJETO
// =========================

router.put("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { name, description, clientId, durationDays, status } = req.body

    const currentProject = await prisma.project.findUnique({
      where: { id: req.params.id }
    })

    if (!currentProject) {
      return res.status(404).json({ error: "Projeto não encontrado" })
    }

    const oldStatus = currentProject.status
    const newStatus = typeof status === "string"
      ? normalizeProjectStatus(status)
      : currentProject.status

    const updateData = {}

    if (typeof name === "string") updateData.name = name
    if (typeof description === "string") updateData.description = description

    if (durationDays !== undefined) {
      updateData.durationDays = durationDays
        ? Number(durationDays)
        : null
    }

    if (typeof status === "string") {
      updateData.status = normalizeProjectStatus(status)
    }

    if (typeof clientId === "string" && clientId.length > 0) {
      updateData.clientId = clientId
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: updateData
    })

    // 🔥 EMAIL STATUS
    if (oldStatus !== newStatus) {

      const users = await prisma.user.findMany({
        where: { clientId: project.clientId }
      })

      for (const user of users) {
        if (!user.email) continue
        if (!user.notificationsEnabled) continue

        console.log("📤 STATUS EMAIL para:", user.email)

        await sendProjectStatusEmail({
          to: user.email,
          clientName: user.name || "",
          projectName: project.name,
          status: newStatus
        })
      }
    }

    res.json(project)

  } catch (err) {
    console.error("❌ ERRO UPDATE PROJECT:", err)
    res.status(500).json({ error: "Erro ao atualizar projeto" })
  }
})


// =========================
// DELETE
// =========================

router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    await prisma.project.delete({
      where: { id: req.params.id }
    })

    res.json({ ok: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao apagar projeto" })
  }
})

export default router