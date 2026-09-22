import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const publicUserSelect = {
  userId: true,
  email: true,
  name: true,
  avatarUrl: true,
  applicationRole: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const passwordHash = await this.hashPassword(createUserDto.password);

    return this.prisma.user.create({
      data: {
        email: this.normalizeEmail(createUserDto.email),
        passwordHash,
        name: createUserDto.name,
      },
      select: publicUserSelect,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      where: { isDeleted: false },
      select: publicUserSelect,
    });
  }

  async findOne(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        isDeleted: false,
        OR: [{ email: this.normalizeEmail(identifier) }, { name: identifier }],
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email: this.normalizeEmail(email),
        isDeleted: false,
      },
    });
  }

  findPublicById(userId: string) {
    return this.prisma.user.findFirst({
      where: { userId, isDeleted: false },
      select: publicUserSelect,
    });
  }

  findById(userId: string) {
    return this.prisma.user.findFirst({
      where: { userId, isDeleted: false },
    });
  }

  update(userId: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { userId },
      data: {
        name: updateUserDto.name,
        avatarUrl: updateUserDto.avatarUrl,
      },
      select: publicUserSelect,
    });
  }

  async remove(userId: string) {
    await this.prisma.user.update({
      where: { userId },
      data: { isDeleted: true },
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
