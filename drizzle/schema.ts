import { sql } from "drizzle-orm";
import { bigint, boolean, char, decimal, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Usuários com login próprio (email + senha com hash bcrypt).
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
/** Usuário sem o hash da senha — é o que circula no contexto e vai para o cliente. */
export type PublicUser = Omit<User, "passwordHash">;

/**
 * Categories for organizing transactions
 */
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3B82F6").notNull(), // hex color
  icon: varchar("icon", { length: 50 }).default("tag").notNull(), // lucide icon name
  type: mysqlEnum("type", ["income", "expense", "both"]).default("both").notNull(),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Transactions (income and expenses)
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  categoryId: int("categoryId").notNull(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  amount: int("amount").notNull(), // stored in cents to avoid decimal issues
  description: varchar("description", { length: 255 }),
  date: timestamp("date").notNull(), // transaction date
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Monthly budgets by category
 */
export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  categoryId: int("categoryId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  limit: int("limit").notNull(), // in cents
  alertPercentage: int("alertPercentage").default(80).notNull(), // alert when spent % of limit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

/**
 * Financial goals and savings targets
 */
export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  targetAmount: int("targetAmount").notNull(), // in cents
  currentAmount: int("currentAmount").default(0).notNull(), // in cents
  deadline: timestamp("deadline"),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;

// ===== 2FA (TOTP) — tabelas novas já no padrão (snake_case, UUID, FK com CASCADE); as antigas ficam como estão =====

/**
 * Credencial do segundo fator, separada do perfil (users). Uma por usuário: user_id é a própria chave.
 * enabled_at NULL = QR gerado, mas ainda não confirmado com um código.
 */
export const userTotp = mysqlTable("user_totp", {
  // CASCADE: a credencial não tem sentido sem o usuário
  userId: int("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  secretEncrypted: varchar("secret_encrypted", { length: 255 }).notNull(), // SENSÍVEL: AES-256-GCM com TOTP_ENCRYPTION_KEY
  enabledAt: timestamp("enabled_at"),
  lastUsedStep: bigint("last_used_step", { mode: "number" }), // impede reusar o mesmo código dentro dos 30 s
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(), // mantido pelo banco
});

export const recoveryCodes = mysqlTable(
  "recovery_codes",
  {
    id: char("id", { length: 36 }).primaryKey().default(sql`(uuid())`),
    // CASCADE: códigos só valem para a conta dona
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    codeHash: char("code_hash", { length: 64 }).notNull(), // SENSÍVEL: SHA-256 do código, nunca o código
    usedAt: timestamp("used_at"), // uso único
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  // índice único com user_id primeiro: garante código único por conta e serve de índice da FK
  (t) => [uniqueIndex("recovery_codes_user_code").on(t.userId, t.codeHash)],
);
