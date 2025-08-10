const nodemailer = require('nodemailer');

class MailService {
  constructor() {
    const host = process.env.MAIL_HOST;
    const port = parseInt(process.env.MAIL_PORT || '587', 10);
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;

    if (!host || !port || !user || !pass) {
      this.enabled = false;
      return;
    }

    this.enabled = true;
    this.from = process.env.MAIL_FROM || user;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  async send(options) {
    if (!this.enabled) {
      return { accepted: [], rejected: [], messageId: null, disabled: true };
    }
    const info = await this.transporter.sendMail({ from: this.from, ...options });
    return info;
  }
}

module.exports = MailService;


