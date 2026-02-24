from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB Settings
    MONGO_URL: str
    DB_NAME: str = "live_db"

    DEEPGRAM_API_KEY: str
    GROQ_API_KEY: str
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "pNInz6obpgDQGcFmaJgB"

    GROQ_MODEL: str = "openai/gpt-oss-20b"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    GOOGLE_API_KEY: str
    EMBEDDING_MODEL: str = "models/text-embedding-004"
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 250
    VECTOR_INDEX_NAME: str = "vector_index"
    DOCUMENT_CHUNKS_COLLECTION: str = "document_chunks"
    TENANT_ID: str = "mvp_tenant"

    #Hard Coded
    USER_ID: str = "mvp_user"
    
    # Google API version settings
    GOOGLE_GENAI_USE_VERSIONED_ENDPOINT: str = "true"
    GOOGLE_API_VERSION: str = "v1"
    
    # Error Tracking
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_UPLOADS: int = 10  # requests per minute
    RATE_LIMIT_RETRIEVAL: int = 100  # requests per minute
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()