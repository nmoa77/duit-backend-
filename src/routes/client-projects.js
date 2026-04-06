import express from "express"
import prisma from "../prisma.js"
import { authRequired } from "../middleware/auth.js"

const router = express.Router()

router.get("/", authRequired, async (req, res) => {

  try {

 const user = await prisma.user.findUnique({
  where: { id: req.user.id },
  include: { client: true }
})

if (!user) {
  return res.status(404).json({ message: "Utilizador não encontrado" })
}

if (!user.client) {
  return res.status(403).json({ message: "Este utilizador não tem cliente associado" })
}

    const projects = await prisma.project.findMany({
      where: {
        clientId: user.client.id
      },
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
    res.status(500).json({ message: "Erro ao carregar projetos" })
  }

})


router.get("/:id", authRequired, async (req, res) => {
  try {

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { client: true }
    })

const project = await prisma.project.findFirst({
  where: {
    id: req.params.id,
    clientId: user.client.id
  },
  include: {
    client: true,
    notes: {
      orderBy: {
        createdAt: "desc"
      }
    }
  }
})

    if (!project) {
      return res.status(404).json({ message: "Projeto não encontrado" })
    }

const timeline = []

timeline.push({
  type: "project_created",
  date: project.createdAt,
  text: "Projeto criado"
})

project.notes.forEach(note => {
  timeline.push({
    type: "note",
    date: note.createdAt,
    text: "Nova nota do administrador"
  })
})

timeline.sort((a,b)=> new Date(b.date) - new Date(a.date))

project.timeline = timeline


    res.json(project)

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Erro ao carregar projeto" })
  }
})

export default router