import brevo from "@getbrevo/brevo"
import { buildEmailTemplate } from "./emailTemplate.js"

// =========================
// CONFIG
// =========================

const BASE_URL = process.env.APP_URL || "http://localhost:5173"

const apiInstance = new brevo.TransactionalEmailsApi()
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

console.log("BREVO CONFIG:", {
  from: process.env.SMTP_FROM,
  appUrl: process.env.APP_URL,
  hasApiKey: Boolean(process.env.BREVO_API_KEY)
})

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
  try {
    const email = new brevo.SendSmtpEmail()

    email.subject = subject
    email.htmlContent = html
    email.sender = {
      name: "DUIT",
      email: process.env.SMTP_FROM
    }
    email.to = [{ email: to }]

    const result = await apiInstance.sendTransacEmail(email)

    console.log("✅ EMAIL ENVIADO:", result?.body || result)
    return result
  } catch (err) {
    console.error("❌ ERRO EMAIL:", err?.response?.body || err.message || err)
    throw err
  }
}

// =========================
// EMAILS
// =========================

// 🔹 STATUS PROJETO
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

// 🔹 PROJETO CRIADO
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
          <a href="${BASE_URL}/client/projects" 
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

// 🔹 PASSWORD ALTERADA
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

// 🔹 STATUS TICKET
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

// 🔹 ATIVAÇÃO
export async function sendActivationEmail({
  to,
  clientName,
  activationLink
}) {
  try {
    console.log("📤 A enviar email para:", to)

    const html = buildEmailTemplate({
      title: "Ative a sua conta",
      content: `
        <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>
        <p>Ative a sua conta:</p>
        <p style="margin-top:20px;">
          <a href="${activationLink}" 
             style="background:#16B3B1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;">
            Ativar conta
          </a>
        </p>
      `
    })

    await sendEmail({
      to,
      subject: "Ative a sua conta",
      html
    })

    console.log("✅ EMAIL ENVIADO:", to)
  } catch (err) {
    console.error("❌ ERRO EMAIL ATIVAÇÃO:", err)
    throw err
  }
}

// 🔹 RESET PASSWORD
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

// 🔹 RESPOSTA TICKET
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
          <a href="${BASE_URL}/client/tickets"
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