from fastapi import APIRouter

from app.api.client_config import router as client_config_router
from app.modules.sharing.router import router as sharing_router


api_router = APIRouter()
api_router.include_router(client_config_router)
api_router.include_router(sharing_router)
