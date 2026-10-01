import { COOKIE_NAME, SESSION_TTL_MS } from "@shared/const";
import { createSessionToken, hashPassword, toPublicUser, verifyPassword } from "./_core/auth";
import type { TrpcContext } from "./_core/context";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { createUser, getUserByEmail, touchLastSignedIn, getDb, getUserCategories, getCategoryById, getUserTransactions, getTransactionById, getUserBudgets, getBudgetById, getUserGoals, getGoalById } from "./db";
import { categories, transactions, budgets, goals } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function startSession(ctx: TrpcContext, userId: number) {
  const token = await createSessionToken(userId);
  ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: SESSION_TTL_MS });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(2, "Nome muito curto").max(100),
        email: z.string().trim().toLowerCase().email("Email inválido"),
        password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(72),
      }))
      .mutation(async ({ ctx, input }) => {
        if (await getUserByEmail(input.email)) {
          throw new TRPCError({ code: "CONFLICT", message: "Email já cadastrado" });
        }
        const id = await createUser({
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(input.password),
        });
        await startSession(ctx, id);
        return { id };
      }),

    login: publicProcedure
      .input(z.object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos" });
        }
        await touchLastSignedIn(user.id);
        await startSession(ctx, user.id);
        return toPublicUser(user);
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Categories
  categories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserCategories(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        color: z.string().regex(/^#[0-9A-F]{6}$/i).default("#3B82F6"),
        icon: z.string().max(50).default("tag"),
        type: z.enum(["income", "expense", "both"]).default("both"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const result = await db.insert(categories).values({
          userId: ctx.user.id,
          ...input,
        });

        return { id: result[0].insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
        icon: z.string().max(50).optional(),
        type: z.enum(["income", "expense", "both"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await getCategoryById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const updateData: Record<string, any> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.color !== undefined) updateData.color = input.color;
        if (input.icon !== undefined) updateData.icon = input.icon;
        if (input.type !== undefined) updateData.type = input.type;

        await db.update(categories).set(updateData).where(eq(categories.id, input.id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await getCategoryById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        await db.delete(categories).where(eq(categories.id, input.id));
        return { success: true };
      }),
  }),

  // Transactions
  transactions: router({
    list: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        categoryId: z.number().optional(),
        type: z.enum(["income", "expense"]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        return getUserTransactions(ctx.user.id, input.startDate, input.endDate, input.categoryId, input.type);
      }),

    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        type: z.enum(["income", "expense"]),
        amount: z.number().positive(),
        description: z.string().max(255).optional(),
        date: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const category = await getCategoryById(ctx.user.id, input.categoryId);
        if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });

        const amountInCents = Math.round(input.amount * 100);
        const result = await db.insert(transactions).values({
          userId: ctx.user.id,
          categoryId: input.categoryId,
          type: input.type,
          amount: amountInCents,
          description: input.description,
          date: input.date,
        });

        return { id: result[0].insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        type: z.enum(["income", "expense"]).optional(),
        amount: z.number().positive().optional(),
        description: z.string().max(255).optional(),
        date: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await getTransactionById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const updateData: Record<string, any> = {};
        if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
        if (input.type !== undefined) updateData.type = input.type;
        if (input.amount !== undefined) updateData.amount = Math.round(input.amount * 100);
        if (input.description !== undefined) updateData.description = input.description;
        if (input.date !== undefined) updateData.date = input.date;

        await db.update(transactions).set(updateData).where(eq(transactions.id, input.id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await getTransactionById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        await db.delete(transactions).where(eq(transactions.id, input.id));
        return { success: true };
      }),
  }),

  // Budgets
  budgets: router({
    list: protectedProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ ctx, input }) => {
        return getUserBudgets(ctx.user.id, input.year, input.month);
      }),

    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        year: z.number(),
        month: z.number().min(1).max(12),
        limit: z.number().positive(),
        alertPercentage: z.number().min(0).max(100).default(80),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const limitInCents = Math.round(input.limit * 100);
        const result = await db.insert(budgets).values({
          userId: ctx.user.id,
          categoryId: input.categoryId,
          year: input.year,
          month: input.month,
          limit: limitInCents,
          alertPercentage: input.alertPercentage,
        });

        return { id: result[0].insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        limit: z.number().positive().optional(),
        alertPercentage: z.number().min(0).max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await getBudgetById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const updateData: Record<string, any> = {};
        if (input.limit !== undefined) updateData.limit = Math.round(input.limit * 100);
        if (input.alertPercentage !== undefined) updateData.alertPercentage = input.alertPercentage;

        await db.update(budgets).set(updateData).where(eq(budgets.id, input.id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await getBudgetById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        await db.delete(budgets).where(eq(budgets.id, input.id));
        return { success: true };
      }),
  }),

  // Goals
  goals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserGoals(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        targetAmount: z.number().positive(),
        deadline: z.date().optional(),
        category: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const targetInCents = Math.round(input.targetAmount * 100);
        const result = await db.insert(goals).values({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          targetAmount: targetInCents,
          category: input.category,
          deadline: input.deadline,
        });

        return { id: result[0].insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        targetAmount: z.number().positive().optional(),
        currentAmount: z.number().min(0).optional(),
        deadline: z.date().optional(),
        category: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await getGoalById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const updateData: Record<string, any> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.targetAmount !== undefined) updateData.targetAmount = Math.round(input.targetAmount * 100);
        if (input.currentAmount !== undefined) updateData.currentAmount = Math.round(input.currentAmount * 100);
        if (input.deadline !== undefined) updateData.deadline = input.deadline;
        if (input.category !== undefined) updateData.category = input.category;

        await db.update(goals).set(updateData).where(eq(goals.id, input.id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const existing = await getGoalById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        await db.delete(goals).where(eq(goals.id, input.id));
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
