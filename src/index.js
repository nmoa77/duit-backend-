import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

import authRoutes from "./routes/auth.js"
import clientsRoutes from "./routes/clients.js"
import projectsRoutes from "./routes/projects.js"
import mediaPlansRoutes from "./routes/media-plans.js"
import servicesRoutes from "./routes/services.js"
import adminSubscriptionsRoutes from "./routes/admin-subscriptions.js"
import socialPostsRoutes from "./routes/social-posts.js"
import calendarRoutes from "./routes/calendar.js"
import ticketsRoutes from "./routes/tickets.js"
import meRoutes from "./routes/me.js"
import clientDashboardRoutes from "./routes/client-dashboard.js"
import clientProjectsRoutes from "./routes/client-projects.js"
import clientProjectNotesRoutes from "./routes/client-project-notes.js"
import clientSubscriptionsRoutes from "./routes/client-subscriptions.js"

import { authRequired } from "./middleware/auth.js"

const app = express()

// ✅ CORS

app.use(cors({
  origin: "https://cliente.duit.pt",
  credentials: true
}))

app.use(express.json())
app.use(cookieParser())

// 🔐 AUTH
app.use("/api/auth", authRoutes)

// 🔐 PROTEGIDAS
app.use("/api/clients", authRequired, clientsRoutes)
app.use("/api/media-plans", authRequired, mediaPlansRoutes)
app.use("/api/projects", authRequired, projectsRoutes)
app.use("/api/services", authRequired, servicesRoutes)
app.use("/api/social-posts", authRequired, socialPostsRoutes)
app.use("/api/calendar", authRequired, calendarRoutes)
app.use("/api/tickets", ticketsRoutes)
app.use("/api/me", authRequired, meRoutes)

app.use("/api/client-dashboard", authRequired, clientDashboardRoutes)
app.use("/api/admin/subscriptions", authRequired, adminSubscriptionsRoutes)
app.use("/api/client-projects", authRequired, clientProjectsRoutes)
app.use("/api/client-subscriptions", authRequired, clientSubscriptionsRoutes)
app.use("/api/client-project-notes", authRequired, clientProjectNotesRoutes)

// 📁 STATIC
app.use("/uploads", express.static("uploads"))

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Backend a correr na porta ${PORT}`)
})