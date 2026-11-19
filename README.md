# Peão Passado

Treinador de xadrez pessoal: análise lance a lance das suas partidas, teoria e armadilhas do seu repertório, e treino feito a partir dos seus próprios erros. Versões para Windows (.exe) e Android (.apk), compiladas automaticamente pelo GitHub a cada mudança.

## Instalar

Abra a aba **Releases** deste repositório e pegue a versão mais recente.

**Windows**
- `Peao-Passado-Setup-…exe`: instala no computador e cria atalho.
- `Peao-Passado-Portatil-…exe`: abre direto, sem instalar.
- O app não tem assinatura digital paga, então o Windows pode mostrar "O Windows protegeu o computador". Clique em **Mais informações → Executar assim mesmo**.

**Android**
- Baixe `Peao-Passado-….apk` no celular e toque para abrir.
- Na primeira vez, o Android pede para permitir a instalação de apps desta fonte (o navegador ou o gerenciador de arquivos). Permita e volte para instalar.

## Atualizações automáticas

- **O app** (telas, análises, treino, teoria) se atualiza sozinho nos dois aparelhos. Ao abrir, ele procura uma versão nova, baixa em segundo plano (cerca de 230 KB) e avisa "Nova versão do app pronta". Se você não tocar em "Atualizar agora", ela entra na próxima vez que abrir o app. Se uma atualização falhar ao abrir, o app volta sozinho para a versão anterior.
- **O aplicativo instalado** muda raramente. No Windows, o instalador (Setup) baixa a versão nova sozinho e instala quando você fecha o app. A versão portátil e o Android mostram um aviso com o botão "Baixar", porque o Android não deixa um app instalado fora da Play Store se reinstalar sem a sua confirmação.
- Em **Ajustes → Versão** aparecem a versão em uso e o botão "Procurar atualização".

Como funciona: cada envio ao ramo `main` gera o pacote do app no ramo `updates`. Uma versão nova do instalador e do APK só é criada quando o campo `version` do `package.json` muda.

## Sincronização

- Cada aparelho busca as partidas direto no Chess.com (ou no Lichess), sem limite de tamanho.
- Com o app aberto, ele confere partidas novas a cada 2 minutos e sempre que você volta para ele, e analisa as novas com o Stockfish.
- Análises e progresso do treino ficam salvos em cada aparelho. Para levar tudo de um aparelho para o outro, use **Ajustes → Sincronizar entre aparelhos** (veja a versão 1.4 abaixo).
- O app já vem com as 2.080 partidas de justdoctor11, 325 análises e o relatório de teoria e armadilhas de 10/11/2026.

## Treinos (versão 1.2)

- **Converter a vitória**: as partidas em que você chegou a 85% ou mais de chance de vencer e não venceu. Você joga de novo a partir dali contra o motor.
- **Defenda a posição**: partidas perdidas a partir do momento em que você ficou um pouco pior (entre −1,2 e −4). O objetivo é igualar, empatar ou aguentar 25 lances.
- **Raio-X da peça**: 60 segundos para marcar as peças soltas de cada posição.
- **Puna o erro**: a posição logo depois de um erro seu, jogando do lado do adversário.
- **Curso de finais**: posições essenciais, conferidas com o Stockfish (16 desde a versão 1.4). Com internet, o adversário usa a tabela de finais do Lichess.
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

## Novidades da versão 1.5

Chegam pela atualização automática, sem reinstalar.

- **Corrida**: 3 minutos e 3 vidas com os seus próprios erros, do mais fácil ao mais difícil. A cada 5 acertos seguidos você ganha 10 segundos. O relógio pausa quando você sai da aba.
- **Lances candidatos**: em posições difíceis das suas partidas, você lista de 2 a 3 lances no tabuleiro, escolhe um e o motor revela as melhores linhas. Treina o hábito de comparar opções antes de jogar.
- **Você primeiro**: antes de abrir o motor, você percorre a partida, marca onde acha que errou e escreve o que aprendeu. O app compara com o motor e dá uma nota à sua autocrítica.
- **Conquistas**: 22 insígnias originais, cada uma com bronze, prata e ouro, ligadas ao treino, às suas partidas e ao hábito. Há uma comemoração a cada insígnia nova, o progresso aparece no Painel e as conquistas vão junto na sincronização entre aparelhos.

## Novidades da versão 1.4

Chegam pela atualização automática, menos o widget, que precisa do aplicativo 1.3.0 (novo instalador e novo APK).

