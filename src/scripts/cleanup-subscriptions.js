import prisma from "../prisma.js"

async function main() {
  const clientId = process.argv[2]

  if (!clientId) {
    console.error("Falta o clientId.")
    console.error("Uso: node src/scripts/cleanup-subscriptions.js <clientId>")
    process.exit(1)
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { clientId },
    orderBy: {
      createdAt: "desc"
    },
    include: {
      mediaPlan: true,
      services: true,
      socialPosts: true
    }
  })

  if (subscriptions.length === 0) {
    console.log("Nenhuma subscrição encontrada para este cliente.")
    return
  }

  console.log(`Cliente: ${clientId}`)
  console.log(`Encontradas ${subscriptions.length} subscrições.`)

  subscriptions.forEach((sub, index) => {
    console.log(
      `${index === 0 ? "[MANTER]" : "[APAGAR]"} ${sub.id} | ${sub.mediaPlan?.title || "-"} | ${sub.status} | ${sub.createdAt.toISOString()}`
    )
  })

  const keep = subscriptions[0]
  const toDelete = subscriptions.slice(1)

  if (toDelete.length === 0) {
    console.log("Só existe uma subscrição. Nada para limpar.")
    return
  }

  for (const sub of toDelete) {
    console.log(`\nA limpar subscrição: ${sub.id}`)

    const deletedServices = await prisma.subscriptionService.deleteMany({
      where: {
        subscriptionId: sub.id
      }
    })

    console.log(`- SubscriptionService apagados: ${deletedServices.count}`)

    const deletedPosts = await prisma.socialPost.deleteMany({
      where: {
        subscriptionId: sub.id
      }
    })

    console.log(`- SocialPost apagados: ${deletedPosts.count}`)

    await prisma.subscription.delete({
      where: {
        id: sub.id
      }
    })

    console.log(`- Subscrição apagada: ${sub.id}`)
  }

  console.log(`\nLimpeza concluída.`)
  console.log(`Subscrição mantida: ${keep.id}`)
}

main()
  .catch((err) => {
    console.error("Erro ao limpar subscrições:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })