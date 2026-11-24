import argon2 from "argon2";

export const passwordHashOptions: argon2.Options & { type: number } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};

const DUMMY_PASSWORD = "HabitHop dummy credential used only for constant-time lookup comparison";
let dummyHashPromise: Promise<string> | undefined;

export async function initializeDummyPasswordHash(): Promise<void> {
  dummyHashPromise ??= argon2.hash(DUMMY_PASSWORD, passwordHashOptions);
  await dummyHashPromise;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, passwordHashOptions);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function verifyUserPassword(password: string, passwordHash?: string | null): Promise<boolean> {
  await initializeDummyPasswordHash();
  const hash = passwordHash ?? await dummyHashPromise!;
  const valid = await argon2.verify(hash, password);
  return Boolean(passwordHash) && valid;
}
