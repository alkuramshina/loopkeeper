import express from 'express';
import request from 'supertest';
import { Readable } from 'node:stream';
import { get } from 'node:http';
import { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { DomainException } from '../common/exceptions/domain.exception';

describe('Protected media streaming', () => {
  function app(body: Readable, byteSize = 5) {
    const service = {
      getMediaContent: jest
        .fn()
        .mockResolvedValue({ body, byteSize, contentType: 'image/webp' }),
    };
    const controller = new MediaController(service as unknown as MediaService);
    const api = express();
    api.get('/media', async (_req, res) => {
      try {
        await controller.getMedia(
          { user: { userId: 'user' } as TokenPayloadDto },
          'asset',
          res,
        );
      } catch (error) {
        const domain = error as DomainException;
        res.status(domain.getStatus()).json(domain.getResponse());
      }
    });
    return api;
  }
  it('delivers bytes with protected headers and closes the source', async () => {
    const body = Readable.from(Buffer.from('image'));
    await request(app(body))
      .get('/media')
      .expect(200)
      .expect('Content-Length', '5')
      .expect('Content-Type', /image\/webp/)
      .expect('Cache-Control', 'private, max-age=0, must-revalidate');
    expect(body.destroyed).toBe(true);
  });
  it('returns safe 503 when the first read fails before headers', async () => {
    const body = new Readable({
      read() {
        this.destroy(new Error('secret upstream failure'));
      },
    });
    await request(app(body))
      .get('/media')
      .expect(503)
      .expect((response) => {
        expect(response.body.code).toBe('media.storage_unavailable');
        expect(JSON.stringify(response.body)).not.toContain('secret');
      });
    expect(body.destroyed).toBe(true);
  });
  it('terminates the response when an upstream failure follows the first bytes', async () => {
    const body = new Readable({
      read() {
        this.push(Buffer.from('im'));
        setImmediate(() => this.destroy(new Error('upstream failed')));
      },
    });
    await expect(request(app(body)).get('/media')).rejects.toThrow();
    expect(body.destroyed).toBe(true);
  });
  it('closes the upstream stream when the HTTP client disconnects', async () => {
    let sent = false;
    const body = new Readable({
      read() {
        if (!sent) {
          sent = true;
          this.push(Buffer.from('im'));
        }
      },
    });
    const server = app(body).listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      await new Promise<void>((resolve, reject) => {
        body.once('close', resolve);
        const client = get(
          `http://127.0.0.1:${(server.address() as AddressInfo).port}/media`,
          (response) => {
            response.once('data', () => {
              response.destroy();
              client.destroy();
            });
          },
        );
        client.once('error', reject);
      });
      expect(body.destroyed).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
