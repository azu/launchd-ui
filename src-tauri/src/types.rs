use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobSource {
    UserAgent,
    SystemAgent,
    SystemDaemon,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    Running,
    Loaded,
    Unloaded,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobListEntry {
    pub label: String,
    pub pid: Option<u32>,
    pub last_exit_code: Option<i32>,
    pub plist_path: String,
    pub source: JobSource,
    pub status: JobStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarInterval {
    pub minute: Option<u32>,
    pub hour: Option<u32>,
    pub day: Option<u32>,
    pub weekday: Option<u32>,
    pub month: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlistConfig {
    pub label: String,
    pub program: Option<String>,
    pub program_arguments: Option<Vec<String>>,
    pub run_at_load: Option<bool>,
    pub keep_alive: Option<bool>,
    pub start_interval: Option<u64>,
    pub start_calendar_interval: Option<Vec<CalendarInterval>>,
    pub standard_out_path: Option<String>,
    pub standard_error_path: Option<String>,
    pub working_directory: Option<String>,
    pub environment_variables: Option<HashMap<String, String>>,
    pub disabled: Option<bool>,
    pub raw_xml: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchdJob {
    pub label: String,
    pub plist_path: String,
    pub source: JobSource,
    pub status: JobStatus,
    pub pid: Option<u32>,
    pub last_exit_code: Option<i32>,
    pub plist: PlistConfig,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_job_source_serialization() {
        let source = JobSource::UserAgent;
        let json = serde_json::to_string(&source).unwrap();
        assert_eq!(json, "\"UserAgent\"");

        let deserialized: JobSource = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, JobSource::UserAgent);
    }

    #[test]
    fn test_job_status_serialization() {
        let status = JobStatus::Running;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"Running\"");
    }

    #[test]
    fn test_job_list_entry_roundtrip() {
        let entry = JobListEntry {
            label: "com.example.test".to_string(),
            pid: Some(1234),
            last_exit_code: Some(0),
            plist_path: "/Users/test/Library/LaunchAgents/com.example.test.plist".to_string(),
            source: JobSource::UserAgent,
            status: JobStatus::Running,
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: JobListEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.label, "com.example.test");
        assert_eq!(deserialized.pid, Some(1234));
    }
}
