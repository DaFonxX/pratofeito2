# PratoFeito

Comida boa que sobrou hoje em padarias, restaurantes e mercados do bairro, por menos ou de graça.

Os estabelecimentos anunciam o que sobrou no fim do dia, com desconto ou como doação. O cliente reserva pelo site, retira no horário combinado e mostra um código de 4 dígitos no balcão. A loja acompanha tudo num painel com relatórios.

Projeto acadêmico da turma 2ª A Informática.

---

## Como abrir

Só precisa do **Node.js 22.13 ou mais novo** ([nodejs.org](https://nodejs.org)). Não há `npm install`, banco para instalar nem internet necessária: o projeto não tem nenhuma dependência externa.

| Sistema | O que fazer |
|---|---|
| Windows | Dois cliques em `iniciar.bat` |
| macOS | Dois cliques em `iniciar.command` (se o Mac bloquear: botão direito → Abrir) |
| Linux | `./iniciar.sh` |
| Qualquer um | `npm start` e abrir http://localhost:3000 |

O navegador abre sozinho. Para encerrar, use Ctrl+C na janela do terminal.

### Contas de demonstração

Na tela **Entrar** há botões de acesso rápido. Todas usam a senha `Prato#2026`.

| Perfil | E-mail | O que dá para ver |
|---|---|---|
| Cliente | `cliente@demo.com` | Vitrine, sacola, pedidos com código de retirada, "Meu impacto" |
| Estabelecimento | `restaurante@demo.com` | Painel, fila de pedidos, ofertas, importação/exportação CSV, relatórios |
| Administrador | `admin@demo.com` | Relatórios da plataforma, usuários, registro de segurança |

Os dados de demonstração (9 lojas, 44 ofertas e cerca de 4 meses de pedidos) são criados na primeira execução. Para começar do zero: `npm run reset`.

### Abrir no celular

`npm run start:lan` libera o acesso pela rede Wi-Fi; o endereço para o celular aparece no terminal. Por segurança, o `npm start` normal só aceita conexões do próprio computador.

---

## Requisitos do trabalho

### UI/UX
- Identidade própria: o prato esmaltado azul (ágata) do logo e a plaquinha amarela de preço de feira em cada oferta. As cores têm significado fixo: azul para ações, amarelo para preço, verde para grátis/doação e vermelho para "vence hoje".
- Fluxo completo de compra: vitrine → oferta → sacola → finalizar → acompanhamento com linha do tempo e código de retirada.
- Painel da loja com fila de pedidos em colunas (novos, em separação, prontos), atualizado a cada 15 segundos.
- Formulário de oferta com prévia ao vivo de como o cartão aparece para o cliente.
- Estados de carregamento (esqueleto), estados vazios, avisos de sucesso/erro e mensagens de erro específicas.
- Acessibilidade: navegação por teclado, foco visível, "pular para o conteúdo", rótulos em todos os campos, leitores de tela anunciam a troca de página, contraste AA e respeito a "reduzir movimento".

### Tradutor
- Português (Brasil), inglês e espanhol, no seletor do topo ou em Minha conta.
- Traduz 100% da interface, inclusive mensagens de erro do servidor (a API devolve códigos, e o navegador traduz).
- Datas, moedas, números e plurais seguem as regras de cada idioma (API `Intl`).
- O idioma fica salvo no navegador e na conta; na primeira visita, segue o idioma do aparelho.
- Testes automáticos garantem que os três idiomas têm exatamente as mesmas chaves e variáveis.

### Portabilidade
- **Dispositivos:** layout responsivo do celular ao monitor grande, com barra de abas no celular.
- **App instalável (PWA):** manifest, ícones e service worker; abre offline com o que já foi carregado.
- **Sistemas:** roda em Windows, macOS e Linux sem instalar nada além do Node.js; `Dockerfile` incluso.
- **Dados (LGPD, art. 18, V):** "Baixar meus dados" exporta tudo da conta em JSON; lojas exportam e importam ofertas por planilha CSV (Excel, LibreOffice, Google Planilhas).

### Relatórios
- **Loja:** receita, pedidos, comida salva (kg), itens resgatados, doações, ticket médio, cancelamentos e avaliação, cada um comparado com o período anterior; evolução diária, categorias, situação dos pedidos, retirada × entrega, pagamento, mapa de horários de pico e ranking de ofertas.
- **Administrador:** os mesmos indicadores da plataforma inteira, mais novos cadastros, ranking de lojas e números de segurança.
- **Cliente:** "Meu impacto", com economia, refeições salvas, CO₂ evitado e conquistas.
- Períodos de 7, 30, 90 dias, 12 meses ou personalizado; exportação **CSV** e **impressão/PDF** com layout próprio de impressão.

### Modo dark/light
- Botão de sol/lua no topo; em Minha conta há também a opção "Automático", que segue o sistema.
- Aplicado antes da página aparecer (sem "piscar"), salvo no navegador e sincronizado entre abas.
- Paleta escura própria, com cores de gráfico validadas para contraste e daltonismo nos dois modos.

---

## Segurança

| Ameaça | Proteção |
|---|---|
| Senhas vazadas | Hash **scrypt** com sal aleatório; política de senha (mínimo de 8 caracteres e bloqueio de senhas comuns) |
| Força bruta | Conta bloqueada por 15 min após 5 erros; limite de tentativas por IP; resposta igual para e-mail existente ou não |
| Roubo de sessão | Token aleatório de 256 bits em cookie **HttpOnly + SameSite**; no banco fica só o hash; sessão nova a cada login |
| CSRF | Token assinado (HMAC) exigido em toda alteração + verificação de origem |
| XSS | Templates com escape automático + **Content-Security-Policy** sem scripts inline |
| SQL injection | 100% das consultas com parâmetros |
| Acesso indevido | Permissão por papel em cada rota; pedido de outra pessoa responde 404 |
| Fraude de preço/estoque | Preço sempre recalculado no servidor; baixa de estoque em transação; limite diário de itens grátis |
| Entradas maliciosas | Validação de todos os campos, limite de tamanho, remoção de caracteres invisíveis, proteção contra `__proto__` |
| Planilhas maliciosas | Proteção contra *CSV injection* na exportação |
| Arquivos do servidor | Bloqueio de *path traversal* e de arquivos ocultos |
| Outros | Cabeçalhos HSTS, X-Frame-Options, nosniff, Referrer-Policy e Permissions-Policy; tempos-limite contra conexões lentas; registro de auditoria com IP anonimizado |

Todos esses pontos têm teste automático em `tests/security.test.js`.

---

## Testes

```
npm test
```

São 29 testes, sem dependências: segurança, regras de negócio (estoque com pedidos simultâneos, doações, fluxo do pedido, CSV, relatórios) e consistência das traduções.

---

## Estrutura

```
server/           API e servidor HTTP (Node.js puro + SQLite nativo do Node)
  db/             esquema do banco e dados de demonstração
  http/           roteador, cookies, segurança, limites, arquivos estáticos
  lib/            validação, senhas, datas, CSV
  services/       contas, ofertas, pedidos, relatórios, sessões, auditoria
public/           site (HTML, CSS e JavaScript sem etapa de build)
  assets/js/      app de página única: core/, components/, views/, i18n/
tests/            testes automáticos (node:test)
scripts/          gerador dos ícones do app
data/             banco e chave secreta (criados ao rodar; fora do Git)
```

## Configuração

Tudo é opcional. Copie `.env.example` para `.env` para mudar porta, fuso horário, limites etc. Para publicar de verdade (atrás de HTTPS): `NODE_ENV=production`, `DEMO_MODE=0`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` para criar o primeiro administrador e, se houver proxy reverso, `TRUST_PROXY=1`.

Docker:

```
docker build -t pratofeito .
docker run -p 3000:3000 -e DEMO_MODE=1 -v pratofeito-data:/data pratofeito
```
