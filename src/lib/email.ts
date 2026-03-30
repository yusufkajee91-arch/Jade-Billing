import nodemailer from 'nodemailer'

interface SmtpConfig {
  host: string
  port: number
  user: string
  password: string
  fromEmail: string
  fromName: string
}

interface SendInvoiceEmailArgs {
  smtp: SmtpConfig
  to: string
  invoiceNumber: string
  clientName: string
  matterCode: string
  totalFormatted: string
  isProForma: boolean
  pdfBuffer: Buffer
}

export async function sendInvoiceEmail({
  smtp,
  to,
  invoiceNumber,
  clientName,
  matterCode,
  totalFormatted,
  isProForma,
  pdfBuffer,
}: SendInvoiceEmailArgs): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
  })

  const subject = isProForma
    ? `Pro Forma Invoice ${invoiceNumber} — ${matterCode}`
    : `Invoice ${invoiceNumber} — ${matterCode}`

  const docType = isProForma ? 'Pro Forma Invoice' : 'Tax Invoice'
  const filename = isProForma
    ? `ProForma-${invoiceNumber}.pdf`
    : `Invoice-${invoiceNumber}.pdf`

  const html = `
    <p>Dear ${clientName},</p>
    <p>Please find attached ${docType} <strong>${invoiceNumber}</strong> for matter reference <strong>${matterCode}</strong>.</p>
    <p>Amount: <strong>${totalFormatted}</strong></p>
    <p>Please use <strong>${matterCode}</strong> as your payment reference.</p>
    <p>Kind regards,<br/>${smtp.fromName}</p>
  `

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to,
    subject,
    html,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}
