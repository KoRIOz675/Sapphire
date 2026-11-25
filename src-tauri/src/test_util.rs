//! Helpers shared by unit tests.

use rusqlite::Connection;

/// A fresh, fully migrated in-memory database.
pub fn memory_db() -> Connection {
    crate::db::open_and_migrate(std::path::Path::new(":memory:")).expect("open in-memory db")
}
