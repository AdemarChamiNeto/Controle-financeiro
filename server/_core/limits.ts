import type { Request, RequestHandler } from "express";
import { ipKeyGenerator, rateLimit, type Options } from "express-rate-limit";
import { COOKIE_NAME, PENDING_2FA_COOKIE } from "@shared/const";
import { readCookie, tokenUser } from "./auth";

/**
 * Rate limit em todos os endpoints (padrão do projeto), com 429 e Retry-After.
 * No tRPC tudo passa por /api/trpc/<procedure> (ou várias, em lote: "a.b,c.d"); o limite de cada
 * categoria vale se alguma procedure do lote pertence a ela.
 * Contador em memória: o app roda numa instância só. Com mais de uma, usar um `store` compartilhado.
 */
const MIN = 60_000;

const procedures = (req: Request) => decodeURIComponent(req.path.replace(/^\//, "")).split(",");
const hits = (names: string[]) => (req: Request) => procedures(req).some((p) => names.includes(p));

/** Usuário da sessão (ou do login pendente de 2FA), validado; sem sessão, cai no IP. */
async function userOrIp(req: Request): Promise<string> {
  const id = (await tokenUser(readCookie(req, COOKIE_NAME), "session")) ?? (await tokenUser(readCookie(req, PENDING_2FA_COOKIE), "2fa"));
  return id !== null ? `user:${id}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

/** Email do corpo do tRPC (`{ json: {...} }`, ou `{ "0": { json: {...} } }` em lote). */
function emailFromBody(req: Request): string {
  const body = req.body ?? {};
  const inputs = "json" in body ? [body] : Object.values(body);
  for (const i of inputs as { json?: { email?: unknown } }[]) {
    if (typeof i?.json?.email === "string") return i.json.email.trim().toLowerCase();
  }
  return "";
}

const make = (limit: number, windowMs: number, extra: Partial<Options>) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: { message: "Muitas tentativas. Tente de novo em alguns minutos.", code: "TOO_MANY_REQUESTS" } },
    ...extra,
  });

export function createLimits(): RequestHandler[] {
  // login, cadastro e 2FA: ~5 tentativas / 15 min (configurável para os testes)
  const auth = Number(process.env.AUTH_RATE_LIMIT ?? 5);
  const isLogin = hits(["auth.login"]);
  const isTwoFactor = hits(["auth.loginSecondFactor", "auth.twoFactor.setup", "auth.twoFactor.enable", "auth.twoFactor.disable"]);
  return [
    // erros de login por IP e por conta (login certo não conta)
    make(auth, 15 * MIN, { skip: (req) => !isLogin(req), skipSuccessfulRequests: true }),
    make(auth, 15 * MIN, { skip: (req) => !isLogin(req), skipSuccessfulRequests: true, keyGenerator: (req) => `email:${emailFromBody(req)}` }),
    make(auth, 15 * MIN, { skip: (req) => !hits(["auth.register"])(req) }),
    // códigos de 2FA por usuário (inclusive o login pendente): ninguém testa os 10⁶ códigos
    make(auth, 15 * MIN, { skip: (req) => !isTwoFactor(req), skipSuccessfulRequests: true, keyGenerator: userOrIp }),
    // escrita (mutations = POST) 30/min e leitura (queries = GET) 120/min, por usuário ou IP
    make(Number(process.env.WRITE_RATE_LIMIT ?? 30), MIN, { skip: (req) => req.method !== "POST", keyGenerator: userOrIp }),
    make(Number(process.env.READ_RATE_LIMIT ?? 120), MIN, { skip: (req) => req.method !== "GET", keyGenerator: userOrIp }),
  ];
}
