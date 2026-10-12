from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://hrms:password@localhost:5432/pharma_hrms"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # JWT
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Supabase Storage
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:9590", "https://hrms.orcalabs.in", "http://localhost:5173", "http://localhost:3000"]
    
    # App
    APP_NAME: str = "Orca Labs Pharma HRMS"
    DEBUG: bool = False

    class Config:
        env_file = "../.env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
