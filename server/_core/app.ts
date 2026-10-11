import express from "express";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createLimits } from "./limits";

/** Monta a API sem abrir porta e sem o front: assim os testes sobem o app em memória. */
export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // Cabeçalhos de segurança. A CSP padrão do helmet fica só em produção: em dev o Vite injeta scripts inline (HMR).
  app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false }));
  app.use(express.json({ limit: "1mb" }));
  // rate limit antes do tRPC: login, cadastro, 2FA, escrita e leitura
  app.use("/api/trpc", ...createLimits());
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
