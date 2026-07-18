import { Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string[];
  subject: string;
  text: string;
}

export interface EmailSender {
  send(input: SendEmailInput): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

/** Envio real via Resend — usado quando `RESEND_API_KEY` está configurado. */
export class ResendEmailSender implements EmailSender {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string
  ) {
    this.client = new Resend(apiKey);
  }

  async send(input: SendEmailInput): Promise<void> {
    await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  }
}

/** Fallback quando `RESEND_API_KEY` não está configurado — dev/self-host sem e-mail. */
export class NullEmailSender implements EmailSender {
  private readonly logger = new Logger('NullEmailSender');
  private warned = false;

  async send(input: SendEmailInput): Promise<void> {
    if (!this.warned) {
      this.warned = true;
      this.logger.warn(
        'RESEND_API_KEY não configurado — notificações de alerta por e-mail estão desativadas.'
      );
    }
    void input;
  }
}

export function buildEmailSenderFromEnv(
  env: Record<string, string | undefined> = process.env
): EmailSender {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return new NullEmailSender();
  const from = env.RESEND_FROM_EMAIL?.trim() || 'alerts@easysignage.local';
  return new ResendEmailSender(apiKey, from);
}
