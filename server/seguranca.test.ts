import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recoveryCodes, userTotp, users } from "../drizzle/schema";
import { createApp } from "./_core/app";
import { decodeKey } from "./_core/env";
import { decrypt, encrypt, generateRecoveryCodes, hashRecoveryCode } from "./_core/secrets";
import { base32Encode, codeForStep, otpauthUrl, stepAt, verifyCode } from "./_core/totp";
import { getDb } from "./db";

process.env.TOTP_ENCRYPTION_KEY ??= "ab".repeat(32);

// ---------------------------------------------------------------- unidade

describe("TOTP (RFC 6238)", () => {
  const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

  it("bate com os vetores oficiais da RFC", () => {
    for (const [seconds, expected] of [[59, "94287082"], [1111111109, "07081804"], [1234567890, "89005924"], [2000000000, "69279037"]] as const) {
      expect(codeForStep(RFC_SECRET, stepAt(new Date(seconds * 1000)), 8)).toBe(expected);
    }
  });

  it("aceita 1 passo de diferença no relógio, recusa mais que isso e não aceita código já usado", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    const step = stepAt(now);
    expect(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, step - 2), now)).toBeNull();
    expect(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, step), now, step)).toBeNull();
  });

  it("gera a URL do QR code com o nome do app", () => {
    const url = new URL(otpauthUrl("JBSWY3DPEHPK3PXP", "ana@exemplo.com"));
    expect(url.searchParams.get("issuer")).toBe("Controle Financeiro");
  });
});

describe("segredos", () => {
  it("criptografa o segredo do 2FA e recusa valor adulterado", () => {
    const a = encrypt("JBSWY3DPEHPK3PXP");
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
    expect(encrypt("JBSWY3DPEHPK3PXP")).not.toBe(a);
    expect(decrypt(a)).toBe("JBSWY3DPEHPK3PXP");
    const [v, iv, tag, data] = a.split(":");
    expect(() => decrypt([v, iv, tag, (data[0] === "A" ? "B" : "A") + data.slice(1)].join(":"))).toThrow();
  });

  it("códigos de recuperação: 10 únicos, hash ignora maiúsculas e hífen", () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(hashRecoveryCode(codes[0])).toBe(hashRecoveryCode(codes[0].toUpperCase().replace("-", "")));
  });

  it("chave aceita 32 bytes em hex ou base64 e recusa o resto", () => {
    const bytes = Buffer.alloc(32, 7);
    expect(decodeKey(bytes.toString("hex"))).toEqual(bytes);
    expect(decodeKey(bytes.toString("base64"))).toEqual(bytes);
    expect(decodeKey("curta")).toBeNull();
    expect(decodeKey(Buffer.alloc(16).toString("hex"))).toBeNull();
  });
});

// ---------------------------------------------------------------- integração (HTTP + MySQL)

/** Sobe um app em memória com os limites pedidos (lidos na criação do app). */
function startApp(limits: Record<string, string> = {}) {
  const saved = Object.fromEntries(Object.keys(limits).map((k) => [k, process.env[k]]));
  Object.assign(process.env, { AUTH_RATE_LIMIT: "1000", WRITE_RATE_LIMIT: "1000", READ_RATE_LIMIT: "1000", ...limits });
  const server: Server = createApp().listen(0);
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc` };
}

/** Chama uma procedure do tRPC por HTTP (mutation = POST, query = GET), guardando os cookies. */
async function trpc(base: string, procedure: string, input?: unknown, cookie = "", method: "POST" | "GET" = "POST") {
  const res = await fetch(`${base}/${procedure}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: method === "POST" ? JSON.stringify({ json: input }) : undefined,
  });
  const body = await res.json().catch(() => null);
  const setCookies = res.headers.getSetCookie();
  const cookies = setCookies.map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
  return { status: res.status, data: body?.result?.data?.json, error: body?.error, cookies, setCookies, headers: res.headers };
}

const uniqueEmail = () => `seg-${Date.now()}-${Math.random().toString(36).slice(2)}@teste.com`;

