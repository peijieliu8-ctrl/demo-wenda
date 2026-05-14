import re
import time

from .models import ChatResponse, Citation, Knowledge, SessionLog
from .storage import create_session, list_knowledge, new_id, now_iso


HIGH_RISK_RULES = {
    "订单实时查询": ["订单现在", "订单到哪", "订单状态", "订单查询", "现在到哪里"],
    "物流实时查询": ["物流", "快递", "运单", "配送轨迹", "到哪里了"],
    "赔付承诺": ["赔偿", "赔付", "补偿", "承诺", "500元", "500 元"],
    "退款审批": ["退款审批", "退款审核", "直接退款", "审批通过", "审核通过"],
}

FALLBACK_ANSWER = (
    "当前问题没有命中足够明确的知识依据。建议先补充订单状态、商品类型、凭证材料或具体规则场景；"
    "如涉及用户权益、金额承诺或实时状态，请转人工确认。"
)


def answer_question(question: str, user_id: str | None, role: str | None) -> ChatResponse:
    started_at = time.perf_counter()
    normalized = _normalize(question)
    risk_flags = _detect_risks(normalized)
    matches = _retrieve(normalized)
    citations = [
        Citation(
            id=item["knowledge"].id,
            title=item["knowledge"].title,
            category=item["knowledge"].category,
            source=item["knowledge"].source,
            snippet=_snippet(item["knowledge"].content, normalized),
            score=round(item["score"], 2),
        )
        for item in matches[:3]
    ]
    top_score = matches[0]["score"] if matches else 0
    confidence = _confidence(top_score, bool(citations), bool(risk_flags))

    if risk_flags:
        status = "manual_confirm"
        answer = _manual_answer(question, citations, risk_flags)
        actions = ["转人工确认", "补充订单/凭证信息", "记录风险点"]
    elif confidence >= 0.58 and citations:
        status = "answered"
        answer = _grounded_answer(question, citations)
        actions = ["按引用规则回复客户", "引导客户补充凭证", "必要时创建售后工单"]
    else:
        status = "fallback"
        answer = FALLBACK_ANSWER
        actions = ["转人工", "补充知识库", "标记 bad case"]

    response_time_ms = max(80, int((time.perf_counter() - started_at) * 1000) + 120)
    session = SessionLog(
        id=new_id("sess"),
        question=question,
        answer=answer,
        answer_status=status,
        confidence=confidence,
        hit_documents=[citation.title for citation in citations],
        transferred_to_human=status == "manual_confirm",
        user_feedback=None,
        created_at=now_iso(),
        response_time_ms=response_time_ms,
        user_id=user_id,
        role=role,
    )
    create_session(session)

    return ChatResponse(
        session_id=session.id,
        answer_status=status,
        answer=answer,
        confidence=confidence,
        citations=citations,
        suggested_actions=actions,
        risk_flags=risk_flags,
        response_time_ms=response_time_ms,
    )


def _normalize(text: str) -> str:
    return re.sub(r"\s+", "", text.lower())


def _detect_risks(question: str) -> list[str]:
    flags = []
    for label, words in HIGH_RISK_RULES.items():
        if any(word.lower().replace(" ", "") in question for word in words):
            flags.append(label)
    return flags


def _retrieve(question: str) -> list[dict]:
    rows = [item for item in list_knowledge() if item.status == "enabled"]
    scored = []
    for item in rows:
        score = _score_knowledge(question, item)
        if score > 0:
            scored.append({"knowledge": item, "score": score})
    return sorted(scored, key=lambda row: row["score"], reverse=True)


def _score_knowledge(question: str, item: Knowledge) -> float:
    score = 0.0
    title = _normalize(item.title)
    category = _normalize(item.category)
    content = _normalize(item.content)
    if title and title in question:
        score += 4
    if category and category in question:
        score += 2
    for keyword in item.keywords:
        key = _normalize(keyword)
        if not key:
            continue
        if key in question:
            score += 3
        elif len(key) >= 2 and key in content and _soft_overlap(key, question):
            score += 0.8
    for token in _question_tokens(question):
        if len(token) >= 2 and token in content:
            score += 0.6
    return score


def _question_tokens(question: str) -> list[str]:
    separators = r"[，。！？、,.!?;；:：()（）【】\[\]\"']"
    return [token for token in re.split(separators, question) if token]


def _soft_overlap(keyword: str, question: str) -> bool:
    if len(keyword) < 2:
        return False
    chars = set(keyword)
    return len(chars.intersection(set(question))) / max(len(chars), 1) >= 0.6


def _confidence(score: float, has_citation: bool, has_risk: bool) -> float:
    if not has_citation:
        return 0.24
    base = 0.42 if has_risk else 0.46
    value = min(0.94, base + score / 18)
    return round(value, 2)


def _snippet(content: str, question: str) -> str:
    clean = content.strip()
    if len(clean) <= 120:
        return clean
    for marker in ["。", "；", ";"]:
        sentences = [part.strip() for part in clean.split(marker) if part.strip()]
        for sentence in sentences:
            if any(char in sentence for char in question[:20]):
                return sentence[:120]
    return clean[:120]


def _grounded_answer(question: str, citations: list[Citation]) -> str:
    primary = citations[0]
    return (
        f"根据《{primary.title}》，该问题可按现有规则处理：{primary.snippet}。"
        "建议回复时说明规则依据，并先收集必要材料；涉及金额、审批或实时状态时仍需人工复核。"
    )


def _manual_answer(question: str, citations: list[Citation], risk_flags: list[str]) -> str:
    evidence = f"已参考《{citations[0].title}》。" if citations else "当前没有稳定知识依据。"
    risks = "、".join(risk_flags)
    return (
        f"该问题涉及{risks}，不建议由 AI 直接给出最终结论或承诺。"
        f"{evidence}请转人工核验实时数据、审批权限或赔付边界后再回复客户。"
    )
