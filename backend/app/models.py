from typing import Literal

from pydantic import BaseModel, Field


Role = Literal["customer_service", "operator", "admin"]
KnowledgeStatus = Literal["enabled", "disabled"]
AnswerStatus = Literal["answered", "fallback", "manual_confirm"]
BadCaseType = Literal["knowledge_missing", "retrieval_failed", "hallucination", "rule_conflict", "out_of_scope", ""]
BadCaseStatus = Literal["pending", "processing", "fixed"]


class LoginRequest(BaseModel):
    username: str
    password: str
    role: Role | None = None


class User(BaseModel):
    id: str
    username: str
    display_name: str
    role: Role


class LoginResponse(BaseModel):
    token: str
    user: User


class KnowledgeBase(BaseModel):
    title: str
    category: str
    content: str
    keywords: list[str] = Field(default_factory=list)
    source: str
    status: KnowledgeStatus = "enabled"


class Knowledge(KnowledgeBase):
    id: str
    updated_at: str


class ChatRequest(BaseModel):
    question: str
    user_id: str | None = None
    role: Role | None = None


class Citation(BaseModel):
    id: str
    title: str
    category: str
    source: str
    snippet: str
    score: float


class ChatResponse(BaseModel):
    session_id: str
    answer_status: AnswerStatus
    answer: str
    confidence: float
    citations: list[Citation]
    suggested_actions: list[str]
    risk_flags: list[str]
    response_time_ms: int


class SessionLog(BaseModel):
    id: str
    question: str
    answer: str
    answer_status: AnswerStatus
    confidence: float
    hit_documents: list[str]
    transferred_to_human: bool = False
    user_feedback: str | None = None
    created_at: str
    response_time_ms: int
    user_id: str | None = None
    role: Role | None = None


class BadCaseBase(BaseModel):
    session_id: str | None = None
    question: str
    answer: str | None = None
    type: BadCaseType = ""
    status: BadCaseStatus = "pending"
    suggestion: str = ""


class BadCase(BadCaseBase):
    id: str
    confidence: float | None = None
    hit_documents: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class MetricCard(BaseModel):
    key: str
    label: str
    value: str
    helper: str
    trend: str


class MetricsResponse(BaseModel):
    cards: list[MetricCard]
