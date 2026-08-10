import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

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
      where: {
        isDeleted: false,
      },
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
        isDeleted: false,
        OR: [
          { email: identifier },
          { name: identifier },
        ],
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return await this.prisma.user.update({
      where: { userId: id },
      data: {
        name: updateUserDto.name,
        avatarUrl: updateUserDto.avatarUrl,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.user.update({
      where: { userId: id },
      data: { isDeleted: true },
    });
  }

  private async hashPassword(password: string): Promise<string> {
    const hashedPassword = await argon2.hash(password);
    return hashedPassword;
  }
}
