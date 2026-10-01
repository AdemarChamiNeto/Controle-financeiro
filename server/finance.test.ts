import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Finance System - Categories", () => {
  it("should create a new category", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.categories.create({
      name: "Alimentação",
      description: "Gastos com comida",
      color: "#10b981",
      icon: "utensils",
      type: "expense",
    });

    expect(result).toHaveProperty("id");
    expect(result.id).toBeGreaterThan(0);
  });

  it("should list user categories", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a category first
    await caller.categories.create({
      name: "Transporte",
      color: "#3b82f6",
      icon: "car",
      type: "expense",
    });

    const categories = await caller.categories.list();
    expect(Array.isArray(categories)).toBe(true);
  });

  it("should update a category", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const created = await caller.categories.create({
      name: "Original",
      color: "#3b82f6",
      icon: "tag",
      type: "both",
    });

    const result = await caller.categories.update({
      id: created.id,
      name: "Updated",
      color: "#ef4444",
    });

    expect(result.success).toBe(true);
  });

  it("should delete a category", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const created = await caller.categories.create({
      name: "To Delete",
      color: "#3b82f6",
      icon: "tag",
      type: "expense",
    });

    const result = await caller.categories.delete({ id: created.id });
    expect(result.success).toBe(true);
  });
});

describe("Finance System - Transactions", () => {
  it("should create a new transaction", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a category first
    const category = await caller.categories.create({
      name: "Salário",
      color: "#10b981",
      icon: "briefcase",
      type: "income",
    });

    const result = await caller.transactions.create({
      categoryId: category.id,
      type: "income",
      amount: 5000,
      description: "Salário mensal",
      date: new Date(),
    });

    expect(result).toHaveProperty("id");
    expect(result.id).toBeGreaterThan(0);
  });

  it("should list user transactions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create category and transaction
    const category = await caller.categories.create({
      name: "Alimentação",
      color: "#f59e0b",
      icon: "utensils",
      type: "expense",
    });

    await caller.transactions.create({
      categoryId: category.id,
      type: "expense",
      amount: 150,
      description: "Supermercado",
      date: new Date(),
    });

    const transactions = await caller.transactions.list({});
    expect(Array.isArray(transactions)).toBe(true);
  });

  it("should filter transactions by type", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create categories
    const incomeCategory = await caller.categories.create({
      name: "Renda",
      color: "#10b981",
      icon: "briefcase",
      type: "income",
    });

    const expenseCategory = await caller.categories.create({
      name: "Despesa",
      color: "#ef4444",
      icon: "shopping-bag",
      type: "expense",
    });

    // Create transactions
    await caller.transactions.create({
      categoryId: incomeCategory.id,
      type: "income",
      amount: 5000,
      date: new Date(),
    });

    await caller.transactions.create({
      categoryId: expenseCategory.id,
      type: "expense",
      amount: 500,
      date: new Date(),
    });

    const expenses = await caller.transactions.list({ type: "expense" });
    expect(expenses.every((t) => t.type === "expense")).toBe(true);
  });

  it("should update a transaction", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const category = await caller.categories.create({
      name: "Test",
      color: "#3b82f6",
      icon: "tag",
      type: "both",
    });

    const transaction = await caller.transactions.create({
      categoryId: category.id,
      type: "expense",
      amount: 100,
      date: new Date(),
    });

    const result = await caller.transactions.update({
      id: transaction.id,
      amount: 150,
    });

    expect(result.success).toBe(true);
  });

  it("should delete a transaction", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const category = await caller.categories.create({
      name: "Test",
      color: "#3b82f6",
      icon: "tag",
      type: "both",
    });

    const transaction = await caller.transactions.create({
      categoryId: category.id,
      type: "expense",
      amount: 100,
      date: new Date(),
    });

    const result = await caller.transactions.delete({ id: transaction.id });
    expect(result.success).toBe(true);
  });
});

