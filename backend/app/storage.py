import json
from datetime import datetime
from pathlib import Path
from threading import Lock
from uuid import uuid4

from .models import BadCase, BadCaseBase, Knowledge, KnowledgeBase, SessionLog


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
KNOWLEDGE_FILE = DATA_DIR / "knowledge.json"
SESSIONS_FILE = DATA_DIR / "sessions.json"
BADCASES_FILE = DATA_DIR / "badcases.json"

_LOCK = Lock()


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"


def _read_json(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)


def ensure_data_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not KNOWLEDGE_FILE.exists():
        _write_json(KNOWLEDGE_FILE, _seed_knowledge())
    if not SESSIONS_FILE.exists():
        _write_json(SESSIONS_FILE, [])
    if not BADCASES_FILE.exists():
        _write_json(BADCASES_FILE, [])


def list_knowledge() -> list[Knowledge]:
    ensure_data_files()
    return [Knowledge(**item) for item in _read_json(KNOWLEDGE_FILE, [])]


def create_knowledge(payload: KnowledgeBase) -> Knowledge:
    ensure_data_files()
    with _LOCK:
        rows = _read_json(KNOWLEDGE_FILE, [])
        item = Knowledge(id=new_id("kb"), updated_at=now_iso(), **payload.model_dump())
        rows.insert(0, item.model_dump())
        _write_json(KNOWLEDGE_FILE, rows)
        return item


def update_knowledge(knowledge_id: str, payload: KnowledgeBase) -> Knowledge | None:
    ensure_data_files()
    with _LOCK:
        rows = _read_json(KNOWLEDGE_FILE, [])
        for index, item in enumerate(rows):
            if item["id"] == knowledge_id:
                updated = Knowledge(id=knowledge_id, updated_at=now_iso(), **payload.model_dump())
                rows[index] = updated.model_dump()
                _write_json(KNOWLEDGE_FILE, rows)
                return updated
    return None


def list_sessions() -> list[SessionLog]:
    ensure_data_files()
    rows = _read_json(SESSIONS_FILE, [])
    return [SessionLog(**item) for item in sorted(rows, key=lambda row: row["created_at"], reverse=True)]


def create_session(payload: SessionLog) -> SessionLog:
    ensure_data_files()
    with _LOCK:
        rows = _read_json(SESSIONS_FILE, [])
        rows.insert(0, payload.model_dump())
        _write_json(SESSIONS_FILE, rows)
    return payload


def mark_session_transferred(session_id: str) -> SessionLog | None:
    ensure_data_files()
    with _LOCK:
        rows = _read_json(SESSIONS_FILE, [])
        for index, item in enumerate(rows):
            if item["id"] == session_id:
                item["transferred_to_human"] = True
                rows[index] = item
                _write_json(SESSIONS_FILE, rows)
                return SessionLog(**item)
    return None


def update_session_feedback(session_id: str, feedback: str) -> None:
    ensure_data_files()
    with _LOCK:
        rows = _read_json(SESSIONS_FILE, [])
        changed = False
        for item in rows:
            if item["id"] == session_id:
                item["user_feedback"] = feedback
                changed = True
                break
        if changed:
            _write_json(SESSIONS_FILE, rows)


def list_badcases() -> list[BadCase]:
    ensure_data_files()
    rows = _read_json(BADCASES_FILE, [])
    return [BadCase(**item) for item in sorted(rows, key=lambda row: row["created_at"], reverse=True)]


def create_badcase(payload: BadCaseBase, confidence: float | None = None, hit_documents: list[str] | None = None) -> BadCase:
    ensure_data_files()
    timestamp = now_iso()
    item = BadCase(
        id=new_id("bad"),
        created_at=timestamp,
        updated_at=timestamp,
        confidence=confidence,
        hit_documents=hit_documents or [],
        **payload.model_dump(),
    )
    with _LOCK:
        rows = _read_json(BADCASES_FILE, [])
        rows.insert(0, item.model_dump())
        _write_json(BADCASES_FILE, rows)
    if payload.session_id:
        update_session_feedback(payload.session_id, "bad_case")
    return item


