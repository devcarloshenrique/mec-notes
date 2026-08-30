import { invoke } from "@tauri-apps/api/core";

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  hotkey: string;
  theme: string;
  default_mode: string;
  auto_save_interval: number;
}

export const dbService = {
  async getNotes(): Promise<Note[]> {
    return await invoke<Note[]>("get_notes");
  },

  async getNoteById(id: string): Promise<Note | null> {
    return await invoke<Note | null>("get_note_by_id", { id });
  },

  async saveNote(note: Note): Promise<Note> {
    return await invoke<Note>("save_note", { note });
  },

  async deleteNote(id: string): Promise<boolean> {
    return await invoke<boolean>("delete_note", { id });
  },

  async clearAllNotes(): Promise<number> {
    return await invoke<number>("clear_all_notes");
  },

  async getSettings(): Promise<AppSettings> {
    return await invoke<AppSettings>("get_settings");
  },

  async updateHotkeySetting(hotkey: string): Promise<void> {
    return await invoke<void>("update_hotkey_setting", { hotkey });
  },

  async exportDb(destinationPath?: string): Promise<string | null> {
    return await invoke<string | null>("export_db", { destinationPath });
  },

  async importDb(sourcePath?: string): Promise<AppSettings | null> {
    return await invoke<AppSettings | null>("import_db", { sourcePath });
  },

  async exportNotesDb(destinationPath: string): Promise<string> {
    return await invoke<string>("export_notes_db", { destinationPath });
  },

  async importNotesDb(sourcePath: string): Promise<AppSettings> {
    return await invoke<AppSettings>("import_notes_db", { sourcePath });
  },

  async getDbPath(): Promise<string> {
    return await invoke<string>("get_db_path");
  },

  async setFloatingMode(): Promise<void> {
    return await invoke<void>("set_floating_mode");
  },

  async setWindowMode(): Promise<void> {
    return await invoke<void>("set_window_mode");
  },

  async toggleWindowVisibility(): Promise<boolean> {
    return await invoke<boolean>("toggle_window_visibility");
  },

  async minimizeToTray(): Promise<void> {
    return await invoke<void>("minimize_to_tray");
  },
};
