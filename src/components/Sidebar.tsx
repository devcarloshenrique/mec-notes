import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Trash2,
  Pin,
  PinOff,
  Tag,
  FileText,
  X,
  AlertTriangle,
} from "lucide-react";
import { Note } from "../services/db";

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (note: Note) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (note: Note) => void;
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onTogglePin,
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Extrair todas as tags únicas
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach((note) => {
      note.tags?.forEach((tag) => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [notes]);

  // Filtragem de notas por busca de texto e tag
  const filteredNotes = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return notes.filter((note) => {
      const matchesQuery =
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags?.some((t) => t.toLowerCase().includes(query));

      const matchesTag = !selectedTag || note.tags?.includes(selectedTag);

      return matchesQuery && matchesTag;
    });
  }, [notes, searchQuery, selectedTag]);

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingNoteId(id);
  };

  const handleExecuteDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteNote(id);
    setDeletingNoteId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingNoteId(null);
  };

  const handleTogglePinClick = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    onTogglePin(note);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col h-full select-none text-slate-200 shrink-0">
      {/* Cabeçalho da Sidebar */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-sm tracking-wide text-slate-100">
            Notas
          </span>
          <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
            {notes.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreateNote}
            title="Nova Nota (Ctrl+N)"
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2.5 py-1.5 rounded font-medium transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded md:hidden"
              title="Fechar painel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="p-2.5 border-b border-slate-800/80">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por título, conteúdo ou #tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-xs rounded pl-8 pr-7 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtro de Tags */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto mt-2 pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedTag(null)}
              className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap transition ${
                selectedTag === null
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 border border-transparent"
              }`}
            >
              Todas
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap transition ${
                  selectedTag === tag
                    ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800 border border-transparent"
                }`}
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista de Notas */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            {searchQuery || selectedTag
              ? "Nenhuma nota encontrada com os filtros atuais."
              : "Nenhuma nota ainda. Clique em 'Nova' para começar."}
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isActive = note.id === activeNoteId;
            const isDeleting = deletingNoteId === note.id;

            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note)}
                className={`group relative p-2.5 rounded cursor-pointer transition border ${
                  isActive
                    ? "bg-slate-800/90 border-indigo-500/50 shadow-sm"
                    : "bg-slate-900/40 hover:bg-slate-900 border-slate-800/60 hover:border-slate-700"
                }`}
              >
                {/* Modal de confirmação de exclusão embutido no card */}
                {isDeleting ? (
                  <div className="p-1 bg-red-950/80 border border-red-800/80 rounded flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-red-200 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>Excluir nota?</span>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={handleCancelDelete}
                        className="text-[11px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={(e) => handleExecuteDelete(e, note.id)}
                        className="text-[11px] px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded font-medium transition"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <h4
                        className={`text-xs font-semibold truncate flex-1 ${
                          isActive ? "text-indigo-200" : "text-slate-200"
                        }`}
                      >
                        {note.title.trim() || "Nota Sem Título"}
                      </h4>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleTogglePinClick(e, note)}
                          title={note.is_pinned ? "Desafixar" : "Fixar no topo"}
                          className={`p-1 rounded hover:bg-slate-700 transition ${
                            note.is_pinned
                              ? "text-amber-400 opacity-100"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {note.is_pinned ? (
                            <Pin className="w-3 h-3 fill-amber-400" />
                          ) : (
                            <PinOff className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={(e) => confirmDelete(e, note.id)}
                          title="Excluir nota"
                          className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {note.is_pinned && (
                        <Pin className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0 group-hover:hidden" />
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {note.content.trim() || "Sem conteúdo"}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/40 text-[10px] text-slate-500">
                      <div className="flex items-center gap-1 overflow-hidden">
                        {note.tags && note.tags.length > 0 ? (
                          note.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="bg-slate-800 text-slate-400 px-1 rounded truncate max-w-[60px]"
                            >
                              #{t}
                            </span>
                          ))
                        ) : (
                          <span>Sem tags</span>
                        )}
                        {note.tags && note.tags.length > 2 && (
                          <span className="text-slate-500">+{note.tags.length - 2}</span>
                        )}
                      </div>
                      <span className="shrink-0">{formatDate(note.updated_at)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
