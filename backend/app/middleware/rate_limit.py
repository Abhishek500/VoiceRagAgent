"""Rate limiting middleware using slowapi."""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request


def get_client_identifier(request: Request) -> str:
    """
    Get client identifier for rate limiting.
    Uses X-Forwarded-For if behind proxy, otherwise remote address.
    Can be extended to use user ID from JWT token.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0]
    return get_remote_address(request)


# Initialize limiter
limiter = Limiter(
    key_func=get_client_identifier,
    default_limits=["100/minute"],
    storage_uri="memory://",  # Use Redis in production: "redis://localhost:6379"
)


# Export for use in main.py
__all__ = ["limiter", "_rate_limit_exceeded_handler", "RateLimitExceeded"]
