# Lance a Lance

Treinador de xadrez pessoal: análise lance a lance das suas partidas, teoria e armadilhas do seu repertório, e treino feito a partir dos seus próprios erros. Versões para Windows (.exe) e Android (.apk), compiladas automaticamente pelo GitHub a cada mudança.

## Instalar

Abra a aba **Releases** deste repositório e pegue a versão mais recente.

**Windows**
- `Lance-a-Lance-Setup-…exe`: instala no computador e cria atalho.
- `Lance-a-Lance-Portatil-…exe`: abre direto, sem instalar.
- O app não tem assinatura digital paga, então o Windows pode mostrar "O Windows protegeu o computador". Clique em **Mais informações → Executar assim mesmo**.

**Android**
- Baixe `Lance-a-Lance-….apk` no celular e toque para abrir.
- Na primeira vez, o Android pede para permitir a instalação de apps desta fonte (o navegador ou o gerenciador de arquivos). Permita e volte para instalar.

## Atualizações automáticas

- **O app** (telas, análises, treino, teoria) se atualiza sozinho nos dois aparelhos. Ao abrir, ele procura uma versão nova, baixa em segundo plano (cerca de 230 KB) e avisa "Nova versão do app pronta". Se você não tocar em "Atualizar agora", ela entra na próxima vez que abrir o app. Se uma atualização falhar ao abrir, o app volta sozinho para a versão anterior.
- **O aplicativo instalado** muda raramente. No Windows, o instalador (Setup) baixa a versão nova sozinho e instala quando você fecha o app. A versão portátil e o Android mostram um aviso com o botão "Baixar", porque o Android não deixa um app instalado fora da Play Store se reinstalar sem a sua confirmação.
- Em **Ajustes → Versão** aparecem a versão em uso e o botão "Procurar atualização".

Como funciona: cada envio ao ramo `main` gera o pacote do app no ramo `updates`. Uma versão nova do instalador e do APK só é criada quando o campo `version` do `package.json` muda.

## Sincronização

- Cada aparelho busca as partidas direto no Chess.com (ou no Lichess), sem limite de tamanho.
- Com o app aberto, ele confere partidas novas a cada 2 minutos e sempre que você volta para ele, e analisa as novas com o Stockfish.
- Análises e progresso do treino ficam salvos em cada aparelho.
- O app já vem com as 2.080 partidas de justdoctor11, 325 análises e o relatório de teoria e armadilhas de 10/11/2026.

## Treinos (versão 1.2)

- **Converter a vitória**: as partidas em que você chegou a 85% ou mais de chance de vencer e não venceu. Você joga de novo a partir dali contra o motor.
- **Defenda a posição**: partidas perdidas a partir do momento em que você ficou um pouco pior (entre −1,2 e −4). O objetivo é igualar, empatar ou aguentar 25 lances.
- **Raio-X da peça**: 60 segundos para marcar as peças soltas de cada posição.
- **Puna o erro**: a posição logo depois de um erro seu, jogando do lado do adversário.
- **Curso de finais**: 9 posições essenciais, conferidas com o Stockfish. Com internet, o adversário usa a tabela de finais do Lichess.
- **Seus finais**: os finais das suas partidas em que você errou.
- **Treino de relógio**: partida contra o motor com relógio de verdade e metas de ritmo. No fim, o app confere seus lances.
- **Adivinhe o lance**: revisão ativa dos momentos decisivos de uma partida, com pontuação.
- **Dossiê do adversário**: resumo das partidas públicas recentes do adversário.
- **Plano semanal**: montado com as suas fraquezas, com lembrete diário (Android).
- **Cartão da partida**: imagem para salvar ou compartilhar.
- **Perfil em radar**: seis áreas comparadas com adversários do seu nível.

## Novidades da versão 1.3 (chega pela atualização automática)

- **Análise com prova**: toda afirmação de ganho de material traz a linha do motor e o saldo de material quando as trocas terminam.
- **Zona decidida**: o trecho em que a partida já estava decidida fica marcado e sai da precisão.
- **Momentos críticos**: o motor compara os 2 melhores lances e marca as posições em que só um lance segurava. Isso gera o modo de exercícios "Lance único".
- **Estatísticas**: recordes, aberturas por linha (com tendência e linhas acompanhadas), trocas e tipos de final, e raio-X do relógio.
- **Adversário humano (Maia3, CSSLab/Universidade de Toronto)**: o modelo (cerca de 58 MB com o ONNX Runtime Web) é baixado na primeira vez, do repositório oficial e do jsDelivr, e conferido por SHA-256 antes de rodar.
- **Novos treinos**: Ache o erro, Padrões de mate, quebra-cabeças às cegas.
- **Conforto**: fila de revisão, confirmação de lance com toque duplo, árvore de aberturas do adversário no dossiê.
- **Visual**: vidro, gradientes e transições entre telas. Nos Ajustes, "Simples" desliga os efeitos em aparelhos mais fracos.

## Compilar localmente (opcional)

- Windows: `npm ci` e `npm run dist:win` (o resultado fica em `release/`).
- Android: `npm ci`, `npm run android:prepare` e depois `cd android && ./gradlew assembleDebug` (precisa do Android Studio/SDK e Java 17).
- Testar no computador sem instalar: `npm start`.

## Componentes de terceiros

- Stockfish (GPLv3), motor de xadrez, via pacote `stockfish` (WebAssembly).
- chess.js (BSD-2-Clause).
- Peças cburnett de Colin M.L. Burnett (GPLv2 ou posterior), via chessground.
- Peças Merida de Armando Hernandez Marroquin (GPLv2 ou posterior), Chessnut de Alexis Luengas (Apache 2.0), Fantasy e Spatial de Maurizio Monge (MIT), Staunty, Maestro e Cardinal de sadsnake1 e California de Jerry S. (CC BY-NC-SA 4.0, uso sem fins comerciais, com crédito), todas copiadas do repositório lichess-org/lila (`vendor/pieces/`).
- Peças Moderno (`scripts/pieces-moderno.mjs`) e Lance: desenhos originais deste app.
- Tabela de finais: API pública do Lichess (tablebase.lichess.ovh), consultada durante o uso.
- Maia3 (modelo e lista de lances) do repositório CSSLab/maia-platform-frontend (GPLv3), baixado sob demanda. O projeto Maia2 é MIT.
- ONNX Runtime Web 1.23.2 (MIT), baixado sob demanda do jsDelivr.
- Fontes Geist e Geist Mono (SIL Open Font License 1.1).
- Nomes de aberturas: base `lichess-org/chess-openings` (CC0).
