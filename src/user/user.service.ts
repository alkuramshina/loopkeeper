import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import * as argon2 from 'argon2';

@Injectable()
export class UserService {
  private users = [
    {
      userId: '12',
      username: 'john_doe',
      email: 'john@example.com',
      password: 'changeme',
    },
    {
      userId: '11',
      username: 'testuser',
      email: 'test@example.com',
      password: 'testpass',
    }];

  async create(createUserDto: CreateUserDto) {
    const passwordHash = await this.hashPassword(createUserDto.password);
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all user`;
  }

  async findOne(username: string): Promise<User | null> {
    const user = this.users.find(user => user.username === username || user.email === username) || null;
    if (!user) {
      return null;
    }

    return { ...user, passwordHash: await this.hashPassword(user.password) };
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
