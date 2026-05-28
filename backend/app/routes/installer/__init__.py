from fastapi import APIRouter
from .infra import router as infra_router
from .stacks import router as stacks_router

router = APIRouter()
router.include_router(infra_router)
router.include_router(stacks_router)
