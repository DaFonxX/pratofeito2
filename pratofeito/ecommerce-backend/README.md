# PratoFeito – Backend + site
Tudo roda com um comando (precisa só de Node 18+):

    npm install && npm start      # http://localhost:3000  (API em /api, site na raiz)

Ou dê dois cliques em `iniciar.bat` / `iniciar.command` na pasta acima.

- Banco: PGlite (Postgres embutido) em `data/pgdata`, criado e populado sozinho. Com `DATABASE_URL`/`DB_HOST` usa um PostgreSQL externo (rode `database/init.sql` nele).
- `.env` é opcional (veja `.env.example`). Sem `JWT_SECRET`, um segredo forte é gerado em `data/jwt.secret`.
- Contas demo (fora de produção): `fornecedor@demo.com` e `comprador@demo.com`, senha `demo12345`. Desligue com `SEED=0` ou `NODE_ENV=production`.
Respostas: `{ success, data }` ou `{ success:false, error }`.

## Qualidade, saída de informações e portabilidade (v1.1)
- **Testes** (`npm test`, só Node 18+): validação (`test/validate.test.js`), tradução (`test/i18n.test.js`) e ponta a ponta com servidor real e banco temporário (`test/api.test.js`).
- **Saúde**: `GET /api/health` → app, versão, uptime e se o banco responde (503 se não).
- **Registro de acesso**: tabela `access_logs` + `data/access.log`. Não grava corpo, query string nem senhas; UUIDs viram `:id`; IP com último trecho zerado (`LOG_ANON_IP=0` guarda completo); retenção `LOG_RETENTION_DAYS` (padrão 90). `GET /api/logs` e `/api/logs/export.csv` só respondem a localhost ou ao header `X-Admin-Token` igual a `ADMIN_TOKEN`.
- **Portabilidade**: `GET /api/users/me/export` (dados do usuário em JSON), PWA (`manifest.webmanifest`, `sw.js`), `Dockerfile` na raiz (`DATA_DIR=/data` para o volume).
- **Idiomas**: `frontend/js/i18n.js` (pt-BR, en, es). As mensagens de erro vindas da API ainda são em português.
