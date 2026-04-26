const DEFAULT_SALT_ROUNDS = 10;

export function getPasswordSaltRounds() {
  const parsed = Number(process.env.CRYPT_SALT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_SALT_ROUNDS;
}
