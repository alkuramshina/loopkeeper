import { BadRequestException, ValidationError } from '@nestjs/common';
import { ErrorViolation } from './domain.exception';

export class ValidationException extends BadRequestException {
  constructor(errors: ValidationError[]) {
    super({
      code: 'validation.failed',
      message: 'Request validation failed',
      violations: collectViolations(errors),
    });
  }
}

function collectViolations(
  errors: ValidationError[],
  parentPath = '',
): ErrorViolation[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const ownViolations = Object.keys(error.constraints ?? {}).map(
      (constraint) => ({
        field,
        code: constraintCode(constraint),
      }),
    );

    return [
      ...ownViolations,
      ...collectViolations(error.children ?? [], field),
    ];
  });
}

function constraintCode(constraint: string): string {
  if (['isEmail', 'isUrl', 'isUUID', 'isDateString'].includes(constraint)) {
    return 'validation.invalid_format';
  }

  if (constraint === 'isDefined') {
    return 'validation.required';
  }

  return 'validation.invalid_value';
}