- **Repertório com repetição espaçada**: o app monta o repertório com as suas 500 partidas mais recentes. Entram as posições dos 10 primeiros lances em que você esteve pelo menos 3 vezes, com o lance que você costuma jogar. Acertou, a posição volta em 1, 3, 7, 15, 30 e 60 dias; errou, volta na mesma rodada. São 8 posições novas por dia. Quando a análise mostra que o seu lance habitual perde pontos, o treino pede o lance do motor e explica por quê.
- **Finais**: 7 lições novas (rei na 6ª, oposição para defender, ruptura de peões, bispos de cores opostas, defesa Vančura, mate com dois bispos, mate com bispo e cavalo). Com a tabela do Lichess, cada lance seu é conferido: perfeito, mais lento ou erro. O app guarda a sua melhor marca.
- **Onde você perde pontos** (aba Números): fase a fase, a sua precisão e a chance de vitória entregue por partida, contra os seus adversários nas mesmas partidas. A diferença é convertida em pontos de rating, com margem de 95%, e dá para separar adversários mais fracos, parecidos e mais fortes.
- **Deslizar entre as abas** no celular (pode desligar nos Ajustes).
- **Sincronizar entre aparelhos**: treinos, repertório, análises e partidas vão para um Gist secreto da sua conta do GitHub. Crie um token *fine-grained* só com a permissão **Gists: Read and write** e cole o mesmo token no PC e no celular. O token fica só no aparelho.
- **Lembrete do dia** (Android): diz quantos exercícios faltam, a sua sequência e quantas posições do repertório há para treinar. Não toca no dia em que a meta já foi cumprida.
- **Widget** (Android, aplicativo 1.3.0): sequência de dias, meta de hoje, revisões do repertório e a última partida. Para pôr na tela inicial, toque e segure na tela inicial → Widgets → Peão Passado.

## Desempenho (atualização 10)

O trabalho pesado de xadrez (reproduzir cada partida, contar lances legais, conferir sacrifícios e as linhas do motor para o treino, o repertório e os tipos de mate) roda num processador em segundo plano (Web Worker), fora da tela, e o resultado fica guardado no aparelho. Na tela só se montam os dados prontos, em pedaços curtos.

Medido num celular intermediário simulado (CPU 4× mais lenta), navegando pelas abas por 1 minuto:

| | antes | primeira abertura depois da atualização | aberturas seguintes |
|---|---|---|---|
| maior travada | 12,5 s | 0,19 s | 0,11 s |
| tempo total travado | 43,6 s | 0,9 s | 0,17 s |

Os resultados (classificação dos lances, treino, repertório, mates) foram conferidos partida a partida contra o cálculo antigo: idênticos nas 325 partidas analisadas.

## Compilar localmente (opcional)

- Windows: `npm ci` e `npm run dist:win` (o resultado fica em `release/`).
- Android: `npm ci`, `npm run android:prepare` e depois `cd android && ./gradlew assembleDebug` (precisa do Android Studio/SDK e Java 17).
- Testar no computador sem instalar: `npm start`.

## Componentes de terceiros

- Stockfish (GPLv3), motor de xadrez, via pacote `stockfish` (WebAssembly).
- chess.js (BSD-2-Clause).
- Peças cburnett de Colin M.L. Burnett (GPLv2 ou posterior), via chessground.
- Peças Merida de Armando Hernandez Marroquin (GPLv2 ou posterior), Chessnut de Alexis Luengas (Apache 2.0), Fantasy e Spatial de Maurizio Monge (MIT), Staunty, Maestro e Cardinal de sadsnake1, California de Jerry S. e Caliente de avi (CC BY-NC-SA 4.0, uso sem fins comerciais, com crédito), todas copiadas do repositório lichess-org/lila (`vendor/pieces/`).
- Peças Moderno (`scripts/pieces-moderno.mjs`) e Lance: desenhos originais deste app.
- Tabela de finais: API pública do Lichess (tablebase.lichess.ovh), consultada durante o uso.
- Maia3 (modelo e lista de lances) do repositório CSSLab/maia-platform-frontend (GPLv3), baixado sob demanda. O projeto Maia2 é MIT.
- ONNX Runtime Web 1.23.2 (MIT), baixado sob demanda do jsDelivr.
- Fontes Geist e Geist Mono (SIL Open Font License 1.1).
- Nomes de aberturas: base `lichess-org/chess-openings` (CC0).
