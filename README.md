# Mec Notes

Um aplicativo moderno, rápido e leve de **Bloco de Notas Flutuante para Windows e Linux (Ubuntu)**, construído com **Tauri v2**, **Rust**, **React**, **TypeScript**, **Tailwind CSS** e **SQLite**.

Projetado para captura rápida de notas, suporte a Markdown, atalhos globais personalizáveis e integração nativa com o sistema operacional (System Tray e fixação na tela).

<p align="center">
  <img src="./docs/app-screenshot.png" alt="Mec Notes Screenshot" width="100%" />
</p>

---

## ✨ Funcionalidades Principais

- 🪟 **Modo Flutuante e Modo Janela:**
  - **Flutuante:** Janela compacta, sem bordas/decorações, fixada no canto inferior direito (*Always on Top*).
  - **Janela Padrão:** Janela expandida centralizada com decorações nativas.
- 📌 **Notas Adesivas Destacáveis (Sticky Notes):**
  - Destaque qualquer nota em uma janela independente e compacta (*Always on Top*), estilo post-it.
  - Edição fluida com alternância para Markdown Preview, criação rápida de novas notas e cópia instantânea.
  - Persistência nativa de posição `(x, y)` e dimensões `(largura, altura)` no SQLite com restauração automática de sessão ao reiniciar o aplicativo.
- 🔄 **Sincronização Bidirecional em Tempo Real:**
  - Atualização instantânea de conteúdo e metadados entre a janela principal e as notas adesivas via barramento de eventos do Tauri, sem conflitos ou travamentos.
- ⌨️ **Atalho Global de Sistema (Global Hotkey):**
  - Exiba ou oculte a aplicação instantaneamente de qualquer lugar (padrão: `Ctrl+Shift+Space`).
  - Atalho reconfigurável com persistência no banco.
- 📥 **Bandeja do Sistema (System Tray):**
  - Ícone na barra de tarefas/bandeja com menu de contexto (*Abrir Notas*, *Ocultar*, *Sair*) e toggle no clique simples.
- 💾 **Persistência SQLite em `~/Documents`:**
  - Banco de dados SQLite local salvo automaticamente em `~/Documents/MecNotes/notas.db` (Linux) ou `C:\Users\<SeuUsuario>\Documents\MecNotes\notas.db` (Windows).
- 📝 **Editor Markdown com Auto-Save:**
  - Suporte completo a Markdown (títulos, listas, checkboxes, citações, formatação inline).
  - Salvamento automático com debounce em tempo real.
  - Fixação de notas no topo (*Pin*), menu de contexto e pesquisa por título/conteúdo.
- 🔄 **Backup e Restauração:**
  - Exportação e importação do banco de dados completo (`.db`) com diálogo nativo de arquivos.

---

## 🛠️ Tecnologias Utilizadas

