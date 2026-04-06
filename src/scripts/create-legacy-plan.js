import prisma from "../prisma.js"

async function run() {
  const plan = await prisma.mediaPlan.create({
    data: {
      title: "Plano Legacy",
      description: "Plano interno para projetos antigos",
      postsPerMonth: 0,
      channels: "—",
      periodDays: 0,
      basePrice: 0,
      isActive: false
    }
  })

  console.log("LEGACY PLAN ID:", plan.id)
}

run()
