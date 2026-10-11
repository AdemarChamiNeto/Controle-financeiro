import { z } from "zod";

/** Chave de 32 bytes (AES-256) em hex (openssl rand -hex 32) ou base64. */
export function decodeKey(s: string): Buffer | null {
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, "hex");
  if (!/^[A-Za-z0-9+/_-]{43}=?$/.test(s)) return null;
  const b = Buffer.from(s, "base64");
  return b.length === 32 ? b : null;
}

/** Variáveis obrigatórias: o servidor não sobe se faltar alguma (`index.ts` chama `assertEnv()` antes de tudo). */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "defina DATABASE_URL"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET ausente ou curto (mínimo 32 caracteres; gere com: openssl rand -hex 32)"),
  TOTP_ENCRYPTION_KEY: z
    .string()
    .min(1, "defina TOTP_ENCRYPTION_KEY (gere com: openssl rand -hex 32)")
    .refine((s) => decodeKey(s) !== null, "TOTP_ENCRYPTION_KEY deve ter 32 bytes: 64 caracteres hex ou base64"),
});

export function assertEnv() {
  const r = schema.safeParse({ ...process.env, TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY ?? "" });
  if (!r.success) {
    throw new Error("Configuração inválida: " + r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
}

export const ENV = {
  get jwtSecret() { return process.env.JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  /** Chave do AES-256-GCM do segredo do 2FA; erro claro se faltar ou for inválida. */
  get totpKey(): Buffer {
    const key = decodeKey(process.env.TOTP_ENCRYPTION_KEY ?? "");
    if (!key) throw new Error("TOTP_ENCRYPTION_KEY ausente ou inválida (32 bytes em hex ou base64)");
    return key;
  },
};
