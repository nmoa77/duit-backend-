import nodemailer from "nodemailer"
import { buildEmailTemplate } from "./emailTemplate.js"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

const STATUS_LABEL = {
  novo: "Novo",
  em_analise: "Em análise",
  em_producao: "Em produção",
  revisao_final: "Revisão final",
  concluido: "Concluído"
}

console.log("SMTP CONFIG:", {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER
})


export async function sendProjectStatusEmail({
  to,
  clientName,
  projectName,
  status
}) {
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
}

export async function sendProjectCreatedEmail({
  to,
  clientName,
  projectName
}) {
  const html = buildEmailTemplate({
    title: "Novo projeto criado",
    content: `
      <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>

      <p>Foi criado um novo projeto na sua área.</p>

      <p><strong>${projectName}</strong></p>

      <p>Pode acompanhar o progresso diretamente no seu portal.</p>

      <p style="margin-top:20px;">
        <a href="http://localhost:5173/client/projects" 
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
}


export async function sendPasswordChangedEmail(to) {
  const html = buildEmailTemplate({
    title: "Password alterada",
    content: `
      <p>A sua password foi alterada com sucesso.</p>
      <p>Se não foi você que efetuou esta alteração, contacte-nos imediatamente.</p>
    `
  })

  await transporter.sendMail({
    from: `"DUIT" <${process.env.SMTP_FROM}>`,
    to,
    subject: "A sua password foi alterada",
    html
  })
}


const TICKET_STATUS_LABEL = {
  aberto: "Aberto",
  respondido: "Respondido",
  cliente_respondeu: "Cliente respondeu",
  fechado: "Fechado",
}

export async function sendTicketStatusEmail({
  to,
  clientName,
  ticketSubject,
  status,
}) {
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
}

export async function sendActivationEmail({
  to,
  clientName,
  activationLink
}) {
  const html = buildEmailTemplate({
    title: "Acesso ao portal DUIT",
    content: `
      <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>

      <p>Foi criada uma área de cliente para si na plataforma DUIT.</p>

      <p>Para aceder, deve definir a sua password através do botão abaixo:</p>

      <p style="margin:20px 0;">
        <a href="${activationLink}" 
           style="background:#16B3B1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;">
          Definir password
        </a>
      </p>

      <p>Se não solicitou este acesso, pode ignorar este email.</p>

      <p>Obrigado,<br/>DUIT</p>
    `
  })

  await transporter.sendMail({
    from: `"DUIT" <${process.env.SMTP_FROM}>`,
    to,
    subject: "Acesso ao portal DUIT",
    html
  })
}


export async function sendResetPasswordEmail({
  to,
  clientName,
  resetLink
}) {
  const html = buildEmailTemplate({
    title: "Redefinir password",
    content: `
      <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>

      <p>Recebemos um pedido para redefinir a sua password de acesso ao portal DUIT.</p>

      <p>Para definir uma nova password, utilize o botão abaixo:</p>

      <p style="margin:20px 0;">
        <a href="${resetLink}" 
           style="background:#16B3B1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
          Redefinir password
        </a>
      </p>

      <p>Se não fez este pedido, pode ignorar este email.</p>

      <p>Obrigado,<br/>DUIT</p>
    `
  })

  await transporter.sendMail({
    from: `"DUIT" <${process.env.SMTP_FROM}>`,
    to,
    subject: "Redefinir password de acesso",
    html
  })
}


export async function sendTicketReplyEmail({
  to,
  clientName,
  ticketSubject,
  message
}) {
  const html = buildEmailTemplate({
    title: "Nova resposta no seu ticket",
    content: `
      <p>${clientName ? `Olá ${clientName},` : "Olá,"}</p>

      <p>Recebeu uma nova resposta no seu ticket:</p>

      <p><strong>${ticketSubject}</strong></p>

      <p style="margin-top:15px;">${message}</p>

      <p style="margin-top:20px;">
        <a href="http://localhost:5173/client/tickets"
           style="background:#16B3B1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;">
          Ver ticket
        </a>
      </p>

      <p style="margin-top:20px;">Obrigado,<br/>DUIT</p>
    `
  })

  await transporter.sendMail({
    from: `"DUIT" <${process.env.SMTP_FROM}>`,
    to,
    subject: `Nova resposta: ${ticketSubject}`,
    html
  })
}