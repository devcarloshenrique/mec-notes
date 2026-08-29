use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub is_pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub hotkey: String,
    pub theme: String,
    pub default_mode: String,
    pub auto_save_interval: u64,
}

pub struct DbState {
    pub conn: Mutex<Connection>,
    pub db_path: PathBuf,
}

impl DbState {
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        let conn = init_db(&db_path)?;
        Ok(Self {
            conn: Mutex::new(conn),
            db_path,
        })
    }
}

/// Retorna o caminho padrão do banco de dados: ~/Documents/notas.db
pub fn get_default_db_path() -> Result<PathBuf, String> {
    let docs_dir = dirs::document_dir()
        .ok_or_else(|| "Não foi possível localizar a pasta Documentos do usuário".to_string())?;

    if !docs_dir.exists() {
        fs::create_dir_all(&docs_dir)
            .map_err(|e| format!("Falha ao criar diretório de Documentos: {}", e))?;
    }

    Ok(docs_dir.join("notas.db"))
}

/// Inicializa o banco de dados e cria tabelas se não existirem
pub fn init_db(db_path: &Path) -> Result<Connection, String> {
    if let Some(parent) = db_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Falha ao criar diretório para o banco de dados: {}", e))?;
        }
    }

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Falha ao abrir banco de dados SQLite em {:?}: {}", db_path, e))?;

    // Otimizações SQLite para desktop
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        ",
    )
    .map_err(|e| format!("Falha ao configurar pragmas SQLite: {}", e))?;

    // Tabela notes
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            is_pinned INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        ",
        [],
    )
    .map_err(|e| format!("Falha ao criar tabela de notas: {}", e))?;

    // Tabela settings
    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
        [],
    )
    .map_err(|e| format!("Falha ao criar tabela de configurações: {}", e))?;

    // Inserir configurações padrão se não existirem
    let default_settings = [
        ("hotkey", "Ctrl+Shift+Space"),
        ("theme", "dark"),
        ("default_mode", "floating"),
        ("auto_save_interval", "500"),
    ];

    for (k, v) in default_settings {
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            params![k, v],
        )
        .map_err(|e| format!("Falha ao inserir configuração padrão {}: {}", k, e))?;
    }

    Ok(conn)
}

/// Funções de manipulação de Notas
pub fn db_get_notes(conn: &Connection) -> Result<Vec<Note>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, tags, is_pinned, created_at, updated_at 
             FROM notes 
             ORDER BY is_pinned DESC, updated_at DESC",
        )
        .map_err(|e| format!("Erro ao preparar consulta de notas: {}", e))?;

    let note_iter = stmt
        .query_map([], |row| {
            let tags_raw: String = row.get(3)?;
            let is_pinned_int: i64 = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_raw).unwrap_or_default();

            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                tags,
                is_pinned: is_pinned_int != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Erro ao executar consulta de notas: {}", e))?;

    let mut notes = Vec::new();
    for note in note_iter {
        notes.push(note.map_err(|e| format!("Erro ao mapear nota: {}", e))?);
    }

    Ok(notes)
}

pub fn db_get_note_by_id(conn: &Connection, id: &str) -> Result<Option<Note>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, tags, is_pinned, created_at, updated_at 
             FROM notes 
             WHERE id = ?1",
        )
        .map_err(|e| format!("Erro ao preparar busca de nota: {}", e))?;

    let note = stmt
        .query_row(params![id], |row| {
            let tags_raw: String = row.get(3)?;
            let is_pinned_int: i64 = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_raw).unwrap_or_default();

            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                tags,
                is_pinned: is_pinned_int != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .optional()
        .map_err(|e| format!("Erro ao buscar nota por id: {}", e))?;

    Ok(note)
}