- **Backend Desktop:** [Tauri v2](https://v2.tauri.app/) + [Rust](https://www.rust-lang.org/)
- **Banco de Dados:** [rusqlite](https://crates.io/crates/rusqlite) (SQLite Embutido)
- **Frontend:** [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Estilização & UI:** [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)

---

## 📋 Pré-requisitos

### Windows
1. **[Node.js](https://nodejs.org/)** (v18 ou superior) + npm
2. **[Rust & Cargo](https://www.rust-lang.org/tools/install)**
3. **C++ Build Tools:** Instale as ferramentas de compilação C++ via *Visual Studio Installer*.

### Ubuntu / Debian (Linux)
1. **Node.js** (v18 ou superior) + npm
2. **Rust & Cargo:**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. **Dependências de Sistema do Tauri v2:**
   ```bash
   sudo apt update
   sudo apt install -y \
     libwebkit2gtk-4.1-dev \
     build-essential \
     curl \
     wget \
     file \
     libssl-dev \
     libayatana-appindicator3-dev \
     librsvg2-dev \
     libgtk-3-dev \
     libsoup-3.0-dev \
     libjavascriptcoregtk-4.1-dev
   ```

---

## 🚀 Como Executar o Projeto

### 1. Instalar Dependências

No diretório raiz do projeto:

```bash
npm install
```

### 2. Rodar em Modo de Desenvolvimento (Desktop Completo)

Inicia o servidor Vite e abre a janela do aplicativo Tauri com *Hot Reload*:

```bash
npm run tauri dev
```

### 3. Rodar Apenas o Frontend no Navegador (Opcional)

Para testes visuais rápidos no navegador (recursos nativos do Rust/SQLite ficam mockados/desabilitados):

```bash
npm run dev
```
Acesse: `http://localhost:1420`

---

## 🧪 Testes

### Executar Testes Unitários do Backend (Rust/SQLite):

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 📦 Build e Distribuição

### Compilação para Linux (Ubuntu/Debian)

Execute em uma máquina Linux (ou via WSL2 / Docker):

- **Gerar `.deb` e `.AppImage` (x86_64):**
  ```bash
  npm run build:linux
  ```
  *Artefatos gerados:*
  - Pacote Debian: `src-tauri/target/release/bundle/deb/mec-notes_0.0.2_amd64.deb`
  - Pacote Universal: `src-tauri/target/release/bundle/appimage/mec-notes_0.0.2_amd64.AppImage`

- **Instalar o pacote `.deb` no Ubuntu:**
  ```bash
  sudo dpkg -i src-tauri/target/release/bundle/deb/mec-notes_0.0.2_amd64.deb
  sudo apt-get install -f # se houver dependências faltantes
  ```

- **Executar o `.AppImage`:**
  ```bash
  chmod +x src-tauri/target/release/bundle/appimage/mec-notes_0.0.2_amd64.AppImage
  ./src-tauri/target/release/bundle/appimage/mec-notes_0.0.2_amd64.AppImage
  ```

---

### Compilação para Windows

Você pode compilar os instaladores para as arquiteturas **64-bit (x64)** e **32-bit (x86)**:

1. **Preparar suporte para 32-bit (apenas na primeira vez):**
   ```bash
   rustup target add i686-pc-windows-msvc
   ```

2. **Gerar Instaladores:**
   - **Build 64-bit (x64):**
     ```bash
     npm run build:x64
     ```
     *Artefato NSIS:* `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`

   - **Build 32-bit (x86):**
     ```bash
     npm run build:x86
     ```
     *Artefato NSIS:* `src-tauri/target/i686-pc-windows-msvc/release/bundle/nsis/`

   - **Build de Ambas as Arquiteturas:**
     ```bash
     npm run build:all
     ```

---

## ⌨️ Atalhos Padrão

| Atalho | Ação |
| :--- | :--- |
| `Ctrl + Shift + Space` | Alternar visibilidade da janela (Global) |
| `Ctrl + N` | Criar nova nota |
| `Ctrl + B` | Alternar barra lateral (Sidebar) |

---

## 📂 Estrutura do Projeto

```
mec-notes/
├── .github/workflows/      # CI/CD GitHub Actions (build Windows + Ubuntu)
├── src/                    # Frontend (React + TypeScript + Tailwind)
│   ├── components/         # Componentes UI (Editor, Sidebar, StickyNoteView, Titlebar, Settings)
│   ├── services/           # Comunicação IPC com o backend Tauri (dbService)
│   ├── App.tsx             # Estado principal e roteamento da janela (Main vs Sticky)
│   └── main.tsx            # Ponto de entrada do React
├── src-tauri/              # Backend (Rust + Tauri v2)
│   ├── src/
│   │   ├── db.rs           # Camada SQLite, migrações, sticky_windows e persistência
│   │   ├── lib.rs          # Gerenciamento de janelas, IPC, System Tray e Atalhos Globais
│   │   ├── main.rs         # Inicialização do executável
│   │   └── tests.rs        # Testes unitários do SQLite e janelas adesivas
│   ├── Cargo.toml          # Dependências Rust
│   └── tauri.conf.json     # Configurações do Tauri (janelas, permissões, bundles)
└── package.json            # Scripts e dependências do Node.js
```
