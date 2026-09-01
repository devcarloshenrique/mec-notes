#[cfg(test)]
mod tests {
    use std::fs;
    use tauri_plugin_global_shortcut::Shortcut;
    use crate::db::{
        db_clear_all_notes, db_delete_note, db_export_to, db_get_note_by_id, db_get_notes,
        db_get_open_sticky_windows, db_get_settings, db_get_sticky_window, db_import_from,
        db_save_note, db_save_sticky_geometry, db_set_sticky_open, db_update_setting,
        get_default_db_path, init_db, DbState, Note,
    };

    #[test]
    fn test_shortcut_parsing() {
        let s = "Ctrl+Shift+Space".parse::<Shortcut>();
        assert!(s.is_ok());

        let s2 = "Ctrl+Alt+N".parse::<Shortcut>();
        assert!(s2.is_ok());

        let s3 = "Alt+Space".parse::<Shortcut>();
        assert!(s3.is_ok());
    }

    #[test]
    fn test_default_db_path_points_to_mecnotes_folder() {
        let path = get_default_db_path().expect("Deveria obter caminho de documentos");
        assert!(path.ends_with("MecNotes\\notas.db") || path.ends_with("MecNotes/notas.db"));
        let docs = dirs::document_dir().expect("Deveria ter diretório de documentos");
        assert_eq!(path.parent().unwrap(), docs.join("MecNotes").as_path());
    }

    #[test]
    fn test_sqlite_crud_operations() {
        let temp_dir = std::env::temp_dir().join("mec_notes_test_crud");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);
        let db_file = temp_dir.join("test_notas.db");

        let conn = init_db(&db_file).expect("Deveria inicializar banco de dados SQLite");

        // 1. Inserir nota
        let note1 = Note {
            id: "note-1".to_string(),
            title: "Primeira Nota".to_string(),
            content: "# Olá Mundo\nConteúdo em markdown.".to_string(),
            tags: vec!["rust".to_string(), "tauri".to_string()],
            is_pinned: false,
            created_at: "2026-08-29T10:00:00Z".to_string(),
            updated_at: "2026-08-29T10:00:00Z".to_string(),
        };
        db_save_note(&conn, note1.clone()).expect("Deveria salvar nota 1");

        // 2. Inserir segunda nota (fixada)
        let note2 = Note {
            id: "note-2".to_string(),
            title: "Segunda Nota Fixada".to_string(),
            content: "Conteúdo importante".to_string(),
            tags: vec!["fixada".to_string()],
            is_pinned: true,
            created_at: "2026-08-29T11:00:00Z".to_string(),
            updated_at: "2026-08-29T11:00:00Z".to_string(),
        };
        db_save_note(&conn, note2.clone()).expect("Deveria salvar nota 2");

        // 3. Listar notas e verificar ordenação (fixadas primeiro)
        let notes = db_get_notes(&conn).expect("Deveria listar notas");
        assert_eq!(notes.len(), 2);
        assert_eq!(notes[0].id, "note-2"); // Fixada vem primeiro
        assert_eq!(notes[1].id, "note-1");

        // 4. Buscar por ID
        let found = db_get_note_by_id(&conn, "note-1").expect("Deveria buscar nota");
        assert!(found.is_some());
        let found_note = found.unwrap();
        assert_eq!(found_note.title, "Primeira Nota");
        assert_eq!(found_note.tags, vec!["rust", "tauri"]);

        // 5. Atualizar nota existente (UPSERT)
        let mut updated_note1 = note1.clone();
        updated_note1.title = "Primeira Nota Atualizada".to_string();
        updated_note1.is_pinned = true;
        db_save_note(&conn, updated_note1).expect("Deveria atualizar nota");

        let found_updated = db_get_note_by_id(&conn, "note-1").unwrap().unwrap();
        assert_eq!(found_updated.title, "Primeira Nota Atualizada");
        assert!(found_updated.is_pinned);

        // 6. Sticky windows operations
        db_save_sticky_geometry(&conn, "note-1", 120.0, 150.0, 300.0, 400.0)
            .expect("Deveria salvar geometria da sticky window");

        let sticky = db_get_sticky_window(&conn, "note-1")
            .expect("Deveria buscar sticky window")
            .expect("Deveria encontrar sticky window");
        assert_eq!(sticky.note_id, "note-1");
        assert_eq!(sticky.x, 120.0);
        assert_eq!(sticky.y, 150.0);
        assert_eq!(sticky.width, 300.0);
        assert_eq!(sticky.height, 400.0);
        assert!(sticky.is_open);

