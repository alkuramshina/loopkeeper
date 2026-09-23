import { Prisma } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
import { CampaignAccessService } from '../campaign/access/campaign-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CharacterService } from './character.service';

type CharacterServiceWithValidator = {
  validateData(data: Record<string, unknown>, schema: Prisma.JsonValue): void;
};

describe('CharacterService', () => {
  const service = new CharacterService(
    {} as PrismaService,
    {} as CampaignAccessService,
  );
  const validator = service as unknown as CharacterServiceWithValidator;
  const schema = {
    fields: [
      { key: 'age', type: 'number', required: true, min: 10, max: 19 },
      { key: 'pride', type: 'string', required: true, maxLength: 20 },
    ],
  } as Prisma.JsonValue;

  it('accepts data that conforms to the template schema', () => {
    expect(() =>
      validator.validateData({ age: 15, pride: 'My friends' }, schema),
    ).not.toThrow();
  });

  it('returns structured violations for missing, invalid, and unknown fields', () => {
    try {
      validator.validateData({ age: 25, unexpected: true }, schema);
      fail('Expected validation to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).getResponse()).toMatchObject({
        code: 'validation.failed',
        violations: expect.arrayContaining([
          { field: 'data.age', code: 'validation.invalid_value' },
          { field: 'data.pride', code: 'validation.required' },
          { field: 'data.unexpected', code: 'validation.invalid_value' },
        ]),
      });
    }
  });
});
