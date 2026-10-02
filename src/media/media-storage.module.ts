import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import s3Config from '../config/s3.config';
import { MediaStorage } from './media-storage';
import { S3MediaStorage } from './s3-media-storage';

@Module({
  imports: [ConfigModule.forFeature(s3Config)],
  providers: [{ provide: MediaStorage, useClass: S3MediaStorage }],
  exports: [MediaStorage],
})
export class MediaStorageModule {}
