# Controle Financeiro

Aplicação web de finanças pessoais. Você registra receitas e despesas por categoria, define orçamentos mensais com alerta de limite, acompanha metas de economia com projeção de prazo e vê tudo em dashboards e relatórios com exportação para CSV.

**Stack:** React 19 · TypeScript · Vite · Tailwind + shadcn/ui · Recharts · Node.js + Express · tRPC · Drizzle ORM · MySQL · Vitest · Docker Compose

## Funcionalidades

- **Autenticação própria:** cadastro e login com email e senha. A senha é guardada com bcrypt custo 12 (hashes antigos são refeitos no próximo login) e a sessão é um JWT (HS256) em cookie `httpOnly` com `SameSite=Lax`.
- **Verificação em duas etapas (opcional):** o usuário ativa em Configurações, lendo um QR code no app autenticador, e recebe 10 códigos de recuperação. Depois disso o login pede o código de 6 dígitos.
- **Segurança:**
  - rate limit em **todas** as procedures (login por IP e por conta, cadastro, 2FA, escrita e leitura), com 429 e `Retry-After`;
  - cabeçalhos do `helmet`, com CSP em produção;
  - o servidor não sobe se faltar variável de ambiente obrigatória.
- **Transações:** CRUD de receitas e despesas, com filtro por período, categoria e tipo.
- **Categorias:** personalizáveis, com cor e ícone.
- **Orçamentos:** limite mensal por categoria e alerta ao atingir uma porcentagem configurável.
- **Metas:** valor alvo, progresso e calculadora de quanto tempo falta com um aporte mensal.
- **Relatórios:** gráficos de pizza, barras e linha, mais exportação em CSV.
- **Isolamento por usuário:** toda consulta filtra pelo `userId` da sessão, e um usuário não acessa os dados de outro.

## Arquitetura

```
client/          React (SPA) — páginas, componentes shadcn/ui, cliente tRPC
server/
  _core/         Express (app.ts), contexto do tRPC, autenticação, cookies,
                 env.ts (variáveis validadas), limits.ts (rate limit),
                 totp.ts (RFC 6238, sem dependência) e secrets.ts (AES-256-GCM)
  routers.ts     procedures tRPC (auth + 2FA, categorias, transações, orçamentos, metas)
  db.ts          consultas com Drizzle + migrations na subida
drizzle/         schema e migrations SQL
shared/          constantes e tipos compartilhados entre front e back
```

O tRPC compartilha os tipos do back-end com o front-end. Se uma procedure muda, o TypeScript acusa o erro no cliente em tempo de compilação. A validação de entrada fica no servidor, com Zod.

### Decisões

- **2FA opcional.** Obrigatório, ele impediria quem visita o projeto de testar sem um app autenticador.
  - O segredo é criptografado com AES-256-GCM (`TOTP_ENCRYPTION_KEY`).
  - Um código já usado não vale de novo: o banco guarda o último passo de 30 s.
  - Desativar pede a senha e um código.
  - Os códigos de recuperação são guardados com SHA-256: são aleatórios e longos, então não precisam do custo do bcrypt.
- **Rate limit no tRPC.** Tudo passa por `/api/trpc/<procedure>`, inclusive lotes (`a,b`). O limitador lê os nomes no caminho e aplica o limite de cada categoria. Mutations (POST) contam como escrita e queries (GET) como leitura. O contador fica em memória porque o app roda numa instância só.
- **Tabelas novas no padrão, antigas como estão.**
  - `user_totp` e `recovery_codes` usam `snake_case`, UUID, `ON DELETE CASCADE` e `updated_at` mantido pelo banco.
  - As tabelas originais não foram migradas, porque seria uma refatoração destrutiva.

## Rodando com Docker

```bash
cp .env.example .env      # troque as senhas e gere JWT_SECRET e TOTP_ENCRYPTION_KEY (openssl rand -hex 32, um para cada)
docker compose up -d --build
```

Acesse http://localhost:3000 e crie sua conta. As migrations rodam sozinhas quando o servidor sobe.

## Rodando em desenvolvimento

Requisitos: Node 20.19+ e pnpm (`corepack enable`).

```bash
cp .env.example .env
docker compose up -d mysql      # MySQL na porta 3307
pnpm install
pnpm dev                        # http://localhost:3000 (API + Vite com hot reload)
```

| Script | O que faz |
|---|---|
| `pnpm dev` | servidor em modo desenvolvimento |
| `pnpm check` | checagem de tipos (TypeScript) |
| `pnpm test` | testes (Vitest) contra o banco do `DATABASE_URL` |
| `pnpm build` / `pnpm start` | build de produção e execução |
| `pnpm db:generate` | gera migration a partir do `drizzle/schema.ts` |
| `pnpm db:migrate` | aplica as migrations |

## Testes

São 38 testes, a maioria de integração contra um MySQL real:

- cadastro, login, senha errada, email duplicado e cookie adulterado;
- bloqueio de rotas sem login;
- CRUD de categorias, transações, orçamentos e metas;
- isolamento de dados entre usuários;
- **segurança, pela API HTTP de verdade:**
  - o fluxo inteiro do 2FA (ativar, login em dois passos, código reutilizado recusado, código de recuperação de uso único, desativar);
  - rehash de senha antiga;
  - cookie `HttpOnly`/`SameSite` e cabeçalhos de segurança;
  - rate limit de login e de escrita, com `Retry-After`;
- unidade: TOTP com os vetores oficiais da RFC 6238, criptografia do segredo e formato da chave.

O GitHub Actions sobe um MySQL e roda checagem de tipos, migrations, testes e build a cada push (`.github/workflows/ci.yml`).

## Autor

Ademar C. Neto