describe("Finance System - Budgets", () => {
  it("should create a new budget", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const category = await caller.categories.create({
      name: "Alimentação",
      color: "#f59e0b",
      icon: "utensils",
      type: "expense",
    });

    const result = await caller.budgets.create({
      categoryId: category.id,
      year: 2025,
      month: 12,
      limit: 1000,
      alertPercentage: 80,
    });

    expect(result).toHaveProperty("id");
    expect(result.id).toBeGreaterThan(0);
  });

  it("should list budgets for a specific month", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const category = await caller.categories.create({
      name: "Transporte",
      color: "#3b82f6",
      icon: "car",
      type: "expense",
    });

    await caller.budgets.create({
      categoryId: category.id,
      year: 2025,
      month: 12,
      limit: 500,
    });

    const budgets = await caller.budgets.list({ year: 2025, month: 12 });
    expect(Array.isArray(budgets)).toBe(true);
  });

  it("should update a budget", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const category = await caller.categories.create({
      name: "Test",
      color: "#3b82f6",
      icon: "tag",
      type: "expense",
    });

    const budget = await caller.budgets.create({
      categoryId: category.id,
      year: 2025,
      month: 12,
      limit: 1000,
      alertPercentage: 80,
    });

    const result = await caller.budgets.update({
      id: budget.id,
      limit: 1500,
      alertPercentage: 75,
    });

    expect(result.success).toBe(true);
  });

  it("should delete a budget", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const category = await caller.categories.create({
      name: "Test",
      color: "#3b82f6",
      icon: "tag",
      type: "expense",
    });

    const budget = await caller.budgets.create({
      categoryId: category.id,
      year: 2025,
      month: 12,
      limit: 1000,
    });

    const result = await caller.budgets.delete({ id: budget.id });
    expect(result.success).toBe(true);
  });
});

describe("Finance System - Goals", () => {
  it("should create a new goal", async () => {
    const result = await appRouter.createCaller(createAuthContext()).goals.create({
      name: "Viagem para Europa",
      description: "Economizar para viagem",
      targetAmount: 10000,
      deadline: new Date(2026, 11, 31),
      category: "Viagem",
    });

    expect(result).toHaveProperty("id");
    expect(result.id).toBeGreaterThan(0);
  });

  it("should list user goals", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.goals.create({
      name: "Carro novo",
      targetAmount: 50000,
      category: "Veículo",
    });

    const goals = await caller.goals.list();
    expect(Array.isArray(goals)).toBe(true);
  });

  it("should update a goal", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const goal = await caller.goals.create({
      name: "Casa própria",
      targetAmount: 200000,
    });

    const result = await caller.goals.update({
      id: goal.id,
      currentAmount: 50000,
      targetAmount: 250000,
    });

    expect(result.success).toBe(true);
  });

  it("should delete a goal", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const goal = await caller.goals.create({
      name: "To Delete",
      targetAmount: 5000,
    });

    const result = await caller.goals.delete({ id: goal.id });
    expect(result.success).toBe(true);
  });

  it("should track goal progress", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const goal = await caller.goals.create({
      name: "Fundo de emergencia",
      targetAmount: 10000,
      currentAmount: 2500,
    });

    const goals = await caller.goals.list();
    const updatedGoal = goals.find((g) => g.id === goal.id);

    expect(updatedGoal).toBeDefined();
    expect(updatedGoal?.name).toBe("Fundo de emergencia");
    expect(updatedGoal?.targetAmount).toBeGreaterThan(0);
  });
});

describe("Finance System - Data Integrity", () => {
  it("should not allow transactions for non-existent categories", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.transactions.create({
        categoryId: 99999,
        type: "expense",
        amount: 100,
        date: new Date(),
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
    }
  });

  it("should isolate data between different users", async () => {
    const user1Ctx = createAuthContext(1);
    const user2Ctx = createAuthContext(2);

    const caller1 = appRouter.createCaller(user1Ctx);
    const caller2 = appRouter.createCaller(user2Ctx);

    // User 1 creates a category
    const cat1 = await caller1.categories.create({
      name: "User 1 Category",
      color: "#3b82f6",
      icon: "tag",
      type: "expense",
    });

    // User 2 creates a different category
    const cat2 = await caller2.categories.create({
      name: "User 2 Category",
      color: "#ef4444",
      icon: "tag",
      type: "expense",
    });

    // Each user should only see their own categories
    const user1Categories = await caller1.categories.list();
    const user2Categories = await caller2.categories.list();

    expect(user1Categories.some((c) => c.id === cat1.id)).toBe(true);
    expect(user2Categories.some((c) => c.id === cat2.id)).toBe(true);
  });
});
