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
// CLIENT
// =========================

// GET /projects/my/list
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
// LISTAGEM GERAL (🔥 FALTAVA ISTO)
// =========================

// GET /projects
router.get("/", authRequired, async (req, res) => {
  try {
    let where = {}

    // cliente só vê os seus
    if (req.user.role === "client") {
      where.clientId = req.user.clientId
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: true
      },
      orderBy: {
        createdAt: "desc"
      }
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

// GET /projects/:id
router.get("/:id", authRequired, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { client: true }
    })

    if (!project) {
      return res.status(404).json({ error: "Projeto não encontrado" })
    }

    // cliente só pode ver o seu
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
// CRIAR
// =========================

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

    // EMAIL
    project.client?.users?.forEach(user => {
      if (!user.email) return
      if (!user.notificationsEnabled) return
console.log("📤 A ENTRAR NO BLOCO DE EMAIL")
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


// =========================
// EDITAR
// =========================

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

    // EMAIL STATUS
    if (oldStatus !== newStatus) {
      const users = currentProject.client?.users || []
console.log("📤 A ENTRAR NO BLOCO DE EMAIL")
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


// =========================
// DELETE
// =========================

// DELETE /projects/:id
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