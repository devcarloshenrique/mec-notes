import { useState, useEffect, useCallback, useMemo } from "react";
import { WindowTitlebar } from "./components/WindowTitlebar";
import { NotesSidebar } from "./components/NotesSidebar";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { StickyNoteView } from "./components/StickyNoteView";
import { dbService, Note, AppSettings } from "./services/db";

export default function App() {
  // Detectar rota de Sticky Note: ?sticky=<id> ou ?sticky=true&noteId=<id>
  const stickyNoteId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const sticky = params.get("sticky");
    const noteId = params.get("noteId");

    if (sticky && sticky !== "true") {
      return sticky;
    }
    if ((sticky === "true" || sticky === "1") && noteId) {
      return noteId;
    }
    if (noteId) {
      return noteId;
    }
    return null;
  }, []);

  // Se a rota for uma nota adesiva individual, renderizar diretamente o StickyNoteView
  if (stickyNoteId) {
    return <StickyNoteView noteId={stickyNoteId} />;
  }

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [query, setQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mode, setMode] = useState<"floating" | "window">("floating");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Alternância entre Modo Flutuante e Modo Janela
  const handleToggleMode = async () => {
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
    }
  };

  const handleMinimize = async () => {
    try {
      await dbService.minimizeToTray();
    } catch (err) {
      console.error("Erro ao minimizar:", err);
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
      setNotes((prev) => [saved, ...prev]);
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
      const saved = await dbService.saveNote(updatedNote);
      setNotes((prev) => {
        const next = prev.map((n) => (n.id === saved.id ? saved : n));
        return next.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) {
            return a.is_pinned ? -1 : 1;
          }
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      });
      setActiveNote(saved);
    } catch (err) {
      console.error("Erro ao salvar nota:", err);
    }
  };

  // Excluir nota
  const handleDeleteNote = async (id: string) => {
    try {
      await dbService.deleteNote(id);
      const remainingNotes = notes.filter((n) => n.id !== id);
      setNotes(remainingNotes);

      if (activeNote?.id === id) {
        setActiveNote(remainingNotes.length > 0 ? remainingNotes[0] : null);
      }
    } catch (err) {
      console.error("Erro ao excluir nota:", err);
    }
  };

  // Fixar / desafixar nota
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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-card text-foreground select-none">
      {/* Barra de Título Customizada (WindowTitlebar) */}
      <WindowTitlebar
        mode={mode}
        onToggleMode={handleToggleMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onMinimize={handleMinimize}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Conteúdo Principal (Sidebar + Editor) */}
      <div className="relative flex flex-1 overflow-hidden">
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
          />
        )}

        {loading ? (
          <div className="grid flex-1 place-items-center text-xs text-muted-foreground">
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

        {/* Modal de Configurações (SettingsPanel) */}
        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onDataChanged={loadInitialData}
        />
      </div>
    </div>
  );
}
