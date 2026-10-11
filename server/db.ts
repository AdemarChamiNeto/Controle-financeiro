import { eq, and, gte, lte, desc, asc, isNull, isNotNull, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "path";
import { users, categories, transactions, budgets, goals, userTotp, recoveryCodes } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Aplica as migrations pendentes da pasta drizzle/ (roda na subida do servidor). */
export async function runMigrations() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL não configurada");
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
}

// Users
export async function createUser(data: { name: string; email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(users).values(data);
  return result[0].insertId;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function touchLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// Categories queries
export async function getUserCategories(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.name));
}

export async function getCategoryById(userId: number, categoryId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.id, categoryId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Transactions queries
export async function getUserTransactions(userId: number, startDate?: Date, endDate?: Date, categoryId?: number, type?: string) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(transactions.userId, userId)];
  if (startDate) conditions.push(gte(transactions.date, startDate));
  if (endDate) conditions.push(lte(transactions.date, endDate));
  if (categoryId) conditions.push(eq(transactions.categoryId, categoryId));
  if (type) conditions.push(eq(transactions.type, type as any));

  return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.date));
}

export async function getTransactionById(userId: number, transactionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Budgets queries
export async function getUserBudgets(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(budgets).where(and(eq(budgets.userId, userId), eq(budgets.year, year), eq(budgets.month, month)));
}

export async function getBudgetById(userId: number, budgetId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(budgets).where(and(eq(budgets.userId, userId), eq(budgets.id, budgetId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Goals queries
export async function getUserGoals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.deadline));
}

export async function getGoalById(userId: number, goalId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.id, goalId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

export async function updatePasswordHash(id: number, passwordHash: string) {
  const db = await requireDb();
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// ===== 2FA (TOTP) =====

export async function getTotp(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(userTotp).where(eq(userTotp.userId, userId)).limit(1);
  return result[0];
}

export async function isTwoFactorEnabled(userId: number) {
  const t = await getTotp(userId);
  return Boolean(t?.enabledAt);
}

/** Grava (ou troca) o segredo ainda não confirmado. */
export async function savePendingTotpSecret(userId: number, secretEncrypted: string) {
  const db = await requireDb();
  await db
    .insert(userTotp)
    .values({ userId, secretEncrypted })
    .onDuplicateKeyUpdate({ set: { secretEncrypted, enabledAt: null, lastUsedStep: null } });
}

/** Ativa o 2FA e troca os códigos de recuperação, tudo na mesma transação. */
export async function enableTotp(userId: number, step: number, recoveryHashes: string[]) {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx.update(userTotp).set({ enabledAt: new Date(), lastUsedStep: step }).where(eq(userTotp.userId, userId));
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await tx.insert(recoveryCodes).values(recoveryHashes.map((codeHash) => ({ userId, codeHash })));
  });
}

/** Grava o passo usado só se ninguém usou um igual ou maior no meio tempo (duas requisições ao mesmo tempo). */
export async function claimTotpStep(userId: number, step: number) {
  const db = await requireDb();
  const [r] = await db
    .update(userTotp)
    .set({ lastUsedStep: step })
    .where(and(eq(userTotp.userId, userId), isNotNull(userTotp.enabledAt), or(isNull(userTotp.lastUsedStep), lt(userTotp.lastUsedStep, step))));
  return r.affectedRows === 1;
}

/** Marca o código de recuperação como usado; false se não existe ou já foi usado. */
export async function useRecoveryCode(userId: number, codeHash: string) {
  const db = await requireDb();
  const [r] = await db
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.codeHash, codeHash), isNull(recoveryCodes.usedAt)));
  return r.affectedRows === 1;
}

export async function recoveryCodesLeft(userId: number) {
  const db = await requireDb();
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(recoveryCodes)
    .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
  return Number(r.n);
}

export async function disableTotp(userId: number) {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx.delete(userTotp).where(eq(userTotp.userId, userId));
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
  });
}
