import * as bcrypt from 'bcrypt';
import { HttpStatus } from '@nestjs/common';

import { ERROR_CODES } from '../constants/error-codes';
import { appException } from './app-exception';

const SALT_ROUNDS = 10;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
export const PASSWORD_POLICY_MESSAGE =
  'Mat khau phai co it nhat 8 ky tu, bao gom chu hoa, chu thuong va so';

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (
  password: string,
  passwordHash: string
): Promise<boolean> => bcrypt.compare(password, passwordHash);

export const isStrongPassword = (password: string) =>
  password.length >= PASSWORD_MIN_LENGTH && PASSWORD_POLICY_REGEX.test(password);

export const assertPasswordPolicy = (password: string) => {
  if (!isStrongPassword(password)) {
    throw appException(
      HttpStatus.BAD_REQUEST,
      ERROR_CODES.VALIDATION_INVALID_PAYLOAD,
      PASSWORD_POLICY_MESSAGE
    );
  }

  return password;
};
