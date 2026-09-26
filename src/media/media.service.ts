import { randomUUID } from 'node:crypto';
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import sharp from 'sharp';
import { CampaignElementType, CampaignRole, Prisma } from '@prisma/client';
import { CampaignBackgroundDto } from '../campaign/dto/campaign-background-settings.dto';

import { DomainException } from '../common/exceptions/domain.exception';
import appConfig from '../config/app.config';
import {
  editableElementWhere,
  readableElementWhere,
} from '../element/element-access';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_MAP_BYTES,
  MAX_MEDIA_BYTES,
} from './media-upload-exception.filter';
import { MEDIA_UPLOAD_TEMP_PATH } from './temporary-file-storage';

const MIN_AVATAR_DIMENSION = 256;
const MAX_AVATAR_DIMENSION = 2048;
const NORMALIZED_AVATAR_DIMENSION = 512;
const MIN_COVER_WIDTH = 640;
const MIN_COVER_HEIGHT = 360;
const MAX_COVER_DIMENSION = 2048;
const MAX_COVER_WIDTH = 1280;
const MAX_COVER_HEIGHT = 720;
const BACKGROUND_DIMENSIONS = new Set(['1600x900', '1920x1080', '2560x1440']);
const MIN_ELEMENT_COVER_DIMENSION = 256;
const MAX_ELEMENT_COVER_DIMENSION = 4096;
const NORMALIZED_ELEMENT_COVER_DIMENSION = 1024;
const MIN_MAP_LONG_SIDE = 1024;
const MIN_MAP_SHORT_SIDE = 256;
const MAX_MAP_DIMENSION = 8192;
const MAX_MAP_PIXELS = 40_000_000;
const NORMALIZED_MAP_DIMENSION = 4096;

type ElementMediaSlot = 'cover' | 'map';

