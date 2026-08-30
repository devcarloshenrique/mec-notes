pub mod db;

pub mod commands {
    use std::path::PathBuf;
    use tauri::{
        AppHandle, LogicalSize, Manager, PhysicalPosition, Position, Size, State, WebviewWindow,
    };
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    use crate::db::{
        db_clear_all_notes, db_delete_note, db_export_to, db_get_note_by_id, db_get_notes,
        db_get_settings, db_import_from, db_save_note, db_update_setting, AppSettings, DbState,
        Note,
    };

    // ==========================================
    // Comandos de Janela e Atalhos
    // ==========================================

    #[tauri::command]
    pub fn toggle_window_visibility(app: AppHandle) -> Result<bool, String> {
        if let Some(window) = app.get_webview_window("main") {
            let is_visible = window.is_visible().map_err(|e| e.to_string())?;
            if is_visible {
                window.hide().map_err(|e| e.to_string())?;
                Ok(false)
            } else {
                window.show().map_err(|e| e.to_string())?;
                window.set_focus().map_err(|e| e.to_string())?;
                Ok(true)
            }
        } else {
            Err("Janela principal não encontrada".to_string())
        }
    }

    #[tauri::command]
    pub fn set_floating_mode(window: WebviewWindow) -> Result<(), String> {
        // Configurações para modo flutuante: sem decorações, sempre no topo, canto inferior direito
        window.set_decorations(false).map_err(|e| e.to_string())?;
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
        window.set_resizable(true).map_err(|e| e.to_string())?;
        window.set_skip_taskbar(false).map_err(|e| e.to_string())?;

        let width = 380.0;
        let height = 520.0;
        window
            .set_size(Size::Logical(LogicalSize { width, height }))
            .map_err(|e| e.to_string())?;

        // Posicionar no canto inferior direito do monitor atual
        if let Ok(Some(monitor)) = window.current_monitor() {
            let screen_size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let screen_width = screen_size.width as f64 / scale_factor;
            let screen_height = screen_size.height as f64 / scale_factor;

            let margin = 24.0;
            let taskbar_margin = 48.0; // Margem para barra de tarefas do Windows
            let x = (screen_width - width - margin).max(0.0);
            let y = (screen_height - height - taskbar_margin).max(0.0);

            let phys_x = (x * scale_factor) as i32;
            let phys_y = (y * scale_factor) as i32;

            window
                .set_position(Position::Physical(PhysicalPosition {
                    x: phys_x,
                    y: phys_y,
                }))
                .map_err(|e| e.to_string())?;
        }

        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub fn set_window_mode(window: WebviewWindow) -> Result<(), String> {
        // Configurações para modo janela: com decorações, centralizado e redimensionável
        window.set_decorations(true).map_err(|e| e.to_string())?;
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_resizable(true).map_err(|e| e.to_string())?;
        window.set_skip_taskbar(false).map_err(|e| e.to_string())?;

        let width = 850.0;
        let height = 600.0;
        window
            .set_size(Size::Logical(LogicalSize { width, height }))
            .map_err(|e| e.to_string())?;
        window.center().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub fn minimize_to_tray(window: WebviewWindow) -> Result<(), String> {
        window.hide().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub fn register_global_shortcut(app: AppHandle, shortcut_str: String) -> Result<(), String> {
        let shortcut: Shortcut = shortcut_str
            .parse()
            .map_err(|_| format!("Atalho inválido: {}", shortcut_str))?;

        let global_shortcut_plugin = app.global_shortcut();

        // Desregistra todos os atalhos anteriores gerenciados
        let _ = global_shortcut_plugin.unregister_all();

        global_shortcut_plugin
            .on_shortcut(shortcut, move |app_handle, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = toggle_window_visibility(app_handle.clone());
                }
            })
            .map_err(|e| format!("Falha ao registrar atalho global: {}", e))?;

        Ok(())
    }

    // ==========================================
    // Comandos SQLite de Notas (CRUD)
    // ==========================================

    #[tauri::command]
    pub fn get_notes(state: State<'_, DbState>) -> Result<Vec<Note>, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_get_notes(&conn)
    }

    #[tauri::command]
    pub fn get_note_by_id(state: State<'_, DbState>, id: String) -> Result<Option<Note>, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_get_note_by_id(&conn, &id)
    }

    #[tauri::command]
    pub fn save_note(state: State<'_, DbState>, note: Note) -> Result<Note, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_save_note(&conn, note)
    }

    #[tauri::command]
    pub fn delete_note(state: State<'_, DbState>, id: String) -> Result<bool, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_delete_note(&conn, &id)
    }

    #[tauri::command]
    pub fn clear_all_notes(state: State<'_, DbState>) -> Result<usize, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_clear_all_notes(&conn)
    }

    // ==========================================
    // Comandos SQLite de Configurações
    // ==========================================

    #[tauri::command]
    pub fn get_settings(state: State<'_, DbState>) -> Result<AppSettings, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_get_settings(&conn)
    }

    #[tauri::command]
    pub fn update_hotkey_setting(
        app: AppHandle,
        state: State<'_, DbState>,
        hotkey: String,
    ) -> Result<(), String> {
        // Valida e registra o atalho global primeiro
        register_global_shortcut(app, hotkey.clone())?;

        // Atualiza a configuração no SQLite
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_update_setting(&conn, "hotkey", &hotkey)?;

        Ok(())
    }

    // ==========================================
    // Comandos de Exportação e Importação de Banco
    // ==========================================

    #[tauri::command]
    pub fn export_db(
        state: State<'_, DbState>,
        destination_path: Option<String>,
    ) -> Result<Option<String>, String> {
        let dest = if let Some(path_str) = destination_path {
            PathBuf::from(path_str)
        } else {
            // Abrir diálogo nativo do sistema para salvar arquivo
            let default_dir = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
            let file = rfd::FileDialog::new()
                .set_title("Exportar Banco de Dados SQLite")
                .set_directory(&default_dir)
                .set_file_name("notas_backup.db")
                .add_filter("SQLite Database (*.db, *.sqlite)", &["db", "sqlite"])
                .save_file();

            match file {
                Some(p) => p,
                None => return Ok(None), // Usuário cancelou o diálogo
            }
        };

        db_export_to(&state.db_path, &dest)?;
        Ok(Some(format!(
            "Banco de dados exportado com sucesso para: {}",
            dest.display()
        )))
    }

    #[tauri::command]
    pub fn import_db(
        app: AppHandle,
        state: State<'_, DbState>,
        source_path: Option<String>,
    ) -> Result<Option<AppSettings>, String> {
        let src = if let Some(path_str) = source_path {
            PathBuf::from(path_str)
        } else {
            // Abrir diálogo nativo do sistema para selecionar arquivo
            let default_dir = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
            let file = rfd::FileDialog::new()
                .set_title("Importar Banco de Dados SQLite")
                .set_directory(&default_dir)
                .add_filter("SQLite Database (*.db, *.sqlite)", &["db", "sqlite"])
                .pick_file();

            match file {
                Some(p) => p,
                None => return Ok(None), // Usuário cancelou o diálogo
            }
        };

        let settings = db_import_from(&state, &src)?;

        // Re-sincroniza o atalho global conforme as configurações importadas
        if !settings.hotkey.is_empty() {
            let _ = register_global_shortcut(app, settings.hotkey.clone());
        }

        Ok(Some(settings))
    }

    #[tauri::command]
    pub fn export_notes_db(
        state: State<'_, DbState>,
        destination_path: String,
    ) -> Result<String, String> {
        let dest = PathBuf::from(&destination_path);
        db_export_to(&state.db_path, &dest)?;
        Ok(format!(
            "Banco de dados exportado com sucesso para: {}",
            dest.display()
        ))
    }

    #[tauri::command]
    pub fn import_notes_db(
        app: AppHandle,
        state: State<'_, DbState>,
        source_path: String,
    ) -> Result<AppSettings, String> {
        let src = PathBuf::from(&source_path);
        let settings = db_import_from(&state, &src)?;

        // Re-sincroniza o atalho global conforme as configurações importadas
        if !settings.hotkey.is_empty() {
            let _ = register_global_shortcut(app, settings.hotkey.clone());
        }

        Ok(settings)
    }

    #[tauri::command]
    pub fn get_db_path(state: State<'_, DbState>) -> Result<String, String> {
        Ok(state.db_path.to_string_lossy().to_string())
    }
}

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_global_shortcut::ShortcutState;

use crate::db::{get_default_db_path, init_db, DbState};

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Abrir Notas", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Ocultar", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Mec Notes - Bloco de Notas Rápido")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = commands::toggle_window_visibility(app.clone());
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg(test)]
mod tests;

