"""Application error type and FastAPI exception handlers with safe responses."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("backend.errors")


class APIError(Exception):
    """Raise anywhere in the service layer; converted to a structured JSON error."""

    def __init__(self, status_code: int, code: str, message: str, details: Any | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details

    def body(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "details": self.details}


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def _api_error(request: Request, exc: APIError) -> JSONResponse:
        logger.warning("api_error", extra={"code": exc.code, "status": exc.status_code, "path": request.url.path, "request_id": _request_id(request)})
        return JSONResponse(status_code=exc.status_code, content={"error": exc.body(), "request_id": _request_id(request)})

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {"code": "validation_error", "message": "Request validation failed", "details": exc.errors()},
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {404: "not_found", 405: "method_not_allowed", 413: "payload_too_large", 401: "unauthorized", 403: "forbidden", 429: "rate_limited"}.get(
            exc.status_code, "http_error"
        )
        return JSONResponse(
            status_code=exc.status_code, content={"error": {"code": code, "message": str(exc.detail), "details": None}, "request_id": _request_id(request)}
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", extra={"path": request.url.path, "request_id": _request_id(request)})
        return JSONResponse(
            status_code=500,
            content={
                "error": {"code": "internal_error", "message": "An unexpected error occurred. Check server logs with the request id.", "details": None},
                "request_id": _request_id(request),
            },
        )
