import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { CampaignAccessService } from './access/campaign-access.service';
import { CampaignService } from './campaign.service';

describe('CampaignService', () => {
  const prisma = {
    campaign: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
  const campaignAccess = {} as CampaignAccessService;
  const service = new CampaignService(
    prisma,
    campaignAccess,
    {} as MediaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a campaign accessible to the current user', async () => {
    const campaign = {
      campaignId: 'campaign-id',
      title: 'The Loop',
      ownerId: 'user-id',
      members: [],
      backgroundSelectionMode: 'FIXED',
      fixedBackgroundId: null,
      backgrounds: [],
    };
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(campaign);

    await expect(
      service.findOne('user-id', campaign.campaignId),
    ).resolves.toMatchObject({
      campaignId: campaign.campaignId,
      title: campaign.title,
      currentUserRole: 'OWNER',
      backgroundConfig: {
        selectionMode: 'FIXED',
        fixedBackgroundId: null,
        backgrounds: [],
      },
    });
  });

  it('returns a campaign-not-found code when a campaign is inaccessible', async () => {
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.findOne('user-id', 'missing-id'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'campaign.not_found' }),
    });
  });
});
