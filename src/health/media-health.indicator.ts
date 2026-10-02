import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator } from '@nestjs/terminus';
import { MediaStorage } from '../media/media-storage';

@Injectable()
export class MediaHealthIndicator extends HealthIndicator {
  constructor(private readonly storage: MediaStorage) {
    super();
  }

  async isHealthy(key: string) {
    try {
      await this.storage.ready();
      return this.getStatus(key, true);
    } catch {
      throw new HealthCheckError(
        'Media storage health check failed',
        this.getStatus(key, false),
      );
    }
  }
}
