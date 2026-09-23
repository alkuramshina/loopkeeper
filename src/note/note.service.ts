import { HttpStatus, Injectable } from '@nestjs/common';
import { CampaignRole, NoteVisibility, Prisma } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { CampaignAccessService } from '../campaign/access/campaign-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignAccess: CampaignAccessService,
  ) {}

  async create(userId: string, campaignId: string, createDto: CreateNoteDto) {
    const access = await this.campaignAccess.getAccess(userId, campaignId);
    this.assertCanCreate(access, createDto.visibility);

    return this.prisma.note.create({
      data: { ...createDto, campaignId, authorId: userId },
    });
  }

  async findAll(userId: string, campaignId: string) {
    const access = await this.campaignAccess.getAccess(userId, campaignId);

    return this.prisma.note.findMany({
      where: {
        campaignId,
        ...this.readScope(userId, access),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: {
        noteId,
        campaign: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      },
    });
    if (!note) {
      throw this.noteNotFound();
    }

    const access = await this.campaignAccess.getAccess(userId, note.campaignId);
    if (!this.canRead(note, userId, access)) {
      throw this.noteNotFound();
    }

    return note;
  }

  async update(userId: string, noteId: string, updateDto: UpdateNoteDto) {
    const note = await this.findOne(userId, noteId);
    const access = await this.campaignAccess.getAccess(userId, note.campaignId);
    this.assertCanManage(note.authorId, userId, access.isOwner);

    if (updateDto.visibility) {
      this.assertCanCreate(access, updateDto.visibility);
    }

    return this.prisma.$transaction(async (transaction) => {
      const updatedNote = await transaction.note.update({
        where: { noteId },
        data: updateDto,
      });

      if (
        updateDto.visibility === NoteVisibility.PRIVATE ||
        updateDto.visibility === NoteVisibility.MASTER_ONLY
      ) {
        await transaction.investigationCard.deleteMany({ where: { noteId } });
      }

      return updatedNote;
    });
  }

  async remove(userId: string, noteId: string) {
    const note = await this.findOne(userId, noteId);
    const access = await this.campaignAccess.getAccess(userId, note.campaignId);
    this.assertCanManage(note.authorId, userId, access.isOwner);

    await this.prisma.note.delete({ where: { noteId } });
  }

  private noteNotFound(): DomainException {
    return new DomainException(
      HttpStatus.NOT_FOUND,
      'resource.not_found',
      'Note not found',
    );
  }

  private readScope(
    userId: string,
    access: { isOwner: boolean; campaignRole?: CampaignRole },
  ): Prisma.NoteWhereInput {
    if (access.isOwner) {
      return {
        OR: [
          { authorId: userId },
          { visibility: { not: NoteVisibility.PRIVATE } },
        ],
      };
    }
    if (access.campaignRole === CampaignRole.PLAYER) {
      return {
        OR: [
          { authorId: userId },
          {
            visibility: { in: [NoteVisibility.PLAYERS, NoteVisibility.PUBLIC] },
          },
        ],
      };
    }
    return { visibility: NoteVisibility.PUBLIC };
  }

  private canRead(
    note: { authorId: string; visibility: NoteVisibility },
    userId: string,
    access: { isOwner: boolean; campaignRole?: CampaignRole },
  ): boolean {
    if (note.authorId === userId) {
      return true;
    }
    if (note.visibility === NoteVisibility.PRIVATE) {
      return false;
    }
    if (access.isOwner) {
      return true;
    }
    if (note.visibility === NoteVisibility.MASTER_ONLY) {
      return false;
    }
    if (note.visibility === NoteVisibility.PLAYERS) {
      return access.campaignRole === CampaignRole.PLAYER;
    }
    return note.visibility === NoteVisibility.PUBLIC;
  }

  private assertCanCreate(
    access: { isOwner: boolean; campaignRole?: CampaignRole },
    visibility: NoteVisibility,
  ) {
    if (access.isOwner) {
      return;
    }
    if (
      access.campaignRole !== CampaignRole.PLAYER ||
      visibility === NoteVisibility.MASTER_ONLY
    ) {
      throw new DomainException(
        HttpStatus.FORBIDDEN,
        'resource.access_denied',
        'You cannot create a note with this visibility',
      );
    }
  }

  private assertCanManage(authorId: string, userId: string, isOwner: boolean) {
    if (isOwner || authorId === userId) {
      return;
    }
    throw new DomainException(
      HttpStatus.FORBIDDEN,
      'resource.access_denied',
      'You cannot modify this note',
    );
  }
}
