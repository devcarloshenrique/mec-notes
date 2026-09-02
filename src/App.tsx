import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { WindowTitlebar } from "./components/WindowTitlebar";
import { NotesSidebar } from "./components/NotesSidebar";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { StickyNoteView } from "./components/StickyNoteView";
import { dbService, Note, AppSettings } from "./services/db";

export default function App() {
  // Detectar se a janela atual é uma Sticky Note (síncrona via label da WebviewWindow ou URL)
  const stickyNoteId = useMemo(() => {
    try {
      // 1. Tentar detectar pela label nativa do Tauri (ex: "sticky-1234")
      const win = getCurrentWindow();
      const label = win?.label;
      if (label && label.startsWith("sticky-")) {
        const id = label.replace("sticky-", "");
        if (id) return id;
      }

      // 2. Fallback via URLSearchParams (?sticky=<id> ou ?sticky=true&noteId=<id>)
      const params = new URLSearchParams(window.location.search);
      const sticky = params.get("sticky");
      const noteId = params.get("noteId");
      const pinnedNoteId = params.get("pinnedNoteId");

      if (pinnedNoteId) {
        return pinnedNoteId;
      }
      if (sticky && sticky !== "true") {
        return sticky;
      }
      if ((sticky === "true" || sticky === "1") && noteId) {
        return noteId;
      }
      if (noteId) {
        return noteId;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  if (stickyNoteId) {
    return <StickyNoteView noteId={stickyNoteId} />;
  }

  return <MainApp />;
}

function MainApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [query, setQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mode, setMode] = useState<"floating" | "window">("floating");
  const [isToggling, setIsToggling] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const modeRef = useRef<"floating" | "window">(mode);
  const geometryTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Carregar notas e configurações do SQLite via Tauri IPC
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedNotes, fetchedSettings] = await Promise.all([
        dbService.getNotes().catch(() => []),
        dbService.getSettings().catch(() => ({
          hotkey: "Ctrl+Shift+Space",
          theme: "dark",
          default_mode: "floating",
          auto_save_interval: 500,
        })),
      ]);

      setNotes(fetchedNotes);
      setSettings(fetchedSettings);

      if (fetchedNotes.length > 0) {
        setActiveNote(fetchedNotes[0]);
      } else {
        // Criar nota inicial de boas-vindas com markdown completo compatível com o mock
        const welcomeNote: Note = {
          id: crypto.randomUUID(),
          title: "Setup do Tauri",
          content: `# Setup do Tauri

Checklist inicial do projeto **mec-notes**.

- [x] \`tauri-plugin-global-shortcut\`
- [x] System Tray nativo
- [ ] Persistir hotkey no SQLite
- [ ] Modo janela com \`set_decorations(true)\`

> O banco \`notas.db\` fica em ~/Documents/MecNotes.
`,
          tags: ["setup", "inicio"],
          is_pinned: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          const saved = await dbService.saveNote(welcomeNote);
          setNotes([saved]);
          setActiveNote(saved);
        } catch {
          setNotes([welcomeNote]);
          setActiveNote(welcomeNote);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados iniciais:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Sincronização inter-janelas em tempo real via Tauri Event Bus
  useEffect(() => {
    let unlistenUpdated: (() => void) | null = null;
    let unlistenDeleted: (() => void) | null = null;
    let unlistenCleared: (() => void) | null = null;
    let isDisposed = false;

    const setupEventListeners = async () => {
      try {
        const uUpdated = await listen<Note>("note-updated", (event) => {
          if (isDisposed) return;
          const updatedNote = event.payload;
          if (!updatedNote || !updatedNote.id) return;

          setNotes((prev) => {
            const filtered = prev.filter((n) => n.id !== updatedNote.id);
            const next = [updatedNote, ...filtered];

            return next.sort((a, b) => {
              if (a.is_pinned !== b.is_pinned) {
                return a.is_pinned ? -1 : 1;
              }
              return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            });
          });

          setActiveNote((currentActive) => {
            if (currentActive && currentActive.id === updatedNote.id) {
              return updatedNote;
            }
            return currentActive;
          });
        });

        const uDeleted = await listen<string>("note-deleted", (event) => {
          if (isDisposed) return;
          const deletedId = event.payload;
          if (!deletedId) return;

          setNotes((prev) => {
            const next = prev.filter((n) => n.id !== deletedId);
            setActiveNote((currentActive) => {
              if (currentActive && currentActive.id === deletedId) {
                return next.length > 0 ? next[0] : null;
              }
              return currentActive;
            });
            return next;
          });
        });

        const uCleared = await listen<void>("notes-cleared", () => {
          if (isDisposed) return;
          setNotes([]);
          setActiveNote(null);
        });

        if (isDisposed) {
          uUpdated();
          uDeleted();
          uCleared();
        } else {
          unlistenUpdated = uUpdated;
          unlistenDeleted = uDeleted;
          unlistenCleared = uCleared;
        }
      } catch (err) {
        console.error("Erro ao configurar listeners de sincronização no MainApp:", err);
      }
    };

    setupEventListeners();

    return () => {
      isDisposed = true;
      if (unlistenUpdated) unlistenUpdated();
      if (unlistenDeleted) unlistenDeleted();
      if (unlistenCleared) unlistenCleared();
    };
  }, []);

  // Monitorar e persistir posição e tamanho da janela principal no modo flutuante
  useEffect(() => {
    let unlistenResize: (() => void) | null = null;
    let unlistenMove: (() => void) | null = null;
    let isDisposed = false;

    const setupFloatingGeometryListeners = async () => {
      try {
        const currentWin = getCurrentWindow();

        const saveGeometry = () => {
          if (isDisposed || modeRef.current !== "floating") return;
          if (geometryTimerRef.current) {
            clearTimeout(geometryTimerRef.current);
          }

          geometryTimerRef.current = setTimeout(async () => {
            if (isDisposed || modeRef.current !== "floating") return;
            try {
              const isMinimized = await currentWin.isMinimized().catch(() => false);
              const isVisible = await currentWin.isVisible().catch(() => false);
              if (isMinimized || !isVisible) return;

              const [pos, size, scale] = await Promise.all([
                currentWin.outerPosition(),
                currentWin.innerSize(),
                currentWin.scaleFactor(),
              ]);

              if (isDisposed || modeRef.current !== "floating") return;

              const logicalPos = pos.toLogical(scale);
              const logicalSize = size.toLogical(scale);

              // Validação de sanidade: evitar salvar coordenadas com valores espúrios
              if (
                logicalSize.width >= 200 &&
                logicalSize.height >= 150 &&
                logicalPos.x > -1000 &&
                logicalPos.y > -1000
              ) {
                await dbService.saveFloatingGeometry(
                  logicalPos.x,
                  logicalPos.y,
                  logicalSize.width,
                  logicalSize.height
                );
              }
            } catch (err) {
              console.error("Erro ao persistir geometria da janela flutuante:", err);
            }
          }, 350);
        };

        const resFn = await currentWin.onResized(() => {
          saveGeometry();
        });
        if (isDisposed) {
          resFn();
        } else {
          unlistenResize = resFn;
        }

        const moveFn = await currentWin.onMoved(() => {
          saveGeometry();
        });
        if (isDisposed) {
          moveFn();
        } else {
          unlistenMove = moveFn;
        }
      } catch (err) {
        console.error("Erro ao configurar listeners de geometria flutuante:", err);
      }
    };

    setupFloatingGeometryListeners();

    return () => {
      isDisposed = true;
      if (geometryTimerRef.current) {
        clearTimeout(geometryTimerRef.current);
        geometryTimerRef.current = null;
      }
      if (unlistenResize) unlistenResize();
      if (unlistenMove) unlistenMove();
    };
  }, []);

  // Alternância entre Modo Flutuante e Modo Janela
  const handleToggleMode = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      if (mode === "floating") {
        await dbService.setWindowMode();
        setMode("window");
      } else {
        await dbService.setFloatingMode();
        setMode("floating");
      }
    } catch (err) {
      console.error("Erro ao alternar modo:", err);
      setMode((m) => (m === "floating" ? "window" : "floating"));
    } finally {
      setIsToggling(false);
    }
  };

  const handleMinimize = async () => {
    try {
      await dbService.minimizeWindow();
    } catch (err) {
      console.error("Erro ao minimizar janela:", err);
    }
  };

  const handleCloseToTray = async () => {
    try {
      await dbService.minimizeToTray();
    } catch (err) {
      console.error("Erro ao fechar para bandeja:", err);
    }
  };

  // Criar nova nota
  const handleCreateNote = async () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: "Nova nota",
      content: "",
      tags: [],
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const saved = await dbService.saveNote(newNote);
      setActiveNote(saved);
    } catch (err) {
      console.error("Erro ao criar nota:", err);
      setNotes((prev) => [newNote, ...prev]);
      setActiveNote(newNote);
    }
  };

  // Salvar nota
  const handleSaveNote = async (updatedNote: Note) => {
    try {
      await dbService.saveNote(updatedNote);
    } catch (err) {
      console.error("Erro ao salvar nota:", err);
    }
  };

  // Atualizar título a partir da barra de título
  const handleUpdateTitle = (newTitle: string) => {
    if (!activeNote) return;
    const updated = {
      ...activeNote,
      title: newTitle,
      updated_at: new Date().toISOString(),
    };
    setActiveNote(updated);
    handleSaveNote(updated);
  };

  // Excluir nota
  const handleDeleteNote = async (id: string) => {
    try {
      await dbService.closeStickyNote(id).catch(() => {});
      await dbService.deleteNote(id);
    } catch (err) {
      console.error("Erro ao excluir nota:", err);
    }
  };

  // Fixar / desafixar nota no topo da lista
  const handleTogglePin = async (note: Note) => {
    const updated = {
      ...note,
      is_pinned: !note.is_pinned,
      updated_at: new Date().toISOString(),
    };
    await handleSaveNote(updated);
  };

  // Abrir nota como Sticky Note na área de trabalho
  const handleOpenSticky = async (note: Note) => {
    try {
      await dbService.openStickyNote(note.id);
    } catch (err) {
      console.error("Erro ao abrir nota adesiva:", err);
    }
  };

  // Atalhos de teclado locais
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleCreateNote();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative flex h-screen w-screen bg-app-dark text-app-text overflow-hidden antialiased select-none">
      {/* Sidebar Lateral */}
      {isSidebarOpen && (
        <NotesSidebar
          notes={notes}
          activeId={activeNote?.id || null}
          query={query}
          onQueryChange={setQuery}
          onSelect={(note) => setActiveNote(note)}
          onCreate={handleCreateNote}
          onDelete={handleDeleteNote}
          onTogglePin={handleTogglePin}
          onOpenSticky={handleOpenSticky}
          onToggleSidebar={() => setIsSidebarOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* Conteúdo Principal (Barra de Título + Editor) */}
      <div className="flex flex-col flex-1 overflow-hidden bg-app-editor">
        <WindowTitlebar
          mode={mode}
          activeNote={activeNote}
          onUpdateTitle={handleUpdateTitle}
          onToggleMode={handleToggleMode}
          onMinimize={handleMinimize}
          onCloseToTray={handleCloseToTray}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          isSidebarOpen={isSidebarOpen}
          onTogglePin={handleTogglePin}
          onOpenSticky={handleOpenSticky}
        />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-app-muted">
            Carregando notas...
          </div>
        ) : (
          <MarkdownEditor
            note={activeNote}
            onSaveNote={handleSaveNote}
            onTogglePin={handleTogglePin}
            onOpenSticky={handleOpenSticky}
            autoSaveInterval={settings?.auto_save_interval ?? 500}
          />
        )}
      </div>

      {/* Modal de Configurações */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDataChanged={loadInitialData}
      />
    </div>
  );
}
