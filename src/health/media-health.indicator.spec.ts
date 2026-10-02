import { MediaHealthIndicator } from './media-health.indicator';
import { MediaStorage } from '../media/media-storage';

describe('MediaHealthIndicator', () => {
  it('reports bucket availability without disclosing SDK errors', async () => {
    const ready = jest.fn().mockResolvedValue(undefined);
    const indicator = new MediaHealthIndicator({
      ready,
    } as unknown as MediaStorage);
    await expect(indicator.isHealthy('media')).resolves.toEqual({
      media: { status: 'up' },
    });
    ready.mockRejectedValue(new Error('secret endpoint bucket credentials'));
    await expect(indicator.isHealthy('media')).rejects.toMatchObject({
      message: 'Media storage health check failed',
      causes: { media: { status: 'down' } },
    });
  });
});
