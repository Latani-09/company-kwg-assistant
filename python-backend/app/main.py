from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin_users, auth, chat, gaps, knowledge, sectors

app = FastAPI(title="Company Knowledge Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(sectors.router, prefix="/api/v1")
app.include_router(admin_users.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(gaps.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
