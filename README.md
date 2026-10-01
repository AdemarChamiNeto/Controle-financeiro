# Controle Financeiro

Aplicação web de finanças pessoais. Você registra receitas e despesas por categoria, define orçamentos mensais com alerta de limite, acompanha metas de economia com projeção de prazo e vê tudo em dashboards e relatórios com exportação para CSV.

**Stack:** React 19 · TypeScript · Vite · Tailwind + shadcn/ui · Recharts · Node.js + Express · tRPC · Drizzle ORM · MySQL · Vitest · Docker Compose

## Funcionalidades

- **Autenticação própria:** cadastro e login com email e senha. A senha é guardada com hash bcrypt e a sessão é um JWT (HS256) em cookie `httpOnly` com `SameSite=Lax`.
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
  _core/         Express, contexto do tRPC, autenticação e cookies
  routers.ts     procedures tRPC (auth, categorias, transações, orçamentos, metas)
  db.ts          consultas com Drizzle + migrations na subida
drizzle/         schema e migrations SQL
shared/          constantes e tipos compartilhados entre front e back
```

O tRPC compartilha os tipos do back-end com o front-end. Se uma procedure muda, o TypeScript acusa o erro no cliente em tempo de compilação. A validação de entrada fica no servidor, com Zod.

## Rodando com Docker

```bash
cp .env.example .env      # troque as senhas e gere o JWT_SECRET: openssl rand -hex 32
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

São 27 testes de integração nas procedures tRPC, rodando contra um MySQL real:

- cadastro, login, senha errada, email duplicado e cookie adulterado;
- bloqueio de rotas sem login;
- CRUD de categorias, transações, orçamentos e metas;
- isolamento de dados entre usuários.

O GitHub Actions sobe um MySQL e roda checagem de tipos, migrations, testes e build a cada push (`.github/workflows/ci.yml`).

## Autor

Ademar C. Neto
