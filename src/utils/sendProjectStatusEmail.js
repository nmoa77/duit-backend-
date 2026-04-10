import { buildEmailTemplate } from "./emailTemplate.js"

// =========================
// CONFIG
// =========================

const BASE_URL = process.env.APP_URL || "https://cliente.duit.pt"
const BREVO_URL = "https://api.brevo.com/v3/smtp/email"

// =========================
// LABELS
// =========================

const STATUS_LABEL = {
  novo: "Novo",
  em_analise: "Em análise",
  em_producao: "Em produção",
  revisao_final: "Revisão final",
  concluido: "Concluído"
}

const TICKET_STATUS_LABEL = {
  aberto: "Aberto",
  respondido: "Respondido",
  cliente_respondeu: "Cliente respondeu",
  fechado: "Fechado"
}

// =========================
// HELPER
// =========================

async function sendEmail({ to, subject, html }) {

  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY não definida")
  }

  if (!process.env.SMTP_FROM) {
    throw new Error("SMTP_FROM não definido")
  }

  const payload = {
    sender: {
      name: "DUIT",
      email: process.env.SMTP_FROM
    },
    to: [{ email: to }],
    subject,
    htmlContent: html
  }

  console.log("📤 A ENVIAR PARA BREVO:", to)

  const response = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY
    },
    body: JSON.stringify(payload)
  })

  const text = await response.text()

  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  console.log("📡 STATUS:", response.status)
  console.log("📩 BODY:", data)

  if (!response.ok) {
    throw new Error(`Brevo ${response.status}: ${JSON.stringify(data)}`)
  }

  console.log("✅ EMAIL ENVIADO:", to)
  return data
}

// =========================
// EMAILS
// =========================

export async function sendProjectCreatedEmail({
  to,
  clientName,
  projectName
}) {
  try {

    console.log("🚀 A ENTRAR NO EMAIL DE PROJETO CRIADO")

    const html = buildEmailTemplate({
      title: "Novo projeto criado",
      content: `
        <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>
        <p>Foi criado um novo projeto na sua área.</p>
        <p><strong>${projectName}</strong></p>

        <p style="margin-top:20px;">
          <a href="${BASE_URL}/projects" 
             style="background:#16B3B1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;">
            Ver projeto
          </a>
        </p>

        <p style="margin-top:20px;">Obrigado,<br/>DUIT</p>
      `
    })

    await sendEmail({
      to,
      subject: `Novo projeto criado: ${projectName}`,
      html
    })

  } catch (err) {
    console.error("❌ ERRO REAL:", err.message)
  }
}