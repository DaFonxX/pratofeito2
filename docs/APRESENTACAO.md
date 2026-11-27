# Roteiro de apresentação (cerca de 10 minutos)

Antes de começar: abra o `iniciar.bat` e deixe o site aberto em http://localhost:3000. Se quiser os números "de hoje" zerados, rode `npm run reset` antes.

## 1. A ideia (1 min)
- Página inicial: a vitrine "Na vitrine agora" mostra ofertas reais do banco.
- "Acaba hoje" e "De graça" separam o que é urgente do que é doação.
- O recibo "O que já deixou de ir para o lixo" soma o impacto de todos os pedidos.

## 2. UI/UX: comprar como cliente (2 min)
1. **Explorar**: filtre por categoria, "Grátis", "Até R$ 10" e "Vence hoje"; busque "pao" (acha "pão").
2. Abra uma oferta: plaquinha de preço, economia, validade, horário e quantidade restante.
3. **Entrar** → botão "Cliente". Adicione à sacola → **Continuar**.
4. Na finalização, troque entre retirada e entrega (a taxa entra no total) → **Confirmar pedido**.
5. Mostre o código de retirada e a linha do tempo do pedido.

## 3. Relatórios: o lado da loja (2 min)
1. Saia e entre como "Estabelecimento".
2. **Pedidos**: o pedido que você acabou de fazer está em "Novos". Confirme, marque como pronto e conclua digitando o código do cliente (um código errado é recusado).
3. **Relatórios**: troque o período (7 dias, 30 dias, 12 meses), troque o indicador do gráfico, abra "Ver como tabela", **Exportar CSV** (abre no Excel) e **Imprimir ou salvar PDF**.
4. **Ofertas → Nova oferta**: a prévia muda enquanto você digita.

## 4. Tradutor (1 min)
- No topo, clique no globo e troque para English e Español: menus, mensagens, datas e moeda mudam juntos.

## 5. Modo dark/light (30 s)
- Botão de sol/lua no topo. Em Minha conta há também a opção "Automático", que segue o sistema.

## 6. Portabilidade (1 min)
- Diminua a janela ou abra no celular com `npm run start:lan`: o layout se adapta e aparece a barra de abas.
- No Chrome ou Edge: ícone de instalar na barra de endereço → o PratoFeito vira um aplicativo.
- Minha conta → **Baixar meus dados**: tudo da conta num JSON (direito de portabilidade da LGPD).
- Ofertas → **Exportar/Importar planilha**.
- Roda em Windows, Mac e Linux sem instalar nada além do Node; há também um Dockerfile.

## 7. Segurança (1–2 min)
- Entre como "Administrador" → **Segurança**: cada login, erro de senha e bloqueio fica registrado, com IP anonimizado.
- Demonstração: tente entrar 5 vezes com a senha errada na conta do restaurante e mostre o bloqueio.
- Rode `npm test` e mostre os 29 testes passando (CSRF, SQL injection, força bruta, permissões, estoque).
