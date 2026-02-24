"""Sentry integration for error tracking."""
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from app.config import settings


def init_sentry():
    """
    Initialize Sentry SDK for error tracking and performance monitoring.
    
    Following official FastAPI integration pattern:
    https://docs.sentry.io/platforms/python/integrations/fastapi/
    
    Returns:
        bool: True if Sentry was initialized, False otherwise
    """
    sentry_dsn = settings.SENTRY_DSN
    
    # Only initialize if DSN is configured (not empty string)
    if sentry_dsn and sentry_dsn.startswith("https://"):
        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=settings.SENTRY_ENVIRONMENT,
            
            # Performance monitoring - sample 10% of transactions
            traces_sample_rate=0.1,
            
            # Profiling - sample 10% of profiled transactions
            profiles_sample_rate=0.1,
            
            # FastAPI integration (automatically enabled when fastapi is installed)
            integrations=[
                StarletteIntegration(transaction_style="endpoint"),
                FastApiIntegration(transaction_style="endpoint"),
            ],
            
            # Send request headers and IP for debugging (set to True in production if needed)
            send_default_pii=False,
            
            # Additional debugging options
            attach_stacktrace=True,
            max_breadcrumbs=50,
            
            # Release tracking (optional - can use git commit hash)
            # release="your-app@1.0.0",
            
            # Error sampling - capture all errors (adjust if needed)
            sample_rate=1.0,
        )
        return True
    return False
