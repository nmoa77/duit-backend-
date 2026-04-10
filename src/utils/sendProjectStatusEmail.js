import { buildEmailTemplate } from "./emailTemplate.js"

// =========================
// CONFIG
// =========================

const BASE_URL = process.env.APP_URL || "https://cliente.duit.pt"
const BREVO_URL = "https://api.brevo.com/v3/smtp/email"

console.log("APP_URL:", process.env.APP_URL)

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

  const response = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
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

  if (!response.ok) {
    console.error("❌ ERRO BREVO:", data)
    throw new Error(`Brevo ${response.status}: ${JSON.stringify(data)}`)
  }

  console.log("✅ EMAIL ENVIADO:", data)
  return data
}

// =========================
// EMAILS
// =========================

export async function sendProjectStatusEmail({
  to,
  clientName,
  projectName,
  status
}) {
  try {
    const html = buildEmailTemplate({
      title: "Atualização do projeto",
      content: `
        <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>
        <p>O estado do seu projeto <strong>${projectName}</strong> foi atualizado.</p>
        <p><strong>Novo estado:</strong> ${STATUS_LABEL[status] || status}</p>
        <p>Obrigado,<br/>DUIT</p>
      `
    })

    await sendEmail({
      to,
      subject: `Atualização do projeto: ${projectName}`,
      html
    })

    console.log("✅ Email status enviado:", to)
  } catch (err) {
    console.error("❌ Erro sendProjectStatusEmail:", err)
  }
}

export async function sendProjectCreatedEmail({
  to,
  clientName,
  projectName
}) {
  try {
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

    console.log("✅ Email projeto criado enviado:", to)
  } catch (err) {
    console.error("❌ Erro sendProjectCreatedEmail:", err)
  }
}

export async function sendPasswordChangedEmail(to) {
  try {
    const html = buildEmailTemplate({
      title: "Password alterada",
      content: `
        <p>A sua password foi alterada com sucesso.</p>
        <p>Se não foi você, contacte-nos imediatamente.</p>
      `
    })

    await sendEmail({
      to,
      subject: "A sua password foi alterada",
      html
    })

    console.log("✅ Email password enviado:", to)
  } catch (err) {
    console.error("❌ Erro sendPasswordChangedEmail:", err)
  }
}

export async function sendTicketStatusEmail({
  to,
  clientName,
  ticketSubject,
  status,
}) {
  try {
    const html = buildEmailTemplate({
      title: "Atualização do ticket",
      content: `
        <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>
        <p>O estado do seu ticket <strong>${ticketSubject}</strong> foi atualizado.</p>
        <p><strong>Novo estado:</strong> ${TICKET_STATUS_LABEL[status] || status}</p>
        <p>Obrigado,<br/>DUIT</p>
      `
    })

    await sendEmail({
      to,
      subject: `Atualização do ticket: ${ticketSubject}`,
      html
    })

    console.log("✅ Email ticket status enviado:", to)
  } catch (err) {
    console.error("❌ Erro sendTicketStatusEmail:", err)
  }
}

export async function sendActivationEmail({
  to,
  clientName,
  activationLink
}) {
  try {
    console.log("📤 A enviar email para:", to)

    const html = buildEmailTemplate({
      title: "Área de Cliente",
      content: `
        <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>
        <p>Foi criada a sua área de cliente DUIT.<br>

A partir de agora, pode acompanhar os seus pedidos, projetos e toda a comunicação de forma simples e organizada.</p>
        <p>Ative a sua conta:</p>
        <p style="margin-top:20px;">
          <a href="${activationLink}" 
             style="background:#16B3B1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;">
            Para aceder, basta ativar a sua conta aqui:
          </a>
        </p>
        <p>Se tiver alguma questão, estamos desse lado.</p>
      `
    })

    const info = await sendEmail({
      to,
      subject: "A sua área de cliente foi criada",
      html
    })

    console.log("✅ EMAIL ENVIADO:", info)
  } catch (err) {
    console.error("❌ ERRO EMAIL ATIVAÇÃO:", err)
    throw err
  }
}

export async function sendResetPasswordEmail({
  to,
  clientName,
  resetLink
}) {
  try {
    const html = buildEmailTemplate({
      title: "Redefinir password",
      content: `
        <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>

        <p>Para redefinir a sua password:</p>

        <p>
          <a href="${resetLink}" 
             style="background:#16B3B1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;">
            Redefinir password
          </a>
        </p>

        <p>Obrigado,<br/>DUIT</p>
      `
    })

    await sendEmail({
      to,
      subject: "Redefinir password",
      html
    })

    console.log("✅ Email reset enviado:", to)
  } catch (err) {
    console.error("❌ Erro sendResetPasswordEmail:", err)
  }
}

export async function sendTicketReplyEmail({
  to,
  clientName,
  ticketSubject,
  message
}) {
  try {
    const html = buildEmailTemplate({
      title: "Nova resposta no ticket",
      content: `
        <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>

        <p><strong>${ticketSubject}</strong></p>

        <p>${message}</p>

        <p style="margin-top:20px;">
          <a href="${BASE_URL}/tickets"
             style="background:#16B3B1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;">
            Ver ticket
          </a>
        </p>

        <p>Obrigado,<br/>DUIT</p>
      `
    })

    await sendEmail({
      to,
      subject: `Nova resposta: ${ticketSubject}`,
      html
    })

    console.log("✅ Email reply enviado:", to)
  } catch (err) {
    console.error("❌ Erro sendTicketReplyEmail:", err)
  }
}