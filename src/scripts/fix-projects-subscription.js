import prisma from "../prisma.js"

const LEGACY_PLAN_ID = "cmli9p4d90000k55uhqqj8eeb"

async function run() {
  const projects = await prisma.project.findMany({
    where: { subscriptionId: null }
  })

  for (const project of projects) {
    const subscription = await prisma.subscription.create({
      data: {
        clientId: project.clientId,
        mediaPlanId: LEGACY_PLAN_ID,
        status: "active",
        totalPrice: 0
      }
    })

    await prisma.project.update({
      where: { id: project.id },
      data: { subscriptionId: subscription.id }
    })
  }

  console.log("Projetos ligados a subscrição legacy.")
}

run()
