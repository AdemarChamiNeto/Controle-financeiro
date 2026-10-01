import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "path";
import { users, categories, transactions, budgets, goals } from "../drizzle/schema";

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
