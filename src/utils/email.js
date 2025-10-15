const nodemailer = require("nodemailer");
const path = require("path");
const { registerEmailHelpers } = require("./emailHelpers");

const BRAND = {
  name: "54Links",
  website: process.env.WEBSITE_URL || "https://54links.com",
  supportEmail: process.env.SUPPORT_EMAIL || "support@54links.com",
  primary: "#034ea2",
  text: "#202124",
  muted: "#5f6368",
  bg: "#f6f7fb",
  cardBg: "#ffffff",
  border: "#e6e6ef",
};

async function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  // 🔁 DEV fallback: no SMTP configured → just log
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE) === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  

  // ⚙️ ESM module — import dynamically in CJS
  const hbsMod = await import("nodemailer-express-handlebars");
  const hbs = hbsMod.default || hbsMod; // handle default export

  // Create handlebars options
  const hbsOptions = {
  viewEngine: {
    extname: ".hbs",
    layoutsDir: path.resolve(__dirname, "../emails/layouts"),
    partialsDir: path.resolve(__dirname, "../emails/partials"),
    defaultLayout: "main",
    helpers: {}
  },
  viewPath: path.resolve(__dirname, "../emails"),
  extName: ".hbs",
};

  // Register our custom helpers
  registerEmailHelpers(hbsOptions.viewEngine.helpers);

  transport.use("compile", hbs(hbsOptions));

  return transport;
}

/**
 * Send a plain HTML email (without template)
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html - HTML content
 * @param {string} opts.text - optional plain text version
 */
async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || "54Links <no-reply@54links.com>";
  const transport = await getTransport();

  // DEV fallback: log to console if SMTP not configured
  if (!transport) {
    console.log("📧 [DEV EMAIL - PLAIN]", {
      to,
      subject,
      html: html.substring(0, 200) + (html.length > 200 ? '...' : ''),
      text: text ? text.substring(0, 200) + (text.length > 200 ? '...' : '') : undefined,
    });
    return { mocked: true };
  }

  return transport.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });
}

/**
 * Send an email using a Handlebars template
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.template - template name without extension (e.g., 'verify-email')
 * @param {object} opts.context - handlebars variables available to template
 */
async function sendTemplatedEmail({ to, subject, template, context = {} }) {
  const from = process.env.EMAIL_FROM || "54Links <no-reply@54links.com>";
  const transport = await getTransport();

  console.log({ to, subject,context,transport })

  // DEV fallback: log to console if SMTP not configured
  if (!transport) {
    console.log("📧 [DEV EMAIL - TEMPLATE]", {
      to,
      subject,
      template,
      context: { BRAND, ...context },
    });
    return { mocked: true };
  }

  const mergedContext = {
    BRAND,
    year: new Date().getFullYear(),
    ...context,
  };

  return transport.sendMail({
    from,
    to,
    subject,
    template,
    context: mergedContext,
  });
}

module.exports = {
  sendEmail,
  sendTemplatedEmail,
  BRAND,
};
