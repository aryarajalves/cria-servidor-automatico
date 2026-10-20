from fastapi import APIRouter
from .infra import router as infra_router
from .stacks import router as stacks_router
from .auto_setup import router as auto_setup_router

router = APIRouter()
router.include_router(infra_router)
router.include_router(stacks_router)
router.include_router(auto_setup_router)
