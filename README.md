# Lance a Lance

Treinador de xadrez pessoal: análise lance a lance das suas partidas, teoria e armadilhas do seu repertório, e treino feito a partir dos seus próprios erros. Versões para Windows (.exe) e Android (.apk), compiladas automaticamente pelo GitHub a cada mudança.

> **Mantenha este repositório privado.** A pasta `data/` traz as suas partidas e análises.

## Instalar

Abra a aba **Releases** deste repositório e pegue a versão mais recente.

**Windows**
- `Lance-a-Lance-Setup-…exe`: instala no computador e cria atalho.
- `Lance-a-Lance-Portatil-…exe`: abre direto, sem instalar.
- O app não tem assinatura digital paga, então o Windows pode mostrar "O Windows protegeu o computador". Clique em **Mais informações → Executar assim mesmo**.

**Android**
- Baixe `Lance-a-Lance-….apk` no celular e toque para abrir.
- Na primeira vez, o Android pede para permitir a instalação de apps desta fonte (o navegador ou o gerenciador de arquivos). Permita e volte para instalar.

## Sincronização

- Cada aparelho busca as partidas direto no Chess.com (ou no Lichess), sem limite de tamanho.
- Com o app aberto, ele confere partidas novas a cada 2 minutos e sempre que você volta para ele, e analisa as novas com o Stockfish.
- Análises e progresso do treino ficam salvos em cada aparelho.
- O app já vem com as 2.080 partidas de justdoctor11, 325 análises e o relatório de teoria e armadilhas de 10/11/2026.

## Compilar localmente (opcional)

- Windows: `npm ci` e `npm run dist:win` (o resultado fica em `release/`).
- Android: `npm ci`, `npm run android:prepare` e depois `cd android && ./gradlew assembleDebug` (precisa do Android Studio/SDK e Java 17).
- Testar no computador sem instalar: `npm start`.

## Componentes de terceiros

- Stockfish (GPLv3), motor de xadrez, via pacote `stockfish` (WebAssembly).
- chess.js (BSD-2-Clause).
- Peças cburnett de Colin M.L. Burnett (GPLv2 ou posterior), via chessground.
- Fontes Geist e Geist Mono (SIL Open Font License 1.1).
- Nomes de aberturas: base `lichess-org/chess-openings` (CC0).
