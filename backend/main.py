from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from loguru import logger
import structlog
import sys
import os

from app.database import connect_to_mongo, close_mongo_connection
from app.routers import equipment
from app.routers import stream
from app.middleware.logging import configure_logging, RequestLoggingMiddleware
from app.middleware.rate_limit import limiter, _rate_limit_exceeded_handler, RateLimitExceeded
from app.middleware.sentry import init_sentry

# Configure structured logging
configure_logging()
structlog_logger = structlog.get_logger()

# Keep loguru for backward compatibility during transition
logger.remove()
logger.add(sys.stdout, colorize=True, format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    sentry_enabled = init_sentry()
    if sentry_enabled:
        structlog_logger.info("sentry_initialized")
    
    structlog_logger.info("app_starting", service="voice_ai_knowledge_base")
    await connect_to_mongo()
    yield
    # Shutdown
    structlog_logger.info("app_shutting_down")
    await close_mongo_connection()


app = FastAPI(
    title="Voice AI Knowledge Base API",
    description="Production-ready voice AI system with RAG and real-time chat",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# Add rate limiting state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    origins = [origin.strip() for origin in allowed_origins_env.split(",")]
else:
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://frontend:80",  # Docker internal network
        "http://proj3-frontend:80",  # Docker container name
        "http://proj3-frontend-prod:80",  # Production container name
    ]

if os.getenv("ENVIRONMENT") == "production":
    logger.info(f"CORS configured for production with origins: {origins}")
else:
    # In development, allow all origins
    origins = ["*"]
    logger.info("CORS configured for development (allowing all origins)")

# Add request logging middleware (must be added before CORS)
app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if origins != ["*"] else False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*", "X-Trace-ID"],
)


app.include_router(equipment.router, prefix="/api/v1/equipment", tags=["Equipment"])
app.include_router(stream.router, prefix="/api/v1/stream", tags=["Stream"])

@app.get("/")
def read_root():
    return {"message": "Voice AI Knowledge Base API", "version": "1.0.0", "status": "running"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "voice_ai_knowledge_base"}


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Global exception handler with structured logging."""
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    structlog_logger.error(
        "unhandled_exception",
        trace_id=trace_id,
        error=str(exc),
        error_type=type(exc).__name__,
        path=request.url.path,
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "trace_id": trace_id,
            "message": "An unexpected error occurred. Please contact support with the trace_id."
        }
    )



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)