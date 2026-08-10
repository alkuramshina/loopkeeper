import { Test, TestingModule } from '@nestjs/testing';
import { PRISMA_CLIENT, UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PRISMA_CLIENT,
          useValue: {
            user: {
              findFirst: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find a user by email through the data store', async () => {
    const mockPrisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          userId: '1',
          email: 'admin@example.com',
          passwordHash: 'hash',
          name: 'Admin',
          applicationRole: 'USER',
        }),
      },
    };

    const serviceWithPrisma = new UserService(mockPrisma as never);
    const user = await serviceWithPrisma.findOne('admin@example.com');

    expect(user?.email).toBe('admin@example.com');
  });
});
