import { Module } from '@nestjs/common';
import { UserService, PRISMA_CLIENT } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: PRISMA_CLIENT,
      useFactory: (prisma: PrismaService) => prisma,
      inject: [PrismaService],
    },
  ],
  exports: [UserService],
})
export class UserModule { }
