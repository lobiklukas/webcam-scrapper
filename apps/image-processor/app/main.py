from datetime import UTC, datetime

from fastapi import FastAPI
from pydantic import BaseModel

STARTED_AT = datetime.now(UTC)


class HealthResponse(BaseModel):
    status: str
    uptime: int
    timestamp: datetime


def create_app() -> FastAPI:
    app = FastAPI(title='image-processor', version='0.0.0')

    @app.get('/health')
    def health() -> HealthResponse:
        now = datetime.now(UTC)
        return HealthResponse(
            status='ok',
            uptime=int((now - STARTED_AT).total_seconds()),
            timestamp=now,
        )

    return app


app = create_app()
