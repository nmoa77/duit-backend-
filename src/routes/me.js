import express from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import prisma from "../prisma.js"
import { authRequired } from "../middleware/auth.js"

const router = express.Router()

const uploadDir = "uploads/avatars"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/avatars"
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const filename = `avatar-${req.user.id}-${Date.now()}${ext}`
    cb(null, filename)
  }
})

const upload = multer({ storage })

router.get("/", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        client: true,
      },
    })

    if (!user) {
      return res.status(404).json({ error: "Utilizador não encontrado" })
    }

    const displayName =
      user.role === "admin"
        ? "Nuno Alho"
        : user.client?.name || user.client?.company || ""

    res.json({
      id: user.id,
      name: displayName,
      email: user.email || "",
      role: user.role || "",
      avatar: user.avatar || "",
      notificationsEnabled: user.notificationsEnabled ?? true,
    })
  } catch (err) {
    
    res.status(500).json({ error: "Erro ao obter perfil" })
  }
})

router.put("/", authRequired, upload.single("avatar"), async (req, res) => {
  try {
    const { email, notificationsEnabled } = req.body

    const data = {}

    if (typeof email !== "undefined") {
      data.email = email
    }

    if (typeof notificationsEnabled !== "undefined") {
  data.notificationsEnabled =
    notificationsEnabled === "true" || notificationsEnabled === true
}

    if (req.file) {
      data.avatar = req.file.filename
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: {
        client: true,
      },
    })

    const displayName =
      updated.role === "admin"
        ? "Nuno Alho"
        : updated.client?.name || updated.client?.company || ""

    res.json({
      id: updated.id,
      name: displayName,
      email: updated.email || "",
      role: updated.role || "",
      avatar: updated.avatar || "",
      notificationsEnabled: updated.notificationsEnabled ?? true,
    })
  } catch (err) {
    

    if (err.code === "P2002") {
      return res.status(400).json({
        error: "Este email já está a ser utilizado por outra conta.",
      })
    }

    res.status(500).json({ error: "Erro ao atualizar perfil" })
  }
})

export default router