import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import type { Readable } from 'node:stream';

/**
 * Kapselt den Objektspeicher (MinIO / S3-kompatibel).
 * Stellt Upload, Download (Stream) und Löschen bereit und legt den
 * Ziel-Bucket beim App-Start automatisch an.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET') ?? 'office-documents';
    this.client = new MinioClient({
      endPoint: this.config.get<string>('MINIO_ENDPOINT') ?? 'minio',
      port: Number(this.config.get<string>('MINIO_PORT') ?? 9000),
      useSSL:
        (this.config.get<string>('MINIO_USE_SSL') ?? 'false') === 'true',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY') ?? 'office_minio',
      secretKey:
        this.config.get<string>('MINIO_SECRET_KEY') ?? 'office_minio_pw',
    });
  }

  /** Bucket beim Start anlegen, falls nicht vorhanden. */
  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Bucket "${this.bucket}" angelegt.`);
      } else {
        this.logger.log(`Bucket "${this.bucket}" vorhanden.`);
      }
    } catch (err) {
      // Storage darf den App-Start nicht verhindern – nur warnen.
      this.logger.error(
        `Bucket-Initialisierung fehlgeschlagen: ${(err as Error).message}`,
      );
    }
  }

  /** Lädt einen Buffer unter dem angegebenen Key hoch. */
  async upload(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    await this.client.putObject(this.bucket, storageKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  /** Liefert einen lesbaren Stream des Objekts (für Download). */
  getStream(storageKey: string): Promise<Readable> {
    return this.client.getObject(this.bucket, storageKey);
  }

  /** Entfernt ein Objekt aus dem Storage. */
  async remove(storageKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, storageKey);
  }
}