describe("segurança pela API (HTTP)", () => {
  let app: ReturnType<typeof startApp>;
  beforeAll(() => { app = startApp(); });
  afterAll(() => { app.server.close(); });

  it("2FA: ativar, login em dois passos, código não reutilizável, recuperação de uso único e desativar", async () => {
    const email = uniqueEmail();
    const reg = await trpc(app.base, "auth.register", { name: "Bia", email, password: "senha-forte-123" });
    expect(reg.status).toBe(200);
    const cookie = reg.cookies;
    expect((await trpc(app.base, "auth.twoFactor.status", undefined, cookie, "GET")).data).toEqual({ enabled: false });

    const setup = await trpc(app.base, "auth.twoFactor.setup", undefined, cookie);
    const secret: string = setup.data.secret;
    const db = (await getDb())!;
    const [u] = await db.select().from(users).where(eq(users.email, email));
    const [stored] = await db.select().from(userTotp).where(eq(userTotp.userId, u.id));
    expect(stored.secretEncrypted).not.toContain(secret);

    expect((await trpc(app.base, "auth.twoFactor.enable", { code: "000000" }, cookie)).status).toBe(400);
    const step = stepAt(new Date());
    const enable = await trpc(app.base, "auth.twoFactor.enable", { code: codeForStep(secret, step) }, cookie);
    const recovery: string[] = enable.data.recoveryCodes;
    expect(recovery).toHaveLength(10);
    const saved = await db.select().from(recoveryCodes).where(eq(recoveryCodes.userId, u.id));
    expect(saved.map((r) => r.codeHash)).not.toContain(recovery[0]);

    // a senha certa agora só dá o cookie pendente, que não vale como sessão
    const login = await trpc(app.base, "auth.login", { email, password: "senha-forte-123" });
    expect(login.data).toEqual({ twoFactorRequired: true });
    expect((await trpc(app.base, "auth.me", undefined, login.cookies, "GET")).data).toBeNull();

    expect((await trpc(app.base, "auth.loginSecondFactor", { code: "000000" }, login.cookies)).status).toBe(401);
    expect((await trpc(app.base, "auth.loginSecondFactor", { code: codeForStep(secret, step) }, login.cookies)).status).toBe(401); // já usado
    const second = await trpc(app.base, "auth.loginSecondFactor", { code: codeForStep(secret, step + 1) }, login.cookies);
    expect(second.status).toBe(200);
    expect((await trpc(app.base, "auth.me", undefined, second.cookies, "GET")).data.email).toBe(email);

    const login2 = await trpc(app.base, "auth.login", { email, password: "senha-forte-123" });
    const rec = await trpc(app.base, "auth.loginSecondFactor", { code: recovery[0].toUpperCase() }, login2.cookies);
    expect(rec.data.recoveryCodesLeft).toBe(9);
    const login3 = await trpc(app.base, "auth.login", { email, password: "senha-forte-123" });
    expect((await trpc(app.base, "auth.loginSecondFactor", { code: recovery[0] }, login3.cookies)).status).toBe(401);

    expect((await trpc(app.base, "auth.twoFactor.disable", { password: "errada-123", code: recovery[1] }, rec.cookies)).status).toBe(401);
    expect((await trpc(app.base, "auth.twoFactor.disable", { password: "senha-forte-123", code: recovery[2] }, rec.cookies)).status).toBe(200);
    expect((await trpc(app.base, "auth.login", { email, password: "senha-forte-123" })).data.twoFactorRequired).toBe(false);
  });

  it("senha antiga com bcrypt custo 10 é refeita com custo 12 no login", async () => {
    const email = uniqueEmail();
    const db = (await getDb())!;
    await db.insert(users).values({ name: "Antigo", email, passwordHash: bcrypt.hashSync("senha-forte-123", 10) });
    expect((await trpc(app.base, "auth.login", { email, password: "senha-forte-123" })).status).toBe(200);
    const [u] = await db.select().from(users).where(eq(users.email, email));
    expect(bcrypt.getRounds(u.passwordHash)).toBe(12);
  });

  it("cookie da sessão é httpOnly e SameSite=Lax, e as respostas têm cabeçalhos de segurança", async () => {
    const reg = await trpc(app.base, "auth.register", { name: "Cid", email: uniqueEmail(), password: "senha-forte-123" });
    expect(reg.setCookies.join()).toMatch(/session=.*HttpOnly/i);
    expect(reg.setCookies.join()).toMatch(/SameSite=Lax/i);
    expect(reg.headers.get("x-content-type-options")).toBe("nosniff");
    expect(reg.headers.get("x-powered-by")).toBeNull();
  });

  it("limita erros de login (429 com Retry-After)", async () => {
    const limited = startApp({ AUTH_RATE_LIMIT: "3" });
    const statuses = [];
    let last;
    for (let i = 0; i < 4; i++) {
      last = await trpc(limited.base, "auth.login", { email: "x@x.com", password: "errada-123" });
      statuses.push(last.status);
    }
    limited.server.close();
    expect(statuses).toEqual([401, 401, 401, 429]);
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("limita escrita por usuário (30/min no padrão)", async () => {
    const limited = startApp({ WRITE_RATE_LIMIT: "2" });
    const reg = await trpc(limited.base, "auth.register", { name: "Davi", email: uniqueEmail(), password: "senha-forte-123" });
    const cat = { name: "Teste", type: "expense" };
    const a = await trpc(limited.base, "categories.create", cat, reg.cookies);
    const b = await trpc(limited.base, "categories.create", cat, reg.cookies);
    const c = await trpc(limited.base, "categories.create", cat, reg.cookies);
    limited.server.close();
    expect([a.status, b.status, c.status]).toEqual([200, 200, 429]);
  });
});
