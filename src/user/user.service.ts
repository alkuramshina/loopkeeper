import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import * as argon2 from 'argon2';

const Users: User[] = [{
  userId: '12',
  username: 'john_doe',
  email: 'john@example.com',
  passwordHash: '$argon2id$v=19$m=65536,p=4,t=3$GAUCPG4+wR1vXrJ50hdAKw$tzT8xGhJ+hO4POpqst6FFnAvtgJm7BM+fE1t6Xcr0h8'
}];

@Injectable()
export class UserService {
  async create(createUserDto: CreateUserDto) {
    const passwordHash = await this.hashPassword(createUserDto.password);
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all user`;
  }

  async findOne(username: string): Promise<User | null> {
    return Users.find(user => user.username === username || user.email === username) || null;
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
