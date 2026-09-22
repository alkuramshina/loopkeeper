import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from './campaign.service';

describe('CampaignService', () => {
  const prisma = {
    campaign: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
  const service = new CampaignService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an existing campaign', async () => {
    const campaign = { campaignId: 'campaign-id', title: 'The Loop' };
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(campaign);

    await expect(service.findOne(campaign.campaignId)).resolves.toBe(campaign);
  });

  it('throws 404 when a campaign does not exist', async () => {
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
