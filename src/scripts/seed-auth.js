import bcrypt from "bcryptjs"
import prisma from "../prisma.js"

async function run() {
  // ADMIN
  const adminEmail = "admin@duit.pt"
  const adminPass = "Admin123!"

  const adminHash = await bcrypt.hash(adminPass, 10)
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: "admin" },
    create: { email: adminEmail, passwordHash: adminHash, role: "admin" },
  })

  // CLIENT (liga a um client existente se quiseres)
  const clientEmail = "client@duit.pt"
  const clientPass = "Client123!"

  const clientHash = await bcrypt.hash(clientPass, 10)

  // cria um Client se não existir (ajusta campos obrigatórios do teu model Client)
  const client = await prisma.client.create({
    data: {
      // ⚠️ AJUSTA aos campos obrigatórios do teu Client
      // exemplo:
      name: "Cliente Demo",
    },
  })

  await prisma.user.upsert({
    where: { email: clientEmail },
    update: { passwordHash: clientHash, role: "client", client: { connect: { id: client.id } } },
    create: {
      email: clientEmail,
      passwordHash: clientHash,
      role: "client",
      client: { connect: { id: client.id } },
    },
  })

  console.log("Seed OK")
  console.log("ADMIN:", adminEmail, adminPass)
  console.log("CLIENT:", clientEmail, clientPass)
}

run()
  .catch(console.error)
  .finally(async () => prisma.$disconnect())
