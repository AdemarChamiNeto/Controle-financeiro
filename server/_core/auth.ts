import bcrypt from "bcryptjs";
import { parse as parseCookie } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME, PENDING_2FA_COOKIE, PENDING_2FA_TTL_MS, SESSION_TTL_MS } from "@shared/const";
import type { PublicUser, User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { ENV } from "./env";

function secretKey() {
  if (ENV.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET ausente ou curto (mínimo 32 caracteres). Veja o .env.example.");
  }
  return new TextEncoder().encode(ENV.jwtSecret);
}

/** Custo do bcrypt (padrão do projeto: ≥ 12). Hashes antigos com custo menor são refeitos no login. */
export const BCRYPT_COST = 12;
export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
export const needsRehash = (hash: string) => bcrypt.getRounds(hash) < BCRYPT_COST;
// usado quando o email não existe, para o tempo de resposta não revelar quais emails têm conta
export const DUMMY_HASH = bcrypt.hashSync("senha-que-ninguem-usa", BCRYPT_COST);

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}

/**
 * "session" = sessão normal; "2fa" = senha certa, falta o código. O cookie pendente vale 5 min e
 * só serve para `auth.loginSecondFactor`: nunca autentica as outras rotas.
 */
type Purpose = "session" | "2fa";

async function sign(userId: number, purpose: Purpose, ttlMs: number) {
  return new SignJWT({ purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + ttlMs) / 1000))
    .sign(secretKey());
}

export const createSessionToken = (userId: number) => sign(userId, "session", SESSION_TTL_MS);
export const createPending2faToken = (userId: number) => sign(userId, "2fa", PENDING_2FA_TTL_MS);

/** Id do usuário dono de um token com o propósito pedido (ou null). */
export async function tokenUser(token: string | undefined, purpose: Purpose): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.purpose === purpose ? Number(payload.sub) : null;
  } catch {
    return null;
  }
}

export const readCookie = (req: Request, name: string) => parseCookie(req.headers.cookie ?? "")[name];

/** Lê o cookie de sessão, valida o JWT e devolve o usuário (ou null). */
export async function authenticateRequest(req: Request): Promise<PublicUser | null> {
  const id = await tokenUser(readCookie(req, COOKIE_NAME), "session");
  if (id === null) return null;
  const user = await getUserById(id);
  return user ? toPublicUser(user) : null;
}

export const pending2faUser = (req: Request) => tokenUser(readCookie(req, PENDING_2FA_COOKIE), "2fa");