pub fn db_save_note(conn: &Connection, note: Note) -> Result<Note, String> {
    let tags_json = serde_json::to_string(&note.tags)
        .map_err(|e| format!("Erro ao serializar tags: {}", e))?;
    let is_pinned_int = if note.is_pinned { 1 } else { 0 };

    conn.execute(
        "
        INSERT INTO notes (id, title, content, tags, is_pinned, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            tags = excluded.tags,
            is_pinned = excluded.is_pinned,
            updated_at = excluded.updated_at;
        ",
        params![
            note.id,
            note.title,
            note.content,
            tags_json,
            is_pinned_int,
            note.created_at,
            note.updated_at
        ],
    )
    .map_err(|e| format!("Erro ao salvar nota: {}", e))?;

    Ok(note)
}

pub fn db_delete_note(conn: &Connection, id: &str) -> Result<bool, String> {
    let rows_affected = conn
        .execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| format!("Erro ao excluir nota: {}", e))?;

    Ok(rows_affected > 0)
}

/// Funções de Configurações
pub fn db_get_settings(conn: &Connection) -> Result<AppSettings, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| format!("Erro ao consultar configurações: {}", e))?;

    let mut hotkey = "Ctrl+Shift+Space".to_string();
    let mut theme = "dark".to_string();
    let mut default_mode = "floating".to_string();
    let mut auto_save_interval = 500u64;

    let rows = stmt
        .query_map([], |row| {
            let k: String = row.get(0)?;
            let v: String = row.get(1)?;
            Ok((k, v))
        })
        .map_err(|e| format!("Erro ao ler configurações: {}", e))?;

    for row in rows {
        if let Ok((k, v)) = row {
            match k.as_str() {
                "hotkey" => hotkey = v,
                "theme" => theme = v,
                "default_mode" => default_mode = v,
                "auto_save_interval" => {
                    if let Ok(num) = v.parse::<u64>() {
                        auto_save_interval = num;
                    }
                }
                _ => {}
            }
        }
    }

    Ok(AppSettings {
        hotkey,
        theme,
        default_mode,
        auto_save_interval,
    })
}

pub fn db_update_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) 
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| format!("Erro ao atualizar configuração {}: {}", key, e))?;

    Ok(())
}

/// Exportação do banco de dados para caminho de destino
pub fn db_export_to(src_path: &Path, dest_path: &Path) -> Result<(), String> {
    if !src_path.exists() {
        return Err(format!(
            "Banco de dados fonte não encontrado em {:?}",
            src_path
        ));
    }

    if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "Falha ao criar diretório destino para exportação em {:?}: {}",
                    parent, e
                )
            })?;
        }
    }

    // Copia o arquivo SQLite com integridade
    fs::copy(src_path, dest_path).map_err(|e| {
        format!(
            "Falha ao copiar banco de dados de {:?} para {:?}: {}",
            src_path, dest_path, e
        )
    })?;

    Ok(())
}

/// Importação de um banco SQLite externo, substituindo o atual e reabrindo conexão
pub fn db_import_from(
    db_state: &DbState,
    import_source_path: &Path,
) -> Result<AppSettings, String> {
    if !import_source_path.exists() {
        return Err(format!(
            "Arquivo de importação não encontrado em {:?}",
            import_source_path
        ));
    }

    // Validar se o arquivo importado é um banco SQLite válido com as tabelas requeridas
    {
        let test_conn = Connection::open(import_source_path).map_err(|e| {
            format!(
                "O arquivo selecionado não é um banco SQLite válido: {}",
                e
            )
        })?;

        let has_notes: bool = test_conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='notes'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)
            .unwrap_or(false);

        if !has_notes {
            return Err("O arquivo importado não possui a estrutura de notas compatível".to_string());
        }
    }

    // Adquire o lock da conexão atual
    let mut conn_guard = db_state
        .conn
        .lock()
        .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;

    // Fecha a conexão temporariamente criando uma conexão in-memory temporária
    *conn_guard = Connection::open_in_memory()
        .map_err(|e| format!("Erro ao resetar conexão intermediária: {}", e))?;

    // Sobrescreve o arquivo ~/Documents/notas.db com o arquivo importado
    fs::copy(import_source_path, &db_state.db_path).map_err(|e| {
        format!(
            "Falha ao sobrescrever banco de dados em {:?}: {}",
            db_state.db_path, e
        )
    })?;

    // Reabre e reexecuta migrations/inits se necessário
    *conn_guard = init_db(&db_state.db_path)?;

    // Retorna as configurações atualizadas
    db_get_settings(&conn_guard)
}
