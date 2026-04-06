import bcrypt from "bcryptjs"
import prisma from "../src/prisma.js"

async function main() {
  const password = "admin123"
  const hashed = await bcrypt.hash(password, 10)

  await prisma.user.upsert({
    where: { email: "admin@duit.pt" },
    update: {
      password: hashed,
      role: "admin"
    },
    create: {
      email: "admin@duit.pt",
      password: hashed,
      role: "admin"
    }
  })

  console.log("✅ Admin criado:")
  console.log("Email: admin@duit.pt")
  console.log("Password: admin123")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
