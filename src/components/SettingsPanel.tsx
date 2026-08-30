import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Download,
  Keyboard,
  Upload,
  X,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { dbService } from "../services/db";

type Props = {
  open: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
};

const KEY_LABEL: Record<string, string> = {
  Control: "Ctrl",
  Shift: "Shift",
  Alt: "Alt",
  Meta: "Win",
  " ": "Space",
};

export function SettingsPanel({ open, onClose, onDataChanged }: Props) {
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<string[]>(["Ctrl", "Shift", "Space"]);
  const [savedHotkey, setSavedHotkey] = useState<string>("Ctrl+Shift+Space");
  const [dbPath, setDbPath] = useState<string>("C:\\Users\\devca\\Documents\\MecNotes\\notas.db");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingHotkey, setIsSavingHotkey] = useState(false);
  const [isClearingNotes, setIsClearingNotes] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const showFeedback = useCallback(
    (type: "success" | "error", message: string) => {
      setFeedback({ type, message });
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 4000);
      return () => clearTimeout(timer);
    },
    []
  );

  // Carregar configurações e caminho do banco SQLite
  useEffect(() => {
    if (!open) {
      setCapturing(false);
      setShowClearConfirm(false);
      setFeedback(null);
      return;
    }

    let isMounted = true;

    async function loadData() {
      try {
        const [loadedSettings, loadedPath] = await Promise.all([
          dbService.getSettings().catch(() => ({
            hotkey: "Ctrl+Shift+Space",
            theme: "dark",
            default_mode: "floating",
            auto_save_interval: 500,
          })),
          dbService.getDbPath().catch(() => "C:\\Users\\devca\\Documents\\MecNotes\\notas.db"),
        ]);

        if (isMounted) {
          const hk = loadedSettings.hotkey || "Ctrl+Shift+Space";
          setSavedHotkey(hk);
          setCaptured(hk.split("+"));
          setDbPath(loadedPath);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Captura de atalho do teclado
  useEffect(() => {
    if (!capturing) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setCaptured(savedHotkey.split("+"));
        setCapturing(false);
        return;
      }

      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Control");
      if (e.shiftKey) mods.push("Shift");
      if (e.altKey) mods.push("Alt");
      if (e.metaKey) mods.push("Meta");

      const key = e.key;
      if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
        let label = KEY_LABEL[key] ?? (key.length === 1 ? key.toUpperCase() : key);
        if (label === " ") label = "Space";
        const finalKeys = [...mods.map((m) => KEY_LABEL[m] || m), label];
        setCaptured(finalKeys);
      } else {
        setCaptured(mods.map((m) => KEY_LABEL[m] || m));
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [capturing, savedHotkey]);

  // Fechar com Escape quando inativo
  useEffect(() => {
    if (!open || capturing || showClearConfirm) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, capturing, showClearConfirm, onClose]);

  // Salvar atalho capturado
  const handleSaveHotkey = async () => {
    const newHotkeyStr = captured.join("+");
    try {
      setIsSavingHotkey(true);
      await dbService.updateHotkeySetting(newHotkeyStr);
      setSavedHotkey(newHotkeyStr);
      setCapturing(false);
      showFeedback("success", `Atalho atualizado para: ${newHotkeyStr}`);
    } catch (err) {
      console.error("Erro ao salvar atalho:", err);
      showFeedback(
        "error",
        typeof err === "string" ? err : `Falha ao salvar atalho: ${newHotkeyStr}`
      );
    } finally {
      setIsSavingHotkey(false);
    }
  };

  // Exportar banco de dados (Abre diálogo nativo do Windows)
  const handleExportDb = async () => {
    try {
      setIsExporting(true);
      const res = await dbService.exportDb();
      if (res) {
        showFeedback("success", res);
      }
    } catch (err) {
      console.error("Erro ao exportar banco:", err);
      showFeedback(
        "error",
        typeof err === "string" ? err : "Erro ao exportar o banco de dados."
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Importar banco de dados (Abre diálogo nativo do Windows)
  const handleImportDb = async () => {
    try {
      setIsImporting(true);
      const updatedSettings = await dbService.importDb();
      if (updatedSettings) {
        const hk = updatedSettings.hotkey || "Ctrl+Shift+Space";
        setSavedHotkey(hk);
        setCaptured(hk.split("+"));
        showFeedback(
          "success",
          "Banco de dados importado e restaurado com sucesso!"
        );
        if (onDataChanged) {
          onDataChanged();
        }
      }
    } catch (err) {
      console.error("Erro ao importar banco:", err);
      showFeedback(
        "error",
        typeof err === "string" ? err : "Erro ao importar o banco de dados."
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Limpar todas as notas
  const handleClearAllNotes = async () => {
    try {
      setIsClearingNotes(true);
      await dbService.clearAllNotes();
      showFeedback("success", "Todas as notas foram apagadas com sucesso!");
      setShowClearConfirm(false);
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (err) {
      console.error("Erro ao limpar notas:", err);
      showFeedback(
        "error",
        typeof err === "string" ? err : "Erro ao limpar as notas."
      );
    } finally {
      setIsClearingNotes(false);
    }
  };

  if (!open) return null;

  const isPendingChanges = captured.join("+") !== savedHotkey;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 select-none">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Configurações"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Configurações</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Notificações / Feedbacks */}
        {feedback && (
          <div
            className={`mx-4 mt-3 px-3 py-2 rounded-md flex items-center gap-2 text-xs border ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-800/80 text-emerald-300"
                : "bg-destructive/20 border-destructive/50 text-destructive-foreground"
            }`}
          >
            {feedback.type === "success" ? (
              <Check className="size-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="size-3.5 text-destructive shrink-0" />
            )}
            <span className="leading-tight">{feedback.message}</span>
          </div>
        )}

        {/* Conteúdo com Scroll */}
        <div className="space-y-5 p-4 overflow-y-auto">
          {/* BLOCO 1: Atalho global de ativação */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Keyboard className="size-4 text-primary shrink-0" />
              <h3 className="text-[13px] font-medium text-foreground">
                Atalho global de ativação
              </h3>
            </div>
            <p className="mb-2.5 text-[12px] leading-relaxed text-muted-foreground">
              Invoca o MEC Notes instantaneamente de qualquer lugar do Windows. A nova tecla é enviada ao backend Rust,
              que atualiza o <code className="font-mono text-primary">global-shortcut</code> e persiste a escolha.
            </p>
            <div className="flex items-center gap-2">
              <div
                className={`flex flex-1 items-center gap-1.5 rounded-md border border-border bg-background/40 px-3 py-2 transition ${
                  capturing ? "border-primary/40 ring-1 ring-white/20" : ""
                }`}
              >
                {capturing ? (
                  <span className="text-[12px] text-primary font-medium animate-pulse">
                    Pressione as teclas… (Esc cancela)
                  </span>
                ) : captured.length === 0 ? (
                  <span className="text-[12px] text-muted-foreground">
                    Pressione as teclas…
                  </span>
                ) : (
                  captured.map((k, i) => (
                    <kbd
                      key={i}
                      className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                    >
                      {k}
                    </kbd>
                  ))
                )}
              </div>

              {isPendingChanges || capturing ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setCaptured(savedHotkey.split("+"));
                      setCapturing(false);
                    }}
                    disabled={isSavingHotkey}
                    className="rounded-md border border-border bg-background/40 hover:bg-accent px-2.5 py-2 text-[12px] font-medium text-muted-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveHotkey}
                    disabled={isSavingHotkey}
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 shadow-sm"
                  >
                    {isSavingHotkey ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    <span>Salvar</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCaptured([]);
                    setCapturing(true);
                  }}
                  className="rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Alterar
                </button>
              )}
            </div>
          </section>

          {/* BLOCO 2: Banco de dados */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Database className="size-4 text-primary shrink-0" />
              <h3 className="text-[13px] font-medium text-foreground">Banco de dados</h3>
            </div>
            <div className="rounded-md border border-border bg-background/40 px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Caminho do arquivo
              </span>
              <p className="mt-0.5 truncate font-mono text-[12px] text-foreground">
                {dbPath}
              </p>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Resolvido automaticamente a partir de <code className="font-mono text-primary">~/Documents/MecNotes</code> pelo backend Rust.
            </p>
          </section>

          {/* BLOCO 3: Importar / Exportar */}
          <section>
            <h3 className="mb-2 text-[13px] font-medium text-foreground">Importar / Exportar</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportDb}
                disabled={isExporting || isImporting}
                className="flex items-center justify-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                <span>{isExporting ? "Aguardando..." : "Exportar tudo"}</span>
              </button>

              <button
                onClick={handleImportDb}
                disabled={isExporting || isImporting}
                className="flex items-center justify-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                {isImporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                <span>{isImporting ? "Aguardando..." : "Importar"}</span>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Faz o dump ou a substituição do histórico completo de notas via comandos <code className="font-mono">invoke</code>.
            </p>
          </section>

          {/* BLOCO 4: Zona de Perigo / Limpar Notas */}
          <section className="border-t border-border pt-4">
            <h3 className="mb-2 text-[13px] font-medium text-destructive">Zona de Perigo</h3>

            {showClearConfirm ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Deseja apagar todas as notas do banco SQLite?</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Esta ação é permanente e limpará todo o histórico de notas salvas.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearingNotes}
                    className="rounded-md border border-border bg-background/40 hover:bg-accent px-2.5 py-1 text-xs font-medium text-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleClearAllNotes}
                    disabled={isClearingNotes}
                    className="flex items-center gap-1 rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground transition-opacity hover:opacity-90 shadow-sm"
                  >
                    {isClearingNotes ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                    <span>Confirmar Exclusão</span>
                  </button>
                </div>
              </div>
            ) : (
              <div                 className="flex items-center justify-between rounded-md border border-border bg-background/40 p-3">
                <div>
                  <div className="text-xs font-medium text-foreground">
                    Limpar todas as notas
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Apaga todas as notas sem resetar configurações.
                  </div>
                </div>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium px-2.5 py-1.5 transition-colors shrink-0 ml-2"
                >
                  <Trash2 className="size-3.5" />
                  <span>Limpar tudo</span>
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
