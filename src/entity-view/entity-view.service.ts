import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityViewType } from '@prisma/client';
import { CampaignAccessService } from '../campaign/access/campaign-access.service';
import { lockCampaignMember } from '../campaign/access/campaign-write';
import { DomainException } from '../common/exceptions/domain.exception';
import { readableElementWhere } from '../element/element-access';
import {
  visibleCardWhere,
  visibleLinkWhere,
} from '../investigation-board/board-access';
import { PrismaService } from '../prisma/prisma.service';
import { RecordViewsDto } from './dto/record-views.dto';

@Injectable()
export class EntityViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CampaignAccessService,
  ) {}

  async record(userId: string, campaignId: string, dto: RecordViewsDto) {
    await this.access.requireMember(userId, campaignId);
    const entities = [
      ...new Map(
        dto.entities.map((entity) => [
          `${entity.entityType}:${entity.entityId}`,
          entity,
        ]),
      ).values(),
    ];
    await this.prisma.$transaction(async (tx) => {
      const member = await lockCampaignMember(tx, userId, campaignId);
      for (const entityType of Object.values(EntityViewType)) {
        const ids = entities
          .filter((entity) => entity.entityType === entityType)
          .map((entity) => entity.entityId);
        if (!ids.length) continue;
        const count =
          entityType === EntityViewType.ELEMENT
            ? await tx.campaignElement.count({
                where: {
                  campaignId,
                  elementId: { in: ids },
                  ...readableElementWhere(userId),
                },
              })
            : entityType === EntityViewType.BOARD_CARD
              ? await tx.investigationCard.count({
                  where: {
                    campaignId,
                    cardId: { in: ids },
                    AND: [visibleCardWhere],
                  },
                })
              : await tx.investigationLink.count({
                  where: {
                    campaignId,
                    linkId: { in: ids },
                    ...visibleLinkWhere,
                  },
                });
        if (count !== ids.length)
          throw new DomainException(
            HttpStatus.NOT_FOUND,
            'views.entity_not_found',
            'The requested entity is unavailable',
          );
      }
      await tx.entityView.createMany({
        data: entities.map((entity) => ({
          ...entity,
          memberId: member.memberId,
        })),
        skipDuplicates: true,
      });
    });
  }
}
