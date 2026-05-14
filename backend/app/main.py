from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import BadCaseBase, ChatRequest, KnowledgeBase, LoginRequest, LoginResponse, MetricsResponse, User
from .rag import answer_question
from .storage import (
    create_badcase,
    create_knowledge,
    ensure_data_files,
    list_badcases,
    list_knowledge,
    list_sessions,
    mark_session_transferred,
    update_badcase,
    update_knowledge,
)


MOCK_USERS = {
    "cs01": {"id": "user_cs01", "username": "cs01", "password": "123456", "display_name": "客服小卓", "role": "customer_service"},
    "ops01": {"id": "user_ops01", "username": "ops01", "password": "123456", "display_name": "运营小尔", "role": "operator"},
    "admin": {"id": "user_admin", "username": "admin", "password": "123456", "display_name": "管理员", "role": "admin"},
}

app = FastAPI(title="卓尔智联 AI 问答助手 Demo", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    # Demo deployment allows any Vercel preview/frontend origin.
    # Production should replace "*" with the exact deployed frontend domain.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    ensure_data_files()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "zall-ai-assistant-demo"}


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    user = MOCK_USERS.get(payload.username)
    if not user or user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if payload.role and payload.role != user["role"]:
        raise HTTPException(status_code=403, detail="账号角色与所选角色不一致")
    safe_user = User(
        id=user["id"],
        username=user["username"],
        display_name=user["display_name"],
        role=user["role"],
    )
    return LoginResponse(token=f"mock-token-{safe_user.id}", user=safe_user)


@app.post("/api/chat")
def chat(payload: ChatRequest):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="问题不能为空")
    return answer_question(question=question, user_id=payload.user_id, role=payload.role)


@app.get("/api/knowledge")
def get_knowledge():
    return list_knowledge()


@app.post("/api/knowledge")
def post_knowledge(payload: KnowledgeBase):
    return create_knowledge(payload)


@app.put("/api/knowledge/{knowledge_id}")
def put_knowledge(knowledge_id: str, payload: KnowledgeBase):
    updated = update_knowledge(knowledge_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="知识不存在")
    return updated


@app.get("/api/sessions")
def get_sessions():
    return list_sessions()


@app.post("/api/sessions/{session_id}/transfer")
def transfer_session(session_id: str):
    updated = mark_session_transferred(session_id)
    if not updated:
        raise HTTPException(status_code=404, detail="会话不存在")
    return updated


@app.get("/api/badcases")
def get_badcases():
    return list_badcases()


@app.post("/api/badcases")
def post_badcase(payload: BadCaseBase):
    confidence = None
    hit_documents = []
    if payload.session_id:
        session = next((item for item in list_sessions() if item.id == payload.session_id), None)
        if session:
            confidence = session.confidence
            hit_documents = session.hit_documents
    return create_badcase(payload, confidence=confidence, hit_documents=hit_documents)


@app.put("/api/badcases/{case_id}")
def put_badcase(case_id: str, payload: BadCaseBase):
    updated = update_badcase(case_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Bad Case 不存在")
    return updated


@app.get("/api/metrics", response_model=MetricsResponse)
def get_metrics() -> MetricsResponse:
    sessions = list_sessions()
    badcases = list_badcases()
    total = len(sessions)
    answered = len([item for item in sessions if item.answer_status == "answered" and not item.transferred_to_human])
    transferred = len([item for item in sessions if item.transferred_to_human or item.answer_status == "manual_confirm"])
    hit = len([item for item in sessions if item.hit_documents])
    avg_ms = int(sum(item.response_time_ms for item in sessions) / total) if total else 126
    fixed_badcases = len([item for item in badcases if item.status == "fixed"])
    solved_rate = answered / total if total else 0.78
    transfer_rate = transferred / total if total else 0.14
    hit_rate = hit / total if total else 0.86
    closure_rate = fixed_badcases / len(badcases) if badcases else 0.62
    satisfaction = _satisfaction(sessions)

    return MetricsResponse(
        cards=[
            {"key": "total_questions", "label": "总提问数", "value": str(total or 128), "helper": "来自会话日志", "trend": "+12.4%"},
            {"key": "ai_resolution_rate", "label": "AI 独立解决率", "value": _pct(solved_rate), "helper": "answered 且未转人工", "trend": "+4.1%"},
            {"key": "human_transfer_rate", "label": "人工转接率", "value": _pct(transfer_rate), "helper": "含高风险人工确认", "trend": "-2.8%"},
            {"key": "knowledge_hit_rate", "label": "知识命中率", "value": _pct(hit_rate), "helper": "至少命中 1 篇知识", "trend": "+3.2%"},
            {"key": "avg_response_time", "label": "平均响应时间", "value": f"{avg_ms} ms", "helper": "后端 Mock 响应耗时", "trend": "-18 ms"},
            {"key": "badcase_count", "label": "Bad Case 数", "value": str(len(badcases) or 9), "helper": "人工标记问题", "trend": "+1"},
            {"key": "badcase_closure_rate", "label": "Bad Case 闭环率", "value": _pct(closure_rate), "helper": "状态为已修复", "trend": "+6.7%"},
            {"key": "user_satisfaction", "label": "用户满意度", "value": _pct(satisfaction), "helper": "基于反馈估算", "trend": "+2.5%"},
        ]
    )


def _pct(value: float) -> str:
    return f"{round(value * 100, 1)}%"


def _satisfaction(sessions) -> float:
    if not sessions:
        return 0.88
    bad = len([item for item in sessions if item.user_feedback == "bad_case"])
    return max(0.35, 1 - bad / max(len(sessions), 1))
