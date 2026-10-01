import bcrypt from "bcryptjs";
import { parse as parseCookie } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME, SESSION_TTL_MS } from "@shared/const";
import type { PublicUser, User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { ENV } from "./env";

function secretKey() {
  if (ENV.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET ausente ou curto (mínimo 32 caracteres). Veja o .env.example.");
  }
  return new TextEncoder().encode(ENV.jwtSecret);
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}

export async function createSessionToken(userId: number) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_TTL_MS) / 1000))
    .sign(secretKey());
}

/** Lê o cookie de sessão, valida o JWT e devolve o usuário (ou null). */
export async function authenticateRequest(req: Request): Promise<PublicUser | null> {
  const token = parseCookie(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const user = await getUserById(Number(payload.sub));
    return user ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}
