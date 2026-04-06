export function buildEmailTemplate({ title, content, buttonText, buttonUrl }) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,sans-serif;">
          
          <!-- HEADER -->
          <tr>
            <td style="padding:30px;text-align:left;">
              <img 
                src="https://www.duit.pt/wp-content/uploads/2026/02/cropped-logo_amarelo.png" 
                alt="DUIT" 
                width="140"
                style="display:block;margin:0 auto;text-align:left"
              />
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px 35px;color:#333;font-size:15px;line-height:1.6;">
              <h2 style="margin-top:0;color:#000;">${title}</h2>
              ${content}

              ${
                buttonUrl
                  ? `
                <div style="margin-top:30px;text-align:center;">
                  <a href="${buttonUrl}" 
                     style="background:#FFD200;color:#000;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;display:inline-block;">
                     ${buttonText}
                  </a>
                </div>
                `
                  : ""
              }
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f0f0f0;padding:20px;text-align:center;font-size:12px;color:#777;">
              © ${new Date().getFullYear()} DUIT. Todos os direitos reservados.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  `
}