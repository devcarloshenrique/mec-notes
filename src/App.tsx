import { useState, useEffect, useCallback } from "react";
import {
  PanelLeftClose,
  PanelLeft,
  Minimize2,
  Maximize2,
  Minus,
  Layers,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { dbService, Note, AppSettings } from "./services/db";

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFloating, setIsFloating] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar notas e configurações iniciais
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

      // Se houver notas, seleciona a primeira nota (fixada ou mais recente)
      if (fetchedNotes.length > 0) {
        setActiveNote(fetchedNotes[0]);
      } else {
        // Cria uma nota de boas-vindas padrão se estiver vazio
        const initialNote: Note = {
          id: crypto.randomUUID(),
          title: "Bem-vindo ao Mec Notes 🚀",
          content: `# Bem-vindo ao Mec Notes!

Um bloco de notas ultra rápido para Windows com persistência SQLite local.

### Principais Recursos:
- **Modo Flutuante e Janela**: Alterne rapidamente com o botão no cabeçalho.
- **Atalho Global**: Pressione \`Ctrl+Shift+Space\` para abrir/ocultar instantaneamente.
- **Markdown Completo**: Escreva com listas, títulos, código e pré-visualização.
- **Auto-save com Debounce**: Suas notas são salvas automaticamente enquanto você digita.
- **Tags e Fixação**: Organize notas com #tags e fixe notas importantes no topo.

Aproveite sua produtividade!`,
          tags: ["guia", "inicio"],
          is_pinned: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          const saved = await dbService.saveNote(initialNote);
          setNotes([saved]);
          setActiveNote(saved);
        } catch {
          setNotes([initialNote]);
          setActiveNote(initialNote);
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

  // Alternância de Modo Janela / Flutuante
  const handleToggleMode = async () => {
    try {
      if (isFloating) {
        await dbService.setWindowMode();
        setIsFloating(false);
      } else {
        await dbService.setFloatingMode();
        setIsFloating(true);
      }
    } catch (err) {
      console.error("Erro ao alternar modo de janela:", err);
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
      title: "Nova Nota",
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
        // Reordenar se fixado mudou ou ordenado por updated_at
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

  // Fixar / Desafixar nota
  const handleTogglePin = async (note: Note) => {
    const updated = { ...note, is_pinned: !note.is_pinned };
    await handleSaveNote(updated);
  };

  // Atalhos de Teclado Globais do Editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N para nova nota
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleCreateNote();
      }
      // Ctrl+B para abrir/fechar sidebar
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateNote]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Barra de Título Customizada da Aplicação */}
      <header
        data-tauri-drag-region
        className="h-9 bg-slate-950 border-b border-slate-800/80 px-3 flex items-center justify-between text-xs shrink-0 select-none cursor-move"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-slate-200 tracking-wide text-xs">
            Mec Notes
          </span>
          <span className="text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded">
            v0.1.0
          </span>
        </div>

        {/* Controles do Cabeçalho */}
        <div className="flex items-center gap-1 cursor-default">
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded transition"
            title={isSidebarOpen ? "Recolher barra lateral (Ctrl+B)" : "Expandir barra lateral (Ctrl+B)"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-3.5 h-3.5" />
            ) : (
              <PanelLeft className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleToggleMode}
            className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded transition"
            title={isFloating ? "Modo Janela Completa" : "Modo Flutuante Compacto"}
          >
            {isFloating ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleMinimize}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded transition"
            title="Minimizar para bandeja"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Conteúdo Principal (Sidebar + Editor) */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          notes={notes}
          activeNoteId={activeNote?.id || null}
          onSelectNote={(note) => setActiveNote(note)}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onTogglePin={handleTogglePin}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Carregando notas...
          </div>
        ) : (
          <Editor
            note={activeNote}
            onSaveNote={handleSaveNote}
            autoSaveInterval={settings?.auto_save_interval ?? 500}
          />
        )}
      </div>
    </div>
  );
}
