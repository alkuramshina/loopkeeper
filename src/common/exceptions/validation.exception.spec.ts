import { ValidationException } from './validation.exception';

describe('ValidationException', () => {
  it('creates locale-neutral, field-level violations', () => {
    const exception = new ValidationException([
      {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
        children: [],
      },
      {
        property: 'profile',
        children: [
          {
            property: 'name',
            constraints: { isString: 'name must be a string' },
            children: [],
          },
        ],
      },
    ]);

    expect(exception.getResponse()).toEqual({
      code: 'validation.failed',
      message: 'Request validation failed',
      violations: [
        { field: 'email', code: 'validation.invalid_format' },
        { field: 'profile.name', code: 'validation.invalid_value' },
      ],
    });
  });
});
