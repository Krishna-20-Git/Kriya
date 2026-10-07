import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

export const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/**
 * Compared against when the email does not exist, so "unknown email" and "wrong password"
 * take the same time and an attacker cannot enumerate accounts by measuring response time.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-attack-dummy-password', env.BCRYPT_ROUNDS);
