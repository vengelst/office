/**
 * KI-Assistent: AppSettings lesen/schreiben + OpenAI-kompatible Chat-Completions.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';
import type {
  AiAssistantConfigInternal,
  AiAssistantConfigPublic,
} from './types';

const KEYS = {
  enabled: 'ai_assistant_enabled',
  baseUrl: 'ai_assistant_base_url',
  apiKey: 'ai_assistant_api_key',
  model: 'ai_assistant_model',
  timeoutMs: 'ai_assistant_timeout_ms',
} as const;

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4.1-mini';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(private readonly settings: AppSettingsService) {}

  /**
   * Öffentliche Config ohne Klartext-API-Key.
   */
  async getPublicConfig(): Promise<AiAssistantConfigPublic> {
    const cfg = await this.getInternalConfig();
    return {
      enabled: cfg.enabled,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      timeoutMs: cfg.timeoutMs,
      apiKeyConfigured: Boolean(cfg.apiKey),
      apiKeyMasked: this.maskKey(cfg.apiKey),
    };
  }

  /**
   * Interne Config inkl. Klartext-Key (nur Server).
   */
  async getInternalConfig(): Promise<AiAssistantConfigInternal> {
    const vals = await this.settings.getMany(Object.values(KEYS));
    return {
      enabled: vals[KEYS.enabled] === 'true',
      baseUrl: (vals[KEYS.baseUrl] || DEFAULT_BASE_URL).replace(/\/+$/, ''),
      model: vals[KEYS.model] || DEFAULT_MODEL,
      timeoutMs: Number(vals[KEYS.timeoutMs]) || DEFAULT_TIMEOUT_MS,
      apiKey: vals[KEYS.apiKey] ?? '',
    };
  }

  /**
   * Speichert Settings. Leerer apiKey = vorhandenen Key behalten.
   */
  async saveConfig(input: {
    enabled: boolean;
    baseUrl: string;
    model: string;
    apiKey?: string;
    timeoutMs?: number;
  }): Promise<void> {
    const current = await this.getInternalConfig();
    const nextKey =
      input.apiKey !== undefined && input.apiKey.trim() !== ''
        ? input.apiKey.trim()
        : current.apiKey;

    await this.settings.setMany({
      [KEYS.enabled]: String(input.enabled),
      [KEYS.baseUrl]: input.baseUrl.trim().replace(/\/+$/, '') || DEFAULT_BASE_URL,
      [KEYS.model]: input.model.trim() || DEFAULT_MODEL,
      [KEYS.apiKey]: nextKey,
      [KEYS.timeoutMs]: String(input.timeoutMs ?? current.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  }

  /**
   * Mini-Request gegen das konfigurierte Backend (models.list oder chat).
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const cfg = await this.getInternalConfig();
      if (!cfg.apiKey) {
        return { success: false, error: 'API-Key nicht konfiguriert' };
      }

      const modelsUrl = this.resolveUrl(cfg.baseUrl, '/models');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(cfg.timeoutMs, 30_000));

      try {
        const res = await fetch(modelsUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
          signal: controller.signal,
        });
        if (res.ok) {
          return { success: true };
        }
        // Fallback: winziger Chat-Request
        if (res.status === 404 || res.status === 405) {
          await this.chatCompletion({
            system: 'Reply with OK',
            user: 'ping',
            jsonMode: false,
            maxTokens: 5,
          });
          return { success: true };
        }
        const body = await res.text();
        return {
          success: false,
          error: `HTTP ${res.status}: ${body.slice(0, 300)}`,
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Stellt sicher, dass der Assistent aktiv und konfiguriert ist.
   */
  async assertReady(): Promise<AiAssistantConfigInternal> {
    const cfg = await this.getInternalConfig();
    if (!cfg.enabled) {
      throw new ForbiddenException(
        'KI-Assistent ist deaktiviert. Unter Einstellungen → KI aktivieren.',
      );
    }
    if (!cfg.apiKey) {
      throw new ForbiddenException(
        'KI-API-Key fehlt. Unter Einstellungen → KI konfigurieren.',
      );
    }
    return cfg;
  }

  /**
   * OpenAI-kompatibles chat/completions.
   */
  async chatCompletion(opts: {
    system: string;
    user: string;
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const cfg = await this.assertReady();
    const url = this.resolveCompletionsUrl(cfg.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 8000,
    };
    if (opts.jsonMode !== false) {
      body.response_format = { type: 'json_object' };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        if (res.status === 401) {
          throw new BadRequestException('KI-API: Ungültiger API-Key (401)');
        }
        if (res.status === 429) {
          throw new BadRequestException('KI-API: Rate-Limit erreicht (429)');
        }
        throw new BadRequestException(
          `KI-API Fehler ${res.status}: ${text.slice(0, 400)}`,
        );
      }

      const json = JSON.parse(text) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content?.trim()) {
        throw new BadRequestException('KI-API lieferte leere Antwort');
      }
      return content.trim();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new BadRequestException(
          `KI-API Timeout (${cfg.timeoutMs} ms überschritten)`,
        );
      }
      this.logger.error(`chatCompletion failed: ${(err as Error).message}`);
      throw new BadRequestException(
        `KI-API Fehler: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Chat + JSON-Parse.
   */
  async chatJson<T>(opts: {
    system: string;
    user: string;
    maxTokens?: number;
  }): Promise<T> {
    const raw = await this.chatCompletion({ ...opts, jsonMode: true });
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      throw new BadRequestException(
        'KI-Antwort war kein gültiges JSON. Bitte erneut versuchen.',
      );
    }
  }

  private resolveCompletionsUrl(baseUrl: string): string {
    if (/\/chat\/completions\/?$/i.test(baseUrl)) {
      return baseUrl;
    }
    return this.resolveUrl(baseUrl, '/chat/completions');
  }

  private resolveUrl(baseUrl: string, path: string): string {
    const base = baseUrl.replace(/\/+$/, '');
    if (base.endsWith('/v1') || /\/v\d+$/.test(base)) {
      return `${base}${path}`;
    }
    return `${base}/v1${path}`;
  }

  private maskKey(key: string): string {
    if (!key) return '';
    if (key.length <= 4) return '••••';
    return `••••••••${key.slice(-4)}`;
  }
}
