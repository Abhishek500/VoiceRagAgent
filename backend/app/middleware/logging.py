"""Structured logging middleware with correlation IDs."""
import uuid
import time
import logging
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


logger = structlog.get_logger()


def configure_logging():
    """Configure structlog for JSON structured logging."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        # structlog.stdlib.INFO does not exist; use stdlib logging levels
        wrapper_class=structlog.make_filtering_bound_logger(min_level=logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=False,
    )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to add correlation IDs and log all requests."""
    
    async def dispatch(self, request: Request, call_next):
        # Generate correlation ID
        trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
        
        # Bind trace_id to context for all logs in this request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)
        
        # Store trace_id in request state for exception handlers
        request.state.trace_id = trace_id
        
        start_time = time.time()
        
        # Log incoming request
        logger.info(
            "request_started",
            method=request.method,
            path=request.url.path,
            client_host=request.client.host if request.client else None,
        )
        
        try:
            response: Response = await call_next(request)
            
            duration = time.time() - start_time
            
            # Log response
            logger.info(
                "request_completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration * 1000, 2),
            )
            
            # Add trace_id to response headers
            response.headers["X-Trace-ID"] = trace_id
            
            return response
            
        except Exception as exc:
            duration = time.time() - start_time
            
            logger.error(
                "request_failed",
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration * 1000, 2),
                error=str(exc),
                error_type=type(exc).__name__,
            )
            raise
