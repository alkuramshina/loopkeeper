import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
      throw new NotFoundException('Campaign not found');
    }

    const template = await this.prisma.characterTemplate.findFirst({
      where: {
        templateId: createDto.templateId,
        systemSlug: campaign.system,
        isActive: true,
      },
    });
    if (!template) {
      throw new NotFoundException('Character template not found');
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
      throw new NotFoundException('Character not found');
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
      throw new NotFoundException('Character not found');
    } else {
      await this.campaignAccess.requirePlayer(userId, character.campaignId);
    }

    if (updateDto.data) {
      const template = await this.prisma.characterTemplate.findUnique({
        where: { templateId: character.templateId },
        select: { schema: true },
      });
      if (!template) {
        throw new NotFoundException('Character template not found');
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
      throw new NotFoundException('Character not found');
    } else {
      await this.campaignAccess.requirePlayer(userId, character.campaignId);
    }

    await this.prisma.character.delete({ where: { characterId } });
  }

  private validateData(
    data: Record<string, unknown>,
    rawSchema: Prisma.JsonValue,
  ) {
    const schema = rawSchema as unknown as CharacterSchema;
    if (!Array.isArray(schema.fields)) {
      throw new BadRequestException('Character template has an invalid schema');
    }

    const fieldsByKey = new Map(
      schema.fields.map((field) => [field.key, field]),
    );
    const errors: string[] = [];

    for (const key of Object.keys(data)) {
      if (!fieldsByKey.has(key)) {
        errors.push(`data.${key} is not supported by the character template`);
      }
    }

    for (const field of schema.fields) {
      const value = data[field.key];
      if (value === undefined || value === null) {
        if (field.required) {
          errors.push(`data.${field.key} is required`);
        }
        continue;
      }

      if (field.type === 'string' || field.type === 'select') {
        if (typeof value !== 'string') {
          errors.push(`data.${field.key} must be a string`);
          continue;
        }
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          errors.push(
            `data.${field.key} must not exceed ${field.maxLength} characters`,
          );
        }
        if (field.options && !field.options.includes(value)) {
          errors.push(`data.${field.key} must be one of the template options`);
        }
      } else if (field.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push(`data.${field.key} must be a finite number`);
          continue;
        }
        if (field.min !== undefined && value < field.min) {
          errors.push(`data.${field.key} must be at least ${field.min}`);
        }
        if (field.max !== undefined && value > field.max) {
          errors.push(`data.${field.key} must not exceed ${field.max}`);
        }
      } else if (field.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`data.${field.key} must be a boolean`);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }
  }
}
