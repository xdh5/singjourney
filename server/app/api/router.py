from fastapi import APIRouter

from app.modules.sharing.router import router as sharing_router


api_router = APIRouter()
api_router.include_router(sharing_router)
