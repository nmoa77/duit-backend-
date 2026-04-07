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
    .normalize("NFD")                 // remove acentos
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")          // espaços e hífens → _
}


// =========================
// ADMIN
// =========================

// GET /projects
router.get("/:id", authRequired, async (req, res) => {
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
})

// GET /projects/:id
router.get("/:id", authRequired, requireRole("admin"), async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
    client: true

  }

  })

  if (!project) {
    return res.status(404).json({ error: "Projeto não encontrado" })
  }

  res.json(project)
})

// POST /projects
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
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
      },
      include: {
        client: {
          include: {
            users: true
          }
        }
      }
    })

    // 🔥 EMAIL
 project.client?.users?.forEach(user => {

  if (!user.email) return

  // 🔥 BLOQUEIO REAL
  if (!user.notificationsEnabled) return

  sendProjectCreatedEmail({
    to: user.email,
    clientName: project.client?.name || project.client?.company || "",
    projectName: project.name
  })

})

    res.json(project)

  } catch (err) {
    console.error("Erro POST /projects:", err)
    res.status(500).json({ error: "Erro ao criar projeto" })
  }
})


// PUT /projects/:id
router.put("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { name, description, clientId, durationDays, status } = req.body

    const currentProject = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          include: {
            users: true
          }
        }
      }
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


if (oldStatus !== newStatus) {

  const users = currentProject.client?.users || []

  users.forEach(user => {

    if (!user.email) return
    if (!user.notificationsEnabled) return

    sendProjectStatusEmail({
      to: user.email,
      clientName: currentProject.client?.name || currentProject.client?.company || "",
      projectName: project.name,
      status: newStatus
    })

  })

}


    res.json(project)

  } catch (err) {
    console.error("Erro no PUT /projects:", err)
    res.status(500).json({ error: "Erro ao atualizar projeto" })
  }
})

// DELETE /projects/:id
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  await prisma.project.delete({
    where: { id: req.params.id }
  })

  res.json({ ok: true })
})

// =========================
// CLIENT
// =========================

// GET /projects/my
router.get("/my/list", authRequired, async (req, res) => {
  if (!req.user.clientId) {
    return res.json([])
  }

  const projects = await prisma.project.findMany({
    where: { clientId: req.user.clientId },
    orderBy: { createdAt: "desc" }
  })

  res.json(projects)
})

export default router
