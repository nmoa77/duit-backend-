import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = "admin@duit.pt"
  const plainPassword = "Admin12345!"

  const existing = await prisma.user.findUnique({
    where: { email }
  })

  if (existing) {
    console.log(`Já existe utilizador com o email ${email}`)
    return
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10)

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: "admin",
      name: "Nuno Admin"
    }
  })

  console.log("Admin criado com sucesso:")
  console.log({
    id: user.id,
    email: user.email,
    password: plainPassword
  })
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })