from fastapi import APIRouter

from app.modules.accounts.router import router as accounts_router
from app.modules.practice.router import router as practice_router
from app.modules.sharing.router import router as sharing_router
from app.modules.telemetry.router import router as telemetry_router


api_router = APIRouter()
api_router.include_router(accounts_router)
api_router.include_router(practice_router)
api_router.include_router(sharing_router)
api_router.include_router(telemetry_router)
