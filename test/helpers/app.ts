import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApplication } from '../../src/app.setup';
import { configureTestEnvironment } from './test-environment';

export async function createTestApp(): Promise<INestApplication> {
  configureTestEnvironment();

  // Loaded lazily so configuration reads the test environment set above.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('../../src/app.module');
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication();

  configureApplication(app);
  await app.init();

  return app;
}
