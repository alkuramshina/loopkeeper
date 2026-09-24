import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import sharp from 'sharp';
import { DomainException } from '../common/exceptions/domain.exception';
import appConfig from '../config/app.config';
import { PrismaService } from '../prisma/prisma.service';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MIN_AVATAR_DIMENSION = 256;
const MAX_AVATAR_DIMENSION = 2048;
const NORMALIZED_AVATAR_DIMENSION = 512;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const importFileType = Function('return import("file-type")') as () => Promise<
  typeof import('file-type')
>;

type UploadedFile = {
  buffer: Buffer;
};

type NormalizedAvatar = {
  content: Buffer;
  width: number;
  height: number;
};

@Injectable()
export class MediaService {
  private readonly storagePath: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(appConfig.KEY)
    config: ConfigType<typeof appConfig>,
  ) {
    this.storagePath = resolve(config.mediaStoragePath);
  }

  async replaceAvatar(userId: string, file: UploadedFile) {
    const normalizedAvatar = await this.normalizeAvatar(file);
    const storageKey = `${randomUUID()}.webp`;

    await this.writeAtomically(storageKey, normalizedAvatar.content);

    let result: {
      asset: { assetId: string };
      previousStorageKey: string | null;
    };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: { userId, isDeleted: false },
          select: {
            avatarAssetId: true,
            avatarAsset: { select: { storageKey: true } },
          },
        });

        if (!user) {
          throw new NotFoundException();
        }

        const asset = await tx.mediaAsset.create({
          data: {
            storageKey,
            purpose: 'AVATAR',
            byteSize: normalizedAvatar.content.length,
            width: normalizedAvatar.width,
            height: normalizedAvatar.height,
          },
        });

        await tx.user.update({
          where: { userId },
          data: {
            avatarAssetId: asset.assetId,
            avatarUrl: `/media/${asset.assetId}`,
          },
        });

        if (user.avatarAssetId) {
          await tx.mediaAsset.delete({
            where: { assetId: user.avatarAssetId },
          });
        }

        return {
          asset,
          previousStorageKey: user.avatarAsset?.storageKey ?? null,
        };
      });
    } catch (error) {
      await this.removeStorageFile(storageKey);
      throw error;
    }

    if (result.previousStorageKey) {
      await this.removeStorageFile(result.previousStorageKey);
    }

    return {
      assetId: result.asset.assetId,
      avatarUrl: `/media/${result.asset.assetId}`,
    };
  }

  async deleteAvatar(userId: string): Promise<void> {
    const asset = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { userId, isDeleted: false },
        select: { avatarAssetId: true },
      });

      if (!user?.avatarAssetId) {
        throw new NotFoundException();
      }

      const avatarAsset = await tx.mediaAsset.delete({
        where: { assetId: user.avatarAssetId },
      });

      await tx.user.update({
        where: { userId },
        data: { avatarAssetId: null, avatarUrl: null },
      });

      return avatarAsset;
    });

    await this.removeStorageFile(asset.storageKey);
  }

  async getAvatarContent(_userId: string, assetId: string): Promise<Buffer> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        assetId,
        purpose: 'AVATAR',
        avatarOwner: { isDeleted: false },
      },
      select: { storageKey: true },
    });

    if (!asset) {
      throw new NotFoundException();
    }

    try {
      return await readFile(this.storageFilePath(asset.storageKey));
    } catch {
      throw new NotFoundException();
    }
  }

  async removeStorageFile(storageKey: string): Promise<void> {
    await rm(this.storageFilePath(storageKey), { force: true });
  }

  private async normalizeAvatar(file: UploadedFile): Promise<NormalizedAvatar> {
    if (!file?.buffer?.length) {
      throw this.invalidMedia(
        'media.invalid_file',
        'An image file is required',
      );
    }

    if (file.buffer.length > MAX_AVATAR_BYTES) {
      throw this.invalidMedia(
        'media.file_too_large',
        'The image file exceeds 5 MiB',
      );
    }

    const { fileTypeFromBuffer } = await importFileType();
    const detectedType = await fileTypeFromBuffer(file.buffer);
    if (!detectedType || !ACCEPTED_IMAGE_TYPES.has(detectedType.mime)) {
      throw this.invalidMedia(
        'media.unsupported_type',
        'The image format is not supported',
      );
    }

    try {
      const image = sharp(file.buffer, {
        limitInputPixels: MAX_AVATAR_DIMENSION ** 2,
      }).rotate();
      const metadata = await image.metadata();
      const { width, height } = metadata;

      if (
        !width ||
        !height ||
        Math.min(width, height) < MIN_AVATAR_DIMENSION ||
        Math.max(width, height) > MAX_AVATAR_DIMENSION
      ) {
        throw this.invalidMedia(
          'media.invalid_dimensions',
          'Each image side must be between 256 and 2048 pixels',
        );
      }

      return {
        content: await image
          .resize(NORMALIZED_AVATAR_DIMENSION, NORMALIZED_AVATAR_DIMENSION, {
            fit: 'cover',
            position: 'centre',
          })
          .webp()
          .toBuffer(),
        width: NORMALIZED_AVATAR_DIMENSION,
        height: NORMALIZED_AVATAR_DIMENSION,
      };
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }

      throw this.invalidMedia(
        'media.invalid_file',
        'The image file is invalid',
      );
    }
  }

  private async writeAtomically(
    storageKey: string,
    content: Buffer,
  ): Promise<void> {
    await mkdir(this.storagePath, { recursive: true });
    const targetPath = this.storageFilePath(storageKey);
    const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;

    try {
      await writeFile(temporaryPath, content, { flag: 'wx' });
      await rename(temporaryPath, targetPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  private storageFilePath(storageKey: string): string {
    return join(this.storagePath, storageKey);
  }

  private invalidMedia(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.BAD_REQUEST, code, message);
  }
}
