use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("launchctl error: {0}")]
    Launchctl(String),

    #[error("plist error: {0}")]
    Plist(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("file not found: {0}")]
    NotFound(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
