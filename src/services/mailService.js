// Envío de correos vía SMTP (nodemailer). Se configura con variables de entorno:
//   SMTP_HOST      ej. smtp.gmail.com
//   SMTP_PORT      465 (SSL) o 587 (STARTTLS)
//   SMTP_SECURE    'true' para el puerto 465, 'false' para 587
//   SMTP_USER      usuario/cuenta remitente
//   SMTP_PASS      contraseña o App Password (Gmail exige App Password, no la clave normal)
//   SMTP_FROM      remitente visible, ej. "OTS UPSE <no-reply@ots.upse.edu.ec>"
//
// Si NO hay SMTP configurado, no se cae: registra una advertencia y (en desarrollo) imprime el
// contenido por consola, para poder probar el flujo sin un servidor de correo real.
const nodemailer = require('nodemailer');

const smtpConfigurado = () =>
    Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
const obtenerTransporter = () => {
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    return transporter;
};

const enviarCorreoReset = async (correo, nombre, enlace) => {
    const asunto = 'Restablecer tu contraseña - OTS UPSE';
    const texto =
        `Hola ${nombre || ''},\n\n` +
        `Recibimos una solicitud para restablecer la contraseña de tu cuenta en el ` +
        `Observatorio Turístico Sostenible (OTS - UPSE).\n\n` +
        `Abre este enlace para crear una nueva contraseña (válido por 1 hora):\n${enlace}\n\n` +
        `Si no solicitaste esto, ignora este correo: tu contraseña no cambiará.`;
    const html =
        `<p>Hola ${nombre || ''},</p>` +
        `<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en el ` +
        `<strong>Observatorio Turístico Sostenible (OTS - UPSE)</strong>.</p>` +
        `<p><a href="${enlace}" style="background:#1e6091;color:#fff;padding:12px 20px;` +
        `border-radius:8px;text-decoration:none;display:inline-block">Crear nueva contraseña</a></p>` +
        `<p>O copia este enlace (válido por 1 hora):<br><a href="${enlace}">${enlace}</a></p>` +
        `<p style="color:#666">Si no solicitaste esto, ignora este correo: tu contraseña no cambiará.</p>`;

    if (!smtpConfigurado()) {
        console.warn('[Mail] SMTP no configurado. No se envió el correo real.');
        if (process.env.NODE_ENV !== 'production') {
            console.log('[Mail] (DEV) Enlace de recuperación para', correo, '->', enlace);
        }
        return { enviado: false, modoDev: true };
    }

    await obtenerTransporter().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: correo,
        subject: asunto,
        text: texto,
        html
    });
    return { enviado: true };
};

module.exports = { enviarCorreoReset, smtpConfigurado };
