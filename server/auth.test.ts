import { describe, expect, it } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import { authenticateRequest } from "./_core/auth";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

/** Contexto anônimo que guarda os cookies que a API tenta gravar. */
function anonContext() {
  const cookies: Record<string, string> = {};
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string) => {
        cookies[name] = value;
      },
    } as unknown as TrpcContext["res"],
  };
  return { ctx, cookies };
}

const uniqueEmail = () => `user-${Date.now()}-${Math.random().toString(36).slice(2)}@teste.com`;

describe("auth", () => {
  it("cadastra, cria sessão e o cookie autentica a próxima requisição", async () => {
    const { ctx, cookies } = anonContext();
    const email = uniqueEmail();

    const { id } = await appRouter.createCaller(ctx).auth.register({
      name: "Maria",
      email,
      password: "senha-forte-123",
    });

    expect(cookies[COOKIE_NAME]).toBeTruthy();

    const user = await authenticateRequest({
      headers: { cookie: `${COOKIE_NAME}=${cookies[COOKIE_NAME]}` },
    } as TrpcContext["req"]);
    expect(user?.id).toBe(id);
    expect(user?.email).toBe(email);
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("faz login com a senha certa e recusa a errada", async () => {
    const email = uniqueEmail();
    await appRouter.createCaller(anonContext().ctx).auth.register({
      name: "João",
      email,
      password: "senha-forte-123",
    });

    const ok = await appRouter.createCaller(anonContext().ctx).auth.login({ email, password: "senha-forte-123" });
    expect(ok.twoFactorRequired).toBe(false);
    expect(ok.twoFactorRequired === false && ok.user.email).toBe(email);
    expect(ok.twoFactorRequired === false && ok.user).not.toHaveProperty("passwordHash");

    await expect(
      appRouter.createCaller(anonContext().ctx).auth.login({ email, password: "senha-errada" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("não permite email duplicado (ignorando maiúsculas)", async () => {
    const email = uniqueEmail();
    const caller = appRouter.createCaller(anonContext().ctx);
    await caller.auth.register({ name: "Ana", email, password: "senha-forte-123" });

    await expect(
      caller.auth.register({ name: "Ana 2", email: email.toUpperCase(), password: "senha-forte-123" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejeita senha curta", async () => {
    await expect(
      appRouter.createCaller(anonContext().ctx).auth.register({ name: "Bia", email: uniqueEmail(), password: "123" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("ignora cookie adulterado", async () => {
    const user = await authenticateRequest({
      headers: { cookie: `${COOKIE_NAME}=token.falso.qualquer` },
    } as TrpcContext["req"]);
    expect(user).toBeNull();
  });

  it("bloqueia rotas protegidas sem login", async () => {
    await expect(appRouter.createCaller(anonContext().ctx).transactions.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
