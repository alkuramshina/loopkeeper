import { HttpStatus, Injectable } from '@nestjs/common';
import { CharacterTemplateKind, Prisma } from '@prisma/client';
import {
  DomainException,
  ErrorViolation,
} from '../common/exceptions/domain.exception';
import { CampaignAccessService } from '../campaign/access/campaign-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

type FieldDefinition = {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: string[];
};

type CharacterSchema = { fields: FieldDefinition[] };

@Injectable()
export class CharacterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignAccess: CampaignAccessService,
  ) {}

  async create(
    userId: string,
    campaignId: string,
    createDto: CreateCharacterDto,
  ) {
    const isNPC = createDto.isNPC === true;
    if (isNPC) {
      await this.campaignAccess.requireOwner(userId, campaignId);
    } else {
      await this.campaignAccess.requirePlayer(userId, campaignId);
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId },
      select: { system: true },
    });
    if (!campaign?.system) {
      throw this.campaignNotFound();
    }

    const template = await this.prisma.characterTemplate.findFirst({
      where: {
        templateId: createDto.templateId,
        systemSlug: campaign.system,
        isActive: true,
      },
    });
    if (!template || template.characterKind !== this.templateKindFor(isNPC)) {
      throw this.templateNotFound();
    }

    this.validateData(createDto.data, template.schema);

    return this.prisma.character.create({
      data: {
        campaignId,
        ownerId: userId,
        templateId: template.templateId,
        name: createDto.name,
        description: createDto.description,
        avatarUrl: createDto.avatarUrl,
        data: createDto.data as Prisma.InputJsonValue,
        isNPC,
      },
    });
  }

  async findAll(userId: string, campaignId: string) {
    await this.campaignAccess.requireMember(userId, campaignId);

    return this.prisma.character.findMany({
      where: { campaignId },
      orderBy: [{ isNPC: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(userId: string, characterId: string) {
    const character = await this.prisma.character.findFirst({
      where: {
        characterId,
        campaign: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      },
    });

    if (!character) {
      throw this.characterNotFound();
    }

    return character;
  }

  async update(
    userId: string,
    characterId: string,
    updateDto: UpdateCharacterDto,
  ) {
    const character = await this.findOne(userId, characterId);

    if (character.isNPC) {
      await this.campaignAccess.requireOwner(userId, character.campaignId);
    } else if (character.ownerId !== userId) {
      throw this.characterNotFound();
    } else {
      await this.campaignAccess.requirePlayer(userId, character.campaignId);
    }

    if (updateDto.data) {
      const template = await this.prisma.characterTemplate.findUnique({
        where: { templateId: character.templateId },
        select: { schema: true },
      });
      if (!template) {
        throw this.templateNotFound();
      }
      this.validateData(updateDto.data, template.schema);
    }

    return this.prisma.character.update({
      where: { characterId },
      data: {
        name: updateDto.name,
        description: updateDto.description,
        avatarUrl: updateDto.avatarUrl,
        data: updateDto.data as Prisma.InputJsonValue | undefined,
        isActive: updateDto.isActive,
      },
    });
  }

  async remove(userId: string, characterId: string) {
    const character = await this.findOne(userId, characterId);

    if (character.isNPC) {
      await this.campaignAccess.requireOwner(userId, character.campaignId);
    } else if (character.ownerId !== userId) {
      throw this.characterNotFound();
    } else {
      await this.campaignAccess.requirePlayer(userId, character.campaignId);
    }

    await this.prisma.character.delete({ where: { characterId } });
  }

  private templateKindFor(isNPC: boolean): CharacterTemplateKind {
    return isNPC
      ? CharacterTemplateKind.NPC
      : CharacterTemplateKind.PLAYER_CHARACTER;
  }

  private validateData(
    data: Record<string, unknown>,
    rawSchema: Prisma.JsonValue,
  ) {
    const schema = rawSchema as unknown as CharacterSchema;
    if (!Array.isArray(schema.fields)) {
      throw new DomainException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'internal.error',
        'An unexpected error occurred',
      );
    }

    const fieldsByKey = new Map(
      schema.fields.map((field) => [field.key, field]),
    );
    const violations: ErrorViolation[] = [];

    for (const key of Object.keys(data)) {
      if (!fieldsByKey.has(key)) {
        violations.push({ field: `data.${key}`, code: 'validation.invalid_value' });
      }
    }

    for (const field of schema.fields) {
      const value = data[field.key];
      const fieldPath = `data.${field.key}`;
      if (value === undefined || value === null) {
        if (field.required) {
          violations.push({ field: fieldPath, code: 'validation.required' });
        }
        continue;
      }

      if (field.type === 'string' || field.type === 'select') {
        if (typeof value !== 'string') {
          violations.push({ field: fieldPath, code: 'validation.invalid_value' });
          continue;
        }
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          violations.push({ field: fieldPath, code: 'validation.invalid_value' });
        }
        if (field.options && !field.options.includes(value)) {
          violations.push({ field: fieldPath, code: 'validation.invalid_value' });
        }
      } else if (field.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          violations.push({ field: fieldPath, code: 'validation.invalid_value' });
          continue;
        }
        if (field.min !== undefined && value < field.min) {
          violations.push({ field: fieldPath, code: 'validation.invalid_value' });
        }
        if (field.max !== undefined && value > field.max) {
          violations.push({ field: fieldPath, code: 'validation.invalid_value' });
        }
      } else if (field.type === 'boolean' && typeof value !== 'boolean') {
        violations.push({ field: fieldPath, code: 'validation.invalid_value' });
      }
    }

    if (violations.length > 0) {
      throw new DomainException(
        HttpStatus.BAD_REQUEST,
        'validation.failed',
        'Request validation failed',
        violations,
      );
    }
  }

  private campaignNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'campaign.not_found',
      'The requested campaign is unavailable',
    );
  }

  private characterNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'resource.not_found',
      'The requested character is unavailable',
    );
  }

  private templateNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'resource.not_found',
      'The requested character template is unavailable',
    );
  }
}
