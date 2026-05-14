export type Role = 'customer_service' | 'operator' | 'admin';
export type KnowledgeStatus = 'enabled' | 'disabled';
export type AnswerStatus = 'answered' | 'fallback' | 'manual_confirm';
export type BadCaseType = 'knowledge_missing' | 'retrieval_failed' | 'hallucination' | 'rule_conflict' | 'out_of_scope' | '';
export type BadCaseStatus = 'pending' | 'processing' | 'fixed';

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Knowledge {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  source: string;
  status: KnowledgeStatus;
  updated_at: string;
}

export interface Citation {
  id: string;
  title: string;
  category: string;
  source: string;
  snippet: string;
  score: number;
}

export interface ChatResponse {
  session_id: string;
  answer_status: AnswerStatus;
  answer: string;
  confidence: number;
  citations: Citation[];
  suggested_actions: string[];
  risk_flags: string[];
  response_time_ms: number;
}

export interface SessionLog {
  id: string;
  question: string;
  answer: string;
  answer_status: AnswerStatus;
  confidence: number;
  hit_documents: string[];
  transferred_to_human: boolean;
  user_feedback: string | null;
  created_at: string;
  response_time_ms: number;
  user_id: string | null;
  role: Role | null;
}

export interface BadCase {
  id: string;
  session_id: string | null;
  question: string;
  answer: string | null;
  type: BadCaseType;
  status: BadCaseStatus;
  suggestion: string;
  confidence: number | null;
  hit_documents: string[];
  created_at: string;
  updated_at: string;
}

export interface MetricCard {
  key: string;
  label: string;
  value: string;
  helper: string;
  trend: string;
}
