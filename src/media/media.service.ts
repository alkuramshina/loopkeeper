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
import { CampaignRole, Prisma } from '@prisma/client';
import { CampaignBackgroundDto } from '../campaign/dto/campaign-background-settings.dto';

import { DomainException } from '../common/exceptions/domain.exception';
import appConfig from '../config/app.config';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_MEDIA_BYTES } from './media-upload-exception.filter';

const MIN_AVATAR_DIMENSION = 256;
const MAX_AVATAR_DIMENSION = 2048;
const NORMALIZED_AVATAR_DIMENSION = 512;
const MIN_COVER_WIDTH = 640;
const MIN_COVER_HEIGHT = 360;
const MAX_COVER_DIMENSION = 2048;
const MAX_COVER_WIDTH = 1280;
const MAX_COVER_HEIGHT = 720;
const BACKGROUND_DIMENSIONS = new Set(['1600x900', '1920x1080', '2560x1440']);
function hasSupportedImageSignature(buffer: Buffer): boolean {
  const png =
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const webp =
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';
  return png || jpeg || webp;
}

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
    const user = await this.prisma.user.findFirst({
      where: { userId, isDeleted: false },
      select: { userId: true },
    });
    if (!user) {
      throw new NotFoundException();
    }
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

  async replaceCharacterAvatar(
    userId: string,
    characterId: string,
    file: UploadedFile,
  ) {
    const character = await this.authorizeCharacterAvatar(userId, characterId);
    const normalizedAvatar = await this.normalizeAvatar(file);
    const storageKey = `${randomUUID()}.webp`;
    await this.writeAtomically(storageKey, normalizedAvatar.content);

    let result: {
      asset: { assetId: string };
      previousStorageKey: string | null;
    };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const currentCharacter = await tx.character.findUniqueOrThrow({
          where: { characterId: character.characterId },
          select: {
            avatarAssetId: true,
            avatarAsset: { select: { storageKey: true } },
          },
        });
        const asset = await tx.mediaAsset.create({
          data: {
            storageKey,
            purpose: 'CHARACTER_AVATAR',
            byteSize: normalizedAvatar.content.length,
            width: normalizedAvatar.width,
            height: normalizedAvatar.height,
          },
        });
        await tx.character.update({
          where: { characterId },
          data: {
            avatarAssetId: asset.assetId,
            avatarUrl: `/media/${asset.assetId}`,
          },
        });
        if (currentCharacter.avatarAssetId) {
          await tx.mediaAsset.delete({
            where: { assetId: currentCharacter.avatarAssetId },
          });
        }
        return {
          asset,
          previousStorageKey: currentCharacter.avatarAsset?.storageKey ?? null,
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

  async deleteCharacterAvatar(
    userId: string,
    characterId: string,
  ): Promise<void> {
    const character = await this.authorizeCharacterAvatar(userId, characterId);
    const asset = await this.prisma.$transaction(async (tx) => {
      const currentCharacter = await tx.character.findUniqueOrThrow({
        where: { characterId: character.characterId },
        select: { avatarAssetId: true },
      });
      if (!currentCharacter.avatarAssetId) {
        throw new NotFoundException();
      }
      const avatarAsset = await tx.mediaAsset.delete({
        where: { assetId: currentCharacter.avatarAssetId },
      });
      await tx.character.update({
        where: { characterId },
        data: { avatarAssetId: null, avatarUrl: null },
      });
      return avatarAsset;
    });
    await this.removeStorageFile(asset.storageKey);
  }

  async replaceCampaignCover(
    userId: string,
    campaignId: string,
    file: UploadedFile,
  ) {
    await this.requireCampaignOwner(userId, campaignId);
    const normalizedAvatar = await this.normalizeCover(file);
    const storageKey = `${randomUUID()}.webp`;
    await this.writeAtomically(storageKey, normalizedAvatar.content);

    let result: {
      asset: { assetId: string };
      previousStorageKey: string | null;
    };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const campaign = await tx.campaign.findUniqueOrThrow({
          where: { campaignId },
          select: {
            coverAssetId: true,
            coverAsset: { select: { storageKey: true } },
          },
        });
        const asset = await tx.mediaAsset.create({
          data: {
            storageKey,
            purpose: 'CAMPAIGN_COVER',
            byteSize: normalizedAvatar.content.length,
            width: normalizedAvatar.width,
            height: normalizedAvatar.height,
          },
        });
        await tx.campaign.update({
          where: { campaignId },
          data: {
            coverAssetId: asset.assetId,
            coverUrl: `/media/${asset.assetId}`,
          },
        });
        if (campaign.coverAssetId) {
          await tx.mediaAsset.delete({
            where: { assetId: campaign.coverAssetId },
          });
        }
        return {
          asset,
          previousStorageKey: campaign.coverAsset?.storageKey ?? null,
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
      coverUrl: `/media/${result.asset.assetId}`,
    };
  }

  async deleteCampaignCover(userId: string, campaignId: string): Promise<void> {
    await this.requireCampaignOwner(userId, campaignId);
    const asset = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUniqueOrThrow({
        where: { campaignId },
        select: { coverAssetId: true },
      });
      if (!campaign.coverAssetId) {
        throw new NotFoundException();
      }
      const coverAsset = await tx.mediaAsset.delete({
        where: { assetId: campaign.coverAssetId },
      });
      await tx.campaign.update({
        where: { campaignId },
        data: { coverAssetId: null, coverUrl: null },
      });
      return coverAsset;
    });
    await this.removeStorageFile(asset.storageKey);
  }

  async addCampaignBackground(
    userId: string,
    campaignId: string,
    file: UploadedFile,
  ) {
    await this.requireCampaignOwner(userId, campaignId);
    const image = await this.normalizeBackground(file);
    const storageKey = `${randomUUID()}.webp`;
    await this.writeAtomically(storageKey, image.content);

    let background: CampaignBackgroundDto;
    try {
      background = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "campaignId" FROM "campaigns" WHERE "campaignId" = ${campaignId} FOR UPDATE`;
        const campaign = await tx.campaign.findUniqueOrThrow({
          where: { campaignId, ownerId: userId },
          select: { backgrounds: true },
        });
        const backgrounds =
          campaign.backgrounds as unknown as CampaignBackgroundDto[];
        if (backgrounds.length >= 10) {
          throw this.invalidMedia(
            'media.background_limit',
            'A campaign can have at most 10 backgrounds',
          );
        }
        const asset = await tx.mediaAsset.create({
          data: {
            storageKey,
            purpose: 'CAMPAIGN_BACKGROUND',
            backgroundCampaignId: campaignId,
            byteSize: image.content.length,
            width: image.width,
            height: image.height,
          },
        });
        const background: CampaignBackgroundDto = {
          backgroundId: asset.assetId,
          name: `Background ${backgrounds.length + 1}`,
          imageUrl: `/media/${asset.assetId}`,
          isEnabled: true,
          sortOrder: backgrounds.length,
        };
        await tx.campaign.update({
          where: { campaignId },
          data: {
            backgrounds: [
              ...backgrounds,
              background,
            ] as unknown as Prisma.InputJsonValue,
          },
        });
        return background;
      });
    } catch (error) {
      await this.removeStorageFile(storageKey);
      throw error;
    }
    return background;
  }

  async deleteCampaignBackground(
    userId: string,
    campaignId: string,
    backgroundId: string,
  ): Promise<void> {
    await this.requireCampaignOwner(userId, campaignId);
    const storageKey = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "campaignId" FROM "campaigns" WHERE "campaignId" = ${campaignId} FOR UPDATE`;
      const campaign = await tx.campaign.findUniqueOrThrow({
        where: { campaignId, ownerId: userId },
        select: { backgrounds: true, fixedBackgroundId: true },
      });
      const backgrounds =
        campaign.backgrounds as unknown as CampaignBackgroundDto[];
      if (
        !backgrounds.some(
          (background) =>
            background.backgroundId === backgroundId &&
            background.imageUrl === `/media/${backgroundId}`,
        )
      ) {
        throw new NotFoundException();
      }
      const asset = await tx.mediaAsset.findFirst({
        where: {
          assetId: backgroundId,
          purpose: 'CAMPAIGN_BACKGROUND',
          backgroundCampaignId: campaignId,
        },
        select: { storageKey: true },
      });
      if (!asset) throw new NotFoundException();
      await tx.campaign.update({
        where: { campaignId },
        data: {
          backgrounds: backgrounds.filter(
            (background) => background.backgroundId !== backgroundId,
          ) as unknown as Prisma.InputJsonValue,
          ...(campaign.fixedBackgroundId === backgroundId
            ? { fixedBackgroundId: null }
            : {}),
        },
      });
      await tx.mediaAsset.delete({ where: { assetId: backgroundId } });
      return asset.storageKey;
    });
    await this.removeStorageFile(storageKey);
  }

  async getMediaContent(userId: string, assetId: string): Promise<Buffer> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        assetId,
        OR: [
          { purpose: 'AVATAR', avatarOwner: { isDeleted: false } },
          {
            purpose: 'CHARACTER_AVATAR',
            characterAvatar: {
              avatarUrl: `/media/${assetId}`,
              campaign: {
                OR: [{ ownerId: userId }, { members: { some: { userId } } }],
              },
            },
          },
          {
            purpose: 'CAMPAIGN_BACKGROUND',
            backgroundCampaign: {
              backgrounds: {
                array_contains: [
                  { backgroundId: assetId, imageUrl: `/media/${assetId}` },
                ],
              },
              OR: [{ ownerId: userId }, { members: { some: { userId } } }],
            },
          },
          {
            purpose: 'CAMPAIGN_COVER',
            campaignCover: {
              coverUrl: `/media/${assetId}`,
              OR: [{ ownerId: userId }, { members: { some: { userId } } }],
            },
          },
        ],
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

  private async requireCampaignOwner(
    userId: string,
    campaignId: string,
  ): Promise<void> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { campaignId, ownerId: userId },
      select: { campaignId: true },
    });
    if (!campaign) {
      throw new DomainException(
        HttpStatus.NOT_FOUND,
        'campaign.not_found',
        'Campaign not found',
      );
    }
  }

  private async authorizeCharacterAvatar(userId: string, characterId: string) {
    const character = await this.prisma.character.findFirst({
      where: {
        characterId,
        campaign: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      },
      select: {
        characterId: true,
        campaignId: true,

        ownerId: true,
      },
    });
    if (!character) {
      throw new NotFoundException();
    }
    if (character.ownerId !== userId) {
      throw new NotFoundException();
    }
    const membership = await this.prisma.campaignMember.findFirst({
      where: {
        campaignId: character.campaignId,
        userId,
        campaignRole: CampaignRole.PLAYER,
      },
      select: { memberId: true },
    });
    if (!membership) throw new NotFoundException();
    return character;
  }

  async removeStorageFile(storageKey: string): Promise<void> {
    await rm(this.storageFilePath(storageKey), { force: true });
  }

  private async validateUpload(file: UploadedFile): Promise<void> {
    if (!file?.buffer?.length) {
      throw this.invalidMedia(
        'media.invalid_file',
        'An image file is required',
      );
    }

    if (file.buffer.length > MAX_MEDIA_BYTES) {
      throw this.invalidMedia(
        'media.file_too_large',
        'The image file exceeds 5 MiB',
      );
    }

    if (!hasSupportedImageSignature(file.buffer)) {
      throw this.invalidMedia(
        'media.unsupported_type',
        'The image format is not supported',
      );
    }
  }

  private async normalizeAvatar(file: UploadedFile): Promise<NormalizedAvatar> {
    await this.validateUpload(file);
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

  private async normalizeCover(file: UploadedFile): Promise<NormalizedAvatar> {
    await this.validateUpload(file);
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: MAX_COVER_DIMENSION ** 2,
      }).rotate();
      const { width, height, orientation } = await image.metadata();
      const rotatedWidth =
        orientation && orientation >= 5 && orientation <= 8 ? height : width;
      const rotatedHeight =
        orientation && orientation >= 5 && orientation <= 8 ? width : height;
      if (
        !rotatedWidth ||
        !rotatedHeight ||
        rotatedWidth < MIN_COVER_WIDTH ||
        rotatedHeight < MIN_COVER_HEIGHT ||
        rotatedWidth > MAX_COVER_DIMENSION ||
        rotatedHeight > MAX_COVER_DIMENSION ||
        rotatedWidth / rotatedHeight < 1.5 ||
        rotatedWidth / rotatedHeight > 2
      ) {
        throw this.invalidMedia(
          'media.invalid_cover_dimensions',
          'Cover images must be landscape (3:2 to 2:1), 640–2048 pixels wide and 360–2048 pixels high',
        );
      }

      const { data, info } = await image
        .resize({
          width: MAX_COVER_WIDTH,
          height: MAX_COVER_HEIGHT,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp()
        .toBuffer({ resolveWithObject: true });
      return { content: data, width: info.width, height: info.height };
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

  private async normalizeBackground(
    file: UploadedFile,
  ): Promise<NormalizedAvatar> {
    await this.validateUpload(file);
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 2560 * 1440,
      }).rotate();
      const { width, height, orientation } = await image.metadata();
      const rotatedWidth =
        orientation && orientation >= 5 && orientation <= 8 ? height : width;
      const rotatedHeight =
        orientation && orientation >= 5 && orientation <= 8 ? width : height;
      if (!BACKGROUND_DIMENSIONS.has(`${rotatedWidth}x${rotatedHeight}`)) {
        throw this.invalidMedia(
          'media.invalid_background_dimensions',
          'Background images must be 1600×900, 1920×1080 or 2560×1440 pixels',
        );
      }
      const content = await image.webp().toBuffer();
      return { content, width: rotatedWidth!, height: rotatedHeight! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
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
