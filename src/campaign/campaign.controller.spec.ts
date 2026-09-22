import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';

describe('CampaignController', () => {
  it('is defined with a campaign service dependency', () => {
    const controller = new CampaignController({} as CampaignService);

    expect(controller).toBeDefined();
  });
});
