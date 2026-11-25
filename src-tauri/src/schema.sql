-- Sapphire CRM SQLite schema
-- All tables use TEXT UUIDs for primary keys and ISO-8601 strings for timestamps.

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- Companies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    website             TEXT,
    sector              TEXT,
    size                TEXT,                      -- Micro-entreprise / PME / ETI / Grande entreprise
    number_of_employees INTEGER,
    description         TEXT,
    priority            INTEGER CHECK (priority IS NULL OR (priority BETWEEN 1 AND 5)),
    parent_company_id   TEXT REFERENCES companies(id) ON DELETE SET NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companies_name    ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_sector  ON companies(sector);
CREATE INDEX IF NOT EXISTS idx_companies_size    ON companies(size);
CREATE INDEX IF NOT EXISTS idx_companies_parent  ON companies(parent_company_id);

-- ----------------------------------------------------------------------------
-- Persons
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS persons (
    id                      TEXT PRIMARY KEY,
    first_name              TEXT NOT NULL,
    last_name               TEXT NOT NULL,
    department              TEXT,
    role                    TEXT,
    mobile_phone            TEXT,
    professional_email      TEXT,
    other_emails            TEXT,                  -- JSON array
    additional_information  TEXT,
    circle_of_relation      INTEGER CHECK (circle_of_relation IS NULL OR (circle_of_relation BETWEEN 1 AND 4)),
    current_company_id      TEXT REFERENCES companies(id) ON DELETE SET NULL,
    primary_source_id       TEXT REFERENCES persons(id)   ON DELETE SET NULL,
    direct_manager_id       TEXT REFERENCES persons(id)   ON DELETE SET NULL,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_persons_last_name      ON persons(last_name);
CREATE INDEX IF NOT EXISTS idx_persons_company        ON persons(current_company_id);
CREATE INDEX IF NOT EXISTS idx_persons_primary_src    ON persons(primary_source_id);
CREATE INDEX IF NOT EXISTS idx_persons_direct_mgr     ON persons(direct_manager_id);
CREATE INDEX IF NOT EXISTS idx_persons_circle         ON persons(circle_of_relation);

-- Secondary sources : many-to-many self-relation on persons
CREATE TABLE IF NOT EXISTS person_secondary_sources (
    person_id   TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    source_id   TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, source_id),
    CHECK (person_id <> source_id)
);

CREATE INDEX IF NOT EXISTS idx_pss_source ON person_secondary_sources(source_id);

-- ----------------------------------------------------------------------------
-- Projects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'Active',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_name   ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Projects <-> Companies : many-to-many
CREATE TABLE IF NOT EXISTS project_companies (
    project_id TEXT NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_pc_company ON project_companies(company_id);

-- ----------------------------------------------------------------------------
-- Actions
-- ----------------------------------------------------------------------------
-- The initiator of an action is always the CRM's user (stored in the
-- `settings` table under the `current_user` key), so there is no column for it.
CREATE TABLE IF NOT EXISTS actions (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'to do', -- to do / in progress / done
    preparation     TEXT,
    conclusion      TEXT,
    scheduled_date  TEXT NOT NULL,
    completed_date  TEXT,
    discussion_type TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_actions_status    ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_scheduled ON actions(scheduled_date);

-- Actions <-> Persons (toPersons) : many-to-many
CREATE TABLE IF NOT EXISTS action_to_persons (
    action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    PRIMARY KEY (action_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_atp_person ON action_to_persons(person_id);

-- ----------------------------------------------------------------------------
-- Key/value settings (backup path, UI prefs, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- Tags
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT,                  -- hex color string e.g. "#6366f1"
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Tags <-> Persons : many-to-many
CREATE TABLE IF NOT EXISTS person_tags (
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    tag_id    TEXT NOT NULL REFERENCES tags(id)    ON DELETE CASCADE,
    PRIMARY KEY (person_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_person_tags_tag ON person_tags(tag_id);

-- Tags <-> Companies : many-to-many
CREATE TABLE IF NOT EXISTS company_tags (
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tag_id     TEXT NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
    PRIMARY KEY (company_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_company_tags_tag ON company_tags(tag_id);

-- ----------------------------------------------------------------------------
-- Notes (free markdown notes per entity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,   -- 'person' | 'company' | 'action' | 'project'
    entity_id   TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- Attachments (files copied locally)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,   -- 'person' | 'company' | 'action' | 'project'
    entity_id   TEXT NOT NULL,
    file_name   TEXT NOT NULL,   -- original file name shown in UI
    stored_path TEXT NOT NULL,   -- absolute path inside app data dir
    mime_type   TEXT,
    size_bytes  INTEGER,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
