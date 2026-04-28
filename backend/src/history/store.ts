import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export interface HistoryEntry {
  id?: number;
  sessionId: string;
  tabId: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  modelId?: string;
  createdAt: number;
}

export class HistoryStore {
  private db: Database.Database;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'history.sqlite');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        tab_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model_id TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_session ON history (session_id, created_at);
    `);
  }

  append(entry: HistoryEntry): number {
    const stmt = this.db.prepare(
      'INSERT INTO history (session_id, tab_id, role, content, model_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const result = stmt.run(
      entry.sessionId,
      entry.tabId,
      entry.role,
      entry.content,
      entry.modelId ?? null,
      entry.createdAt,
    );
    return Number(result.lastInsertRowid);
  }

  forSession(sessionId: string, limit = 100): HistoryEntry[] {
    const rows = this.db
      .prepare(
        'SELECT id, session_id, tab_id, role, content, model_id, created_at FROM history WHERE session_id = ? ORDER BY created_at ASC LIMIT ?',
      )
      .all(sessionId, limit) as Array<{
      id: number;
      session_id: string;
      tab_id: number;
      role: string;
      content: string;
      model_id: string | null;
      created_at: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      tabId: r.tab_id,
      role: r.role as HistoryEntry['role'],
      content: r.content,
      modelId: r.model_id ?? undefined,
      createdAt: r.created_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}
