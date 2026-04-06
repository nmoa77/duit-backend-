import prisma from "../prisma.js"

async function main() {
  const client = await prisma.client.findFirst({
    where: { id: 3 },
  })

  if (!client) {
    console.log("❌ Cliente não encontrado")
    return
  }

  await prisma.subscription.deleteMany({
    where: { clientId: client.id },
  })

  const subscription = await prisma.subscription.create({
    data: {
      clientId: client.id,
      status: "active",
    },
  })

  console.log("✅ Subscrição criada:", subscription)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
