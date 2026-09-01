/**
 * Liest die konfigurierte PIN-Länge aus AppSettings.
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import {
  DEFAULT_PIN_LENGTH,
  isValidPinForLength,
  parsePinLength,
  PIN_LENGTH_KEY,
  pinLengthErrorMessage,
} from './pin-length';

@Injectable()
export class PinLengthService {
  constructor(private readonly settings: AppSettingsService) {}

  async getLength(): Promise<number> {
    const raw = await this.settings.get(PIN_LENGTH_KEY);
    return parsePinLength(raw ?? undefined);
  }

  /**
   * Wirft BadRequestException, wenn die PIN nicht der konfigurierten Länge entspricht.
   */
  async assertPin(pin: string): Promise<number> {
    const length = await this.getLength();
    if (!isValidPinForLength(pin, length)) {
      throw new BadRequestException(pinLengthErrorMessage(length));
    }
    return length;
  }

  /** Für Login: ungültige Länge → gleiche Meldung wie falsche PIN (kein Leak). */
  async matchesConfiguredLength(pin: string): Promise<boolean> {
    const length = await this.getLength();
    return isValidPinForLength(pin, length);
  }

  getDefault(): number {
    return DEFAULT_PIN_LENGTH;
  }
}