pub fn run() {
    let db_path = get_default_db_path().expect("Falha ao resolver caminho de ~/Documents/MecNotes/notas.db");
    log::info!("Inicializando banco de dados SQLite em: {:?}", db_path);

    let conn = init_db(&db_path).expect("Falha ao inicializar banco de dados SQLite");
    let db_state = DbState {
        conn: Mutex::new(conn),
        db_path,
    };

    tauri::Builder::default()
        .manage(db_state)
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut("Ctrl+Shift+Space")
                .map(|b| {
                    b.with_handler(|app, _shortcut, event| {
                        if event.state() == ShortcutState::Pressed {
                            let _ = commands::toggle_window_visibility(app.clone());
                        }
                    })
                })
                .unwrap_or_else(|_| tauri_plugin_global_shortcut::Builder::new())
                .build(),
        )
        .setup(|app| {
            setup_tray(app)?;

            // Iniciar com posição do modo flutuante
            if let Some(window) = app.get_webview_window("main") {
                let _ = commands::set_floating_mode(window);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::toggle_window_visibility,
            commands::set_floating_mode,
            commands::set_window_mode,
            commands::minimize_to_tray,
            commands::register_global_shortcut,
            commands::get_notes,
            commands::get_note_by_id,
            commands::save_note,
            commands::delete_note,
            commands::clear_all_notes,
            commands::get_settings,
            commands::update_hotkey_setting,
            commands::export_db,
            commands::import_db,
            commands::export_notes_db,
            commands::import_notes_db,
            commands::get_db_path,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar aplicação Tauri");
}