def update_badcase(case_id: str, payload: BadCaseBase) -> BadCase | None:
    ensure_data_files()
    with _LOCK:
        rows = _read_json(BADCASES_FILE, [])
        for index, item in enumerate(rows):
            if item["id"] == case_id:
                updated = BadCase(
                    id=case_id,
                    created_at=item["created_at"],
                    updated_at=now_iso(),
                    confidence=item.get("confidence"),
                    hit_documents=item.get("hit_documents", []),
                    **payload.model_dump(),
                )
                rows[index] = updated.model_dump()
                _write_json(BADCASES_FILE, rows)
                return updated
    return None


def _seed_knowledge() -> list[dict]:
    timestamp = now_iso()
    return [
        {
            "id": "kb_fresh_after_sale",
            "title": "生鲜商品售后规则",
            "category": "售后规则",
            "content": "生鲜商品签收后如发现腐坏、少件、明显质量问题，用户需在签收后24小时内提交图片或视频凭证。客服可先引导用户补充凭证，再按平台售后规则发起审核。非质量问题、超时提交或无法提供有效凭证时，不直接承诺退款。",
            "keywords": ["生鲜", "售后", "签收", "腐坏", "少件", "质量问题", "凭证", "退款"],
            "source": "售后规则手册 V1.0",
            "status": "enabled",
            "updated_at": timestamp,
        },
        {
            "id": "kb_package_damage",
            "title": "包装破损处理流程",
            "category": "售后流程",
            "content": "客户签收后发现包装破损，应先收集外包装、面单、商品状态照片。如商品未受影响，可解释并记录；如影响商品使用或存在污染风险，按售后流程创建工单并提交凭证。涉及赔偿金额需人工复核，不由 AI 直接承诺。",
            "keywords": ["包装", "破损", "签收", "照片", "面单", "工单", "赔偿", "人工复核"],
            "source": "客服 SOP-包装异常",
            "status": "enabled",
            "updated_at": timestamp,
        },
        {
            "id": "kb_invoice_change",
            "title": "开票信息修改规则",
            "category": "财务规则",
            "content": "发票未开具前，用户可修改抬头、税号、邮箱等开票信息；发票已开具后，需要按财务规则提交红冲或重开申请。涉及企业税号、发票类型变更时，客服应核对订单主体和申请材料。",
            "keywords": ["开票", "发票", "抬头", "税号", "邮箱", "红冲", "重开"],
            "source": "财务开票规则 V2.1",
            "status": "enabled",
            "updated_at": timestamp,
        },
        {
            "id": "kb_platform_trade_rule",
            "title": "平台交易规则",
            "category": "平台规则",
            "content": "平台交易规则覆盖商家入驻、保证金、订单履约、售后处理和违规处置。保证金用于保障交易履约和售后责任，具体金额、冻结、扣罚和退回需以商家后台展示及平台协议为准。",
            "keywords": ["平台", "交易规则", "保证金", "入驻", "履约", "扣罚", "协议"],
            "source": "平台交易规则摘要",
            "status": "enabled",
            "updated_at": timestamp,
        },
        {
            "id": "kb_refund_boundary",
            "title": "退款审核边界",
            "category": "风控边界",
            "content": "退款申请需结合订单状态、商品类型、售后原因、凭证材料和商家责任判断。AI 可解释规则和材料要求，但不得直接审批退款、承诺赔付金额或绕过人工复核。",
            "keywords": ["退款", "审核", "审批", "凭证", "订单状态", "赔付", "人工复核", "风控"],
            "source": "售后风控边界说明",
            "status": "enabled",
            "updated_at": timestamp,
        },
        {
            "id": "kb_human_handoff",
            "title": "人工客服转接规则",
            "category": "服务流程",
            "content": "当问题涉及实时订单状态、物流轨迹、退款审批、赔付承诺、投诉升级、规则冲突或用户情绪强烈时，应提示转人工。转人工前需摘要用户问题、已命中知识、风险点和建议处理方向。",
            "keywords": ["人工", "转接", "订单", "物流", "退款审批", "赔付", "投诉", "规则冲突"],
            "source": "客服转接策略",
            "status": "enabled",
            "updated_at": timestamp,
        },
    ]