function orientedSize(metadata: sharp.Metadata) {
  const swapped =
    metadata.orientation !== undefined &&
    metadata.orientation >= 5 &&
    metadata.orientation <= 8;
  return {
    width: swapped ? metadata.height : metadata.width,
    height: swapped ? metadata.width : metadata.height,
  };
}

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

  async replaceElementCover(
    userId: string,
    elementId: string,
    file: UploadedFile,
  ) {
    await this.requireEditableElement(userId, elementId);
    const image = await this.normalizeElementCover(file);
    const { assetId, url } = await this.attachElementAsset(
      userId,
      elementId,
      'cover',
      image,
    );
    return { assetId, coverUrl: url };
  }

  async deleteElementCover(userId: string, elementId: string): Promise<void> {
    await this.detachElementAsset(userId, elementId, 'cover');
  }

  // The upload is already streamed to a temporary file; it is always removed.
  async replaceLocationMap(
    userId: string,
    elementId: string,
    file: { path: string } | undefined,
  ) {
    try {
      await this.requireEditableElement(userId, elementId, true);
      const image = await this.normalizeMap(file?.path);
      const { assetId, url } = await this.attachElementAsset(
        userId,
        elementId,
        'map',
        image,
      );
      return { assetId, imageUrl: url };
    } finally {
      if (file?.path) await rm(file.path, { force: true });
    }
  }

  async deleteLocationMap(userId: string, elementId: string): Promise<void> {
    await this.detachElementAsset(userId, elementId, 'map');
  }

  // Element media follows element edit rights: the author, while still the
  // campaign owner or a PLAYER. Maps exist only on LOCATION elements.
  async requireEditableElement(
    userId: string,
    elementId: string,
    locationOnly = false,
  ): Promise<void> {
    const element = await this.prisma.campaignElement.findFirst({
      where: { elementId, ...editableElementWhere(userId) },
      select: { type: true },
    });
    if (!element) throw this.elementNotFound();
    if (locationOnly && element.type !== CampaignElementType.LOCATION) {
      throw this.invalidMedia(
        'media.location_only',
        'Only location elements have a map',
      );
    }
  }

  private async attachElementAsset(
    userId: string,
    elementId: string,
    slot: ElementMediaSlot,
    image: NormalizedAvatar,
  ) {
    const storageKey = `${randomUUID()}.webp`;
    await this.writeAtomically(storageKey, image.content);

    let result: { assetId: string; url: string; previousKey?: string };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "elementId" FROM "campaign_elements" WHERE "elementId" = ${elementId} FOR UPDATE`;
        const element = await tx.campaignElement.findFirst({
          where: {
            elementId,
            ...editableElementWhere(userId),
            ...(slot === 'map' ? { type: CampaignElementType.LOCATION } : {}),
          },
          select: {
            coverAsset: { select: { assetId: true, storageKey: true } },
            mapAsset: { select: { assetId: true, storageKey: true } },
          },
        });
        if (!element) throw this.elementNotFound();
        const asset = await tx.mediaAsset.create({
          data: {
            storageKey,
            purpose: slot === 'cover' ? 'ELEMENT_COVER' : 'LOCATION_MAP',
            byteSize: image.content.length,
            width: image.width,
            height: image.height,
          },
        });
        const url = `/media/${asset.assetId}`;
        await tx.campaignElement.update({
          where: { elementId },
          data:
            slot === 'cover'
              ? { coverAssetId: asset.assetId, coverUrl: url }
              : { mapAssetId: asset.assetId, imageUrl: url },
        });
        const previous =
          slot === 'cover' ? element.coverAsset : element.mapAsset;
        if (previous) {
          await tx.mediaAsset.delete({ where: { assetId: previous.assetId } });
        }
        return {
          assetId: asset.assetId,
          url,
          previousKey: previous?.storageKey,
        };
      });
    } catch (error) {
      await this.removeStorageFile(storageKey);
      throw error;
    }

    if (result.previousKey) await this.removeStorageFile(result.previousKey);
    return result;
  }

  private async detachElementAsset(
    userId: string,
    elementId: string,
    slot: ElementMediaSlot,
  ): Promise<void> {
    const storageKey = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "elementId" FROM "campaign_elements" WHERE "elementId" = ${elementId} FOR UPDATE`;
      const element = await tx.campaignElement.findFirst({
        where: { elementId, ...editableElementWhere(userId) },
        select: {
          coverAsset: { select: { assetId: true, storageKey: true } },
          mapAsset: { select: { assetId: true, storageKey: true } },
        },
      });
      if (!element) throw this.elementNotFound();
      const asset = slot === 'cover' ? element.coverAsset : element.mapAsset;
      if (!asset) throw new NotFoundException();
      await tx.campaignElement.update({
        where: { elementId },
        data:
          slot === 'cover'
            ? { coverAssetId: null, coverUrl: null }
            : { mapAssetId: null, imageUrl: null },
      });
      await tx.mediaAsset.delete({ where: { assetId: asset.assetId } });
      return asset.storageKey;
    });
    await this.removeStorageFile(storageKey);
  }

  // Removes media that no entity references any more: asset rows whose owner
  // is gone and stored or temporary files without an asset row. Only entries
  // older than the grace period are touched so in-flight uploads survive.
  async reconcile({ apply, graceMs }: { apply: boolean; graceMs: number }) {
    const cutoff = new Date(Date.now() - graceMs);
    const orphanAssetWhere: Prisma.MediaAssetWhereInput = {
      createdAt: { lt: cutoff },
      OR: [
        { purpose: 'AVATAR', avatarOwner: { is: null } },
        { purpose: 'CHARACTER_AVATAR', characterAvatar: { is: null } },
        { purpose: 'CAMPAIGN_COVER', campaignCover: { is: null } },
        { purpose: 'CAMPAIGN_BACKGROUND', backgroundCampaignId: null },
        { purpose: 'ELEMENT_COVER', elementCover: { is: null } },
        { purpose: 'LOCATION_MAP', elementMap: { is: null } },
      ],
    };
    const orphanAssets = await this.prisma.mediaAsset.findMany({
      where: orphanAssetWhere,
      select: { assetId: true, storageKey: true },
    });
    const orphanKeys = new Set(orphanAssets.map((asset) => asset.storageKey));
    const knownKeys = new Set(
      (
        await this.prisma.mediaAsset.findMany({ select: { storageKey: true } })
      ).map((asset) => asset.storageKey),
    );

    const orphanFiles: string[] = [];
    for (const directory of [this.storagePath, MEDIA_UPLOAD_TEMP_PATH]) {
      const entries = await readdir(directory, { withFileTypes: true }).catch(
        () => [],
      );
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        // Files of orphan asset rows are removed together with the rows.
        if (directory === this.storagePath && knownKeys.has(entry.name)) {
          continue;
        }
        const path = join(directory, entry.name);
        const { mtime } = await stat(path);
        if (mtime < cutoff) orphanFiles.push(path);
      }
    }

    if (apply) {
      if (orphanAssets.length) {
        await this.prisma.mediaAsset.deleteMany({
          where: {
            ...orphanAssetWhere,
            assetId: { in: orphanAssets.map((asset) => asset.assetId) },
          },
        });
        await Promise.all(
          [...orphanKeys].map((key) => this.removeStorageFile(key)),
        );
      }
      await Promise.all(orphanFiles.map((path) => rm(path, { force: true })));
    }

    return {
      applied: apply,
      orphanAssets: orphanAssets.length,
      orphanFiles: orphanFiles.length,
    };
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
          {
            purpose: 'ELEMENT_COVER',
            elementCover: {
              coverUrl: `/media/${assetId}`,
              ...readableElementWhere(userId),
            },
          },
          {
            purpose: 'LOCATION_MAP',
            elementMap: {
              imageUrl: `/media/${assetId}`,
              ...readableElementWhere(userId),
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

  private async normalizeElementCover(
    file: UploadedFile,
  ): Promise<NormalizedAvatar> {
    await this.validateUpload(file);
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: MAX_ELEMENT_COVER_DIMENSION ** 2,
      }).rotate();
      const { width, height } = orientedSize(await image.metadata());
      if (
        !width ||
        !height ||
        Math.min(width, height) < MIN_ELEMENT_COVER_DIMENSION ||
        Math.max(width, height) > MAX_ELEMENT_COVER_DIMENSION ||
        width / height < 0.5 ||
        width / height > 2
      ) {
        throw this.invalidMedia(
          'media.invalid_element_cover_dimensions',
          'Element covers must be 256–4096 pixels per side with an aspect ratio between 1:2 and 2:1',
        );
      }
      const { data, info } = await image
        .resize({
          width: NORMALIZED_ELEMENT_COVER_DIMENSION,
          height: NORMALIZED_ELEMENT_COVER_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp()
        .toBuffer({ resolveWithObject: true });
      return { content: data, width: info.width, height: info.height };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw this.invalidMedia(
        'media.invalid_file',
        'The image file is invalid',
      );
    }
  }

  // Maps are decoded from the temporary upload file, never from a request
  // buffer, so large sources are not held in memory before validation.
  private async normalizeMap(
    path: string | undefined,
  ): Promise<NormalizedAvatar> {
    const size = path ? (await stat(path)).size : 0;
    if (!path || !size) {
      throw this.invalidMedia(
        'media.invalid_file',
        'An image file is required',
      );
    }
    if (size > MAX_MAP_BYTES) {
      throw this.invalidMedia(
        'media.file_too_large',
        'The image file exceeds 10 MiB',
      );
    }
    const handle = await open(path, 'r');
    const header = Buffer.alloc(12);
    try {
      await handle.read(header, 0, header.length, 0);
    } finally {
      await handle.close();
    }
    if (!hasSupportedImageSignature(header)) {
      throw this.invalidMedia(
        'media.unsupported_type',
        'The image format is not supported',
      );
    }

    try {
      const image = sharp(path, { limitInputPixels: MAX_MAP_PIXELS }).rotate();
      const { width, height } = orientedSize(await image.metadata());
      if (
        !width ||
        !height ||
        Math.max(width, height) < MIN_MAP_LONG_SIDE ||
        Math.max(width, height) > MAX_MAP_DIMENSION ||
        Math.min(width, height) < MIN_MAP_SHORT_SIDE ||
        width * height > MAX_MAP_PIXELS
      ) {
        throw this.invalidMedia(
          'media.invalid_map_dimensions',
          'Maps must have a long side of 1024–8192 pixels, a short side of at least 256 pixels and at most 40 megapixels',
        );
      }
      const { data, info } = await image
        .resize({
          width: NORMALIZED_MAP_DIMENSION,
          height: NORMALIZED_MAP_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp()
        .toBuffer({ resolveWithObject: true });
      return { content: data, width: info.width, height: info.height };
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

  private elementNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'resource.not_found',
      'Element not found',
    );
  }

  private invalidMedia(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.BAD_REQUEST, code, message);
  }
}
