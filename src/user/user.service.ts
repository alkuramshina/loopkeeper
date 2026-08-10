import { Injectable, Inject } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

@Injectable()
export class UserService {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: Pick<PrismaService, 'user'>) {}

  async create(createUserDto: CreateUserDto) {
    const passwordHash = await this.hashPassword(createUserDto.password);

    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        name: createUserDto.name,
      },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: {
        userId: true,
        email: true,
        name: true,
        applicationRole: true,
      },
    });
  }

  async findOne(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { name: identifier },
        ],
      },
    });
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  private async hashPassword(password: string): Promise<string> {
    const hashedPassword = await argon2.hash(password);
    return hashedPassword;
  }
}