        let open_windows = db_get_open_sticky_windows(&conn).expect("Deveria listar abertas");
        assert_eq!(open_windows.len(), 1);
        assert_eq!(open_windows[0].note_id, "note-1");

        db_set_sticky_open(&conn, "note-1", false).expect("Deveria fechar sticky");
        let open_windows_after = db_get_open_sticky_windows(&conn).unwrap();
        assert_eq!(open_windows_after.len(), 0);

        // 7. Deletar nota (deve remover sticky associada)
        let deleted = db_delete_note(&conn, "note-2").expect("Deveria deletar nota");
        assert!(deleted);

        let notes_after_delete = db_get_notes(&conn).expect("Deveria listar notas");
        assert_eq!(notes_after_delete.len(), 1);
        assert_eq!(notes_after_delete[0].id, "note-1");

        // 8. Limpar todas as notas
        let cleared_count = db_clear_all_notes(&conn).expect("Deveria limpar todas as notas");
        assert_eq!(cleared_count, 1);

        let notes_after_clear = db_get_notes(&conn).expect("Deveria listar notas");
        assert_eq!(notes_after_clear.len(), 0);

        // Limpeza
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_settings_operations() {
        let temp_dir = std::env::temp_dir().join("mec_notes_test_settings");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);
        let db_file = temp_dir.join("test_settings.db");

        let conn = init_db(&db_file).expect("Deveria inicializar banco de dados SQLite");

        // Configurações padrão
        let settings = db_get_settings(&conn).expect("Deveria obter configurações");
        assert_eq!(settings.hotkey, "Ctrl+Shift+Space");
        assert_eq!(settings.theme, "dark");

        // Atualizar hotkey
        db_update_setting(&conn, "hotkey", "Ctrl+Alt+N").expect("Deveria atualizar hotkey");
        let updated_settings = db_get_settings(&conn).expect("Deveria obter configurações");
        assert_eq!(updated_settings.hotkey, "Ctrl+Alt+N");

        // Limpeza
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_export_and_import_database() {
        let temp_dir = std::env::temp_dir().join("mec_notes_test_backup");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let original_db_file = temp_dir.join("original_notas.db");
        let backup_db_file = temp_dir.join("backup_notas.db");
        let import_source_db_file = temp_dir.join("import_source.db");

        let db_state = DbState::new(original_db_file.clone()).expect("Deveria criar DbState");

        // Inserir dados no banco original
        {
            let conn = db_state.conn.lock().unwrap();
            let note = Note {
                id: "orig-1".to_string(),
                title: "Nota Original".to_string(),
                content: "Dados originais".to_string(),
                tags: vec!["orig".to_string()],
                is_pinned: false,
                created_at: "2026-08-29T10:00:00Z".to_string(),
                updated_at: "2026-08-29T10:00:00Z".to_string(),
            };
            db_save_note(&conn, note).unwrap();
        }

        // 1. Exportar
        db_export_to(&original_db_file, &backup_db_file).expect("Deveria exportar banco");
        assert!(backup_db_file.exists());

        // 2. Criar outro banco para importar com dados diferentes
        {
            let conn_import = init_db(&import_source_db_file).unwrap();
            let imported_note = Note {
                id: "import-99".to_string(),
                title: "Nota Importada".to_string(),
                content: "Dados vindos de backup".to_string(),
                tags: vec!["backup".to_string()],
                is_pinned: true,
                created_at: "2026-08-29T12:00:00Z".to_string(),
                updated_at: "2026-08-29T12:00:00Z".to_string(),
            };
            db_save_note(&conn_import, imported_note).unwrap();
            db_update_setting(&conn_import, "hotkey", "Ctrl+Shift+B").unwrap();
        }

        // 3. Importar para o db_state
        let new_settings = db_import_from(&db_state, &import_source_db_file)
            .expect("Deveria importar com sucesso");
        assert_eq!(new_settings.hotkey, "Ctrl+Shift+B");

        // 4. Verificar se os dados no db_state agora são os importados
        {
            let conn = db_state.conn.lock().unwrap();
            let notes = db_get_notes(&conn).unwrap();
            assert_eq!(notes.len(), 1);
            assert_eq!(notes[0].id, "import-99");
            assert_eq!(notes[0].title, "Nota Importada");
        }

        // Limpeza
        let _ = fs::remove_dir_all(&temp_dir);
    }
}

