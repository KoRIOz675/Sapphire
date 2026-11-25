use serde::{Deserialize, Serialize};

// ============================================================================
// Person
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub department: Option<String>,
    pub role: Option<String>,
    pub mobile_phone: Option<String>,
    pub professional_email: Option<String>,
    pub other_emails: Vec<String>,
    pub additional_information: Option<String>,
    pub circle_of_relation: Option<i32>,
    pub birthday: Option<String>,
    pub current_company_id: Option<String>,
    pub primary_source_id: Option<String>,
    pub direct_manager_id: Option<String>,
    pub secondary_source_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersonInput {
    #[serde(default)]
    pub first_name: String,
    #[serde(default)]
    pub last_name: String,
    pub department: Option<String>,
    pub role: Option<String>,
    pub mobile_phone: Option<String>,
    pub professional_email: Option<String>,
    #[serde(default)]
    pub other_emails: Vec<String>,
    pub additional_information: Option<String>,
    pub circle_of_relation: Option<i32>,
    pub birthday: Option<String>,
    pub current_company_id: Option<String>,
    pub primary_source_id: Option<String>,
    pub direct_manager_id: Option<String>,
    #[serde(default)]
    pub secondary_source_ids: Vec<String>,
}

// ============================================================================
// Company
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    pub id: String,
    pub name: String,
    pub website: Option<String>,
    pub sector: Option<String>,
    pub size: Option<String>,
    pub number_of_employees: Option<i64>,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub parent_company_id: Option<String>,
    pub project_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CompanyInput {
    #[serde(default)]
    pub name: String,
    pub website: Option<String>,
    pub sector: Option<String>,
    pub size: Option<String>,
    pub number_of_employees: Option<i64>,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub parent_company_id: Option<String>,
    #[serde(default)]
    pub project_ids: Vec<String>,
}

// ============================================================================
// Action
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    pub id: String,
    pub title: String,
    pub status: String,
    pub preparation: Option<String>,
    pub conclusion: Option<String>,
    pub scheduled_date: String,
    pub completed_date: Option<String>,
    pub discussion_type: Option<String>,
    pub to_person_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ActionInput {
    #[serde(default)]
    pub title: String,
    #[serde(default = "default_action_status")]
    pub status: String,
    pub preparation: Option<String>,
    pub conclusion: Option<String>,
    #[serde(default)]
    pub scheduled_date: String,
    pub completed_date: Option<String>,
    pub discussion_type: Option<String>,
    #[serde(default)]
    pub to_person_ids: Vec<String>,
}

fn default_action_status() -> String {
    "to do".to_string()
}

// ============================================================================
// Project
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub company_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    #[serde(default)]
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "default_project_status")]
    pub status: String,
    #[serde(default)]
    pub company_ids: Vec<String>,
}

fn default_project_status() -> String {
    "Active".to_string()
}

// ============================================================================
// Dashboard stats
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub persons_count: i64,
    pub companies_count: i64,
    pub actions_count: i64,
    pub projects_count: i64,
    /// Key : circle 1..4, Value : count
    pub circle_counts: [i64; 4],
    pub overdue_actions: Vec<Action>,
    pub upcoming_actions: Vec<Action>,
    pub stale_contacts_count: i64,
    pub overdue_actions_count: i64,
}

// ============================================================================
// Tag
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TagInput {
    #[serde(default)]
    pub name: String,
    pub color: Option<String>,
}

// ============================================================================
// Note
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NoteInput {
    pub entity_type: String,
    pub entity_id: String,
    #[serde(default)]
    pub content: String,
}

// ============================================================================
// Attachment
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub file_name: String,
    pub stored_path: String,
    pub mime_type: Option<String>,
    pub size_bytes: Option<i64>,
    pub created_at: String,
}

// ============================================================================
// Import / export full dump
// ============================================================================

/// Current dump format. Version 1 had no tags or notes; files in that format
/// still import, and leave the existing tags and notes untouched.
pub const DUMP_VERSION: u32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FullDump {
    pub persons: Vec<Person>,
    pub companies: Vec<Company>,
    pub actions: Vec<Action>,
    pub projects: Vec<Project>,
    #[serde(default)]
    pub tags: Vec<Tag>,
    /// person id -> tag ids
    #[serde(default)]
    pub person_tag_ids: std::collections::HashMap<String, Vec<String>>,
    /// company id -> tag ids
    #[serde(default)]
    pub company_tag_ids: std::collections::HashMap<String, Vec<String>>,
    #[serde(default)]
    pub notes: Vec<Note>,
    pub version: u32,
}
