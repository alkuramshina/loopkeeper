import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MediaService } from './media/media.service';

// Reports (and with --apply removes) media asset rows and files that no
// entity references any more. Entries younger than one hour are skipped.
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const report = await app.get(MediaService).reconcile({
      apply: process.argv.includes('--apply'),
      graceMs: 60 * 60 * 1000,
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await app.close();
  }
}

void main();
