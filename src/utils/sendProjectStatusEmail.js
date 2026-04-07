import nodemailer from "nodemailer"
import { buildEmailTemplate } from "./emailTemplate.js"

// =========================
// CONFIG
// =========================

const BASE_URL = process.env.APP_URL || "http://localhost:5173"

// ✅ TRANSPORTER (BREVO)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true, // 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

// 🔥 DEBUG SMTP
console.log("SMTP CONFIG:", {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER
})

// 🔥 TESTE DE CONEXÃO
transporter.verify()
  .then(() => console.log("✅ SMTP pronto"))
  .catch(err => console.error("❌ SMTP ERRO:", err))


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
  fechado: "Fechado",
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

    await transporter.sendMail({
      from: `"DUIT" <${process.env.SMTP_FROM}>`,
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

    await transporter.sendMail({
      from: `"DUIT" <${process.env.SMTP_FROM}>`,
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

    await transporter.sendMail({
      from: `"DUIT" <${process.env.SMTP_FROM}>`,
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

    await transporter.sendMail({
      from: `"DUIT" <${process.env.SMTP_FROM}>`,
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

    const info = await transporter.sendMail({
      from: `"DUIT" <${process.env.SMTP_FROM}>`,
      to,
      subject: "Ative a sua conta",
      html: `
        <h2>Olá ${clientName}</h2>
        <p>Ative a sua conta:</p>
        <a href="${activationLink}">Ativar conta</a>
      `
    })

    console.log("✅ EMAIL ENVIADO:", info.messageId)

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

    await transporter.sendMail({
      from: `"DUIT" <${process.env.SMTP_FROM}>`,
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

    await transporter.sendMail({
      from: `"DUIT" <${process.env.SMTP_FROM}>`,
      to,
      subject: `Nova resposta: ${ticketSubject}`,
      html
    })

    console.log("✅ Email reply enviado:", to)

  } catch (err) {
    console.error("❌ Erro sendTicketReplyEmail:", err)
  }
}