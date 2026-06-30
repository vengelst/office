import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppSettingsService } from '../app-settings/app-settings.service';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  secure: boolean;
}

const SMTP_KEYS = [
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from_name',
  'smtp_from_email',
  'smtp_secure',
] as const;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly settings: AppSettingsService) {}

  async getConfig(): Promise<SmtpConfig | null> {
    const vals = await this.settings.getMany([...SMTP_KEYS]);
    if (!vals.smtp_host) return null;
    return {
      host: vals.smtp_host,
      port: Number(vals.smtp_port) || 587,
      user: vals.smtp_user ?? '',
      pass: vals.smtp_pass ?? '',
      fromName: vals.smtp_from_name ?? 'Office',
      fromEmail: vals.smtp_from_email ?? '',
      secure: vals.smtp_secure === 'true',
    };
  }

  async saveConfig(config: SmtpConfig): Promise<void> {
    await this.settings.setMany({
      smtp_host: config.host,
      smtp_port: String(config.port),
      smtp_user: config.user,
      smtp_pass: config.pass,
      smtp_from_name: config.fromName,
      smtp_from_email: config.fromEmail,
      smtp_secure: String(config.secure),
    });
  }

  private async createTransporter(): Promise<Transporter> {
    const config = await this.getConfig();
    if (!config) {
      throw new Error('SMTP nicht konfiguriert');
    }
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async send(
    to: string,
    subject: string,
    html: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const config = await this.getConfig();
      if (!config) {
        return { success: false, error: 'SMTP nicht konfiguriert' };
      }
      const transporter = await this.createTransporter();
      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`E-Mail gesendet an ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      this.logger.error(`E-Mail-Versand fehlgeschlagen: ${message}`);
      return { success: false, error: message };
    }
  }

  async sendTest(to: string): Promise<{ success: boolean; error?: string }> {
    return this.send(
      to,
      'Office – Test-E-Mail',
      `<div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #333;">Test-E-Mail</h2>
        <p>Diese E-Mail bestätigt, dass die SMTP-Konfiguration korrekt ist.</p>
        <p style="color: #666; font-size: 12px;">Gesendet von Office</p>
      </div>`,
    );
  }
}
