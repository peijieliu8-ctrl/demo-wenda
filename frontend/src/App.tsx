import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  Database,
  Edit3,
  FileText,
  Handshake,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ThumbsDown,
  UserRound,
  X
} from 'lucide-react';
import {
  createBadCase,
  createKnowledge,
  getBadCases,
  getKnowledge,
  getMetrics,
  getSessions,
  login,
  sendChat,
  transferSession,
  updateBadCase,
  updateKnowledge
} from './api';
import type {
  AnswerStatus,
  BadCase,
  BadCaseStatus,
  BadCaseType,
  ChatResponse,
  Knowledge,
  KnowledgeStatus,
  MetricCard,
  Role,
  SessionLog,
  User
} from './types';

type RouteKey = 'chat' | 'knowledge' | 'sessions' | 'badcases' | 'metrics';

type AuthState = {
  token: string;
  user: User;
};

type Toast = {
  tone: 'success' | 'error' | 'info';
  text: string;
} | null;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  question?: string;
  response?: ChatResponse;
  transferred?: boolean;
  marked?: boolean;
};

type KnowledgeForm = {
  title: string;
  category: string;
  content: string;
  keywords: string;
  source: string;
  status: KnowledgeStatus;
};

const roleLabels: Record<Role, string> = {
  customer_service: '客服',
  operator: '运营',
  admin: '管理员'
};

const statusLabels: Record<AnswerStatus, string> = {
  answered: '已回答',
  fallback: '低置信兜底',
  manual_confirm: '人工确认'
};

const badCaseTypeLabels: Record<BadCaseType, string> = {
  knowledge_missing: '知识缺失',
  retrieval_failed: '召回失败',
  hallucination: '答案幻觉',
  rule_conflict: '规则冲突',
  out_of_scope: '超出边界',
  '': '待标注'
};

const badCaseStatusLabels: Record<BadCaseStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  fixed: '已修复'
};

const routes: Array<{ key: RouteKey; label: string; icon: LucideIcon }> = [
  { key: 'chat', label: 'AI 问答工作台', icon: MessageSquare },
  { key: 'knowledge', label: '知识库管理', icon: BookOpen },
  { key: 'sessions', label: '会话日志', icon: FileText },
  { key: 'badcases', label: 'Bad Case 标注', icon: ShieldAlert },
  { key: 'metrics', label: '数据看板', icon: BarChart3 }
];

const examples = [
  '客户签收后发现包装破损，还能申请售后吗？',
  '开票信息填错了可以修改吗？',
  '订单现在到哪里了？',
  '客户要求赔偿 500 元怎么办？',
  '平台保证金规则是什么？'
];

const emptyKnowledgeForm: KnowledgeForm = {
  title: '',
  category: '',
  content: '',
  keywords: '',
  source: '',
  status: 'enabled'
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ');
}

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem('zall_ai_auth');
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

function App() {
  const [auth, setAuth] = useState<AuthState | null>(loadAuth);
  const [route, setRoute] = useState<RouteKey>('chat');
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2600);
  };

  const handleLogin = (state: AuthState) => {
    localStorage.setItem('zall_ai_auth', JSON.stringify(state));
    setAuth(state);
  };

  const handleLogout = () => {
    localStorage.removeItem('zall_ai_auth');
    setAuth(null);
    setRoute('chat');
  };

  if (!auth) {
    return <LoginPage onLogin={handleLogin} showToast={showToast} />;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-950 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">卓尔智联</div>
              <div className="text-xs text-slate-500">AI 问答助手 Demo</div>
            </div>
          </div>
          <nav className="space-y-1 p-3">
            {routes.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setRoute(item.key)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-sm transition',
                    route === item.key
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
            <div>
              <div className="text-sm font-semibold">{routes.find((item) => item.key === route)?.label}</div>
              <div className="text-xs text-slate-500">Mock RAG · 本地 JSON · 可替换真实模型和向量库</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm md:flex">
                <UserRound className="h-4 w-4 text-slate-500" />
                <span>{auth.user.display_name}</span>
                <span className="text-slate-400">/</span>
                <span className="text-slate-500">{roleLabels[auth.user.role]}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex h-9 items-center gap-2 rounded border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
                退出
              </button>
            </div>
          </header>

          <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
            <div className="flex gap-2 overflow-x-auto">
              {routes.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setRoute(item.key)}
                  className={cx(
                    'whitespace-nowrap rounded px-3 py-2 text-sm',
                    route === item.key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {route === 'chat' && <ChatPage user={auth.user} showToast={showToast} />}
            {route === 'knowledge' && <KnowledgePage showToast={showToast} />}
            {route === 'sessions' && <SessionsPage />}
            {route === 'badcases' && <BadCasesPage showToast={showToast} />}
            {route === 'metrics' && <MetricsPage />}
          </div>
        </main>
      </div>

      {toast && (
        <div
          className={cx(
            'fixed right-5 top-5 z-50 rounded border px-4 py-3 text-sm shadow-panel',
            toast.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
            toast.tone === 'error' && 'border-rose-200 bg-rose-50 text-rose-800',
            toast.tone === 'info' && 'border-sky-200 bg-sky-50 text-sky-800'
          )}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function LoginPage({ onLogin, showToast }: { onLogin: (state: AuthState) => void; showToast: (toast: Toast) => void }) {
  const [role, setRole] = useState<Role>('customer_service');
  const [username, setUsername] = useState('cs01');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);

  const accounts: Array<{ role: Role; username: string; name: string; scope: string }> = [
    { role: 'customer_service', username: 'cs01', name: '客服小卓', scope: '问答接待、转人工、标记 bad case' },
    { role: 'operator', username: 'ops01', name: '运营小尔', scope: '维护知识、查看日志、跟进 bad case' },
    { role: 'admin', username: 'admin', name: '管理员', scope: '全量页面、指标看板、流程验收' }
  ];

  const selectAccount = (nextRole: Role) => {
    const account = accounts.find((item) => item.role === nextRole)!;
    setRole(nextRole);
    setUsername(account.username);
    setPassword('123456');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await login({ username, password, role });
      onLogin(response);
    } catch (error) {
      showToast({ tone: 'error', text: error instanceof Error ? error.message : '登录失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <div className="mb-6 inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
            <Database className="h-4 w-4" />
            本地可运行 · Mock RAG MVP
          </div>
          <h1 className="text-3xl font-semibold text-slate-950 md:text-4xl">卓尔智联 AI 问答助手 Demo</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            面向客服、运营、管理员的 B 端后台演示工程，覆盖登录、问答、引用依据、知识维护、日志、Bad Case 和指标看板。
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {accounts.map((account) => (
              <button
                key={account.role}
                onClick={() => selectAccount(account.role)}
                className={cx(
                  'rounded border bg-white p-4 text-left shadow-sm transition hover:border-slate-400',
                  role === account.role ? 'border-slate-950 ring-2 ring-slate-200' : 'border-slate-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{roleLabels[account.role]}</span>
                  {role === account.role && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <div className="mt-2 text-sm text-slate-600">{account.name}</div>
                <div className="mt-3 min-h-10 text-xs leading-5 text-slate-500">{account.scope}</div>
              </button>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="rounded border border-slate-200 bg-white p-6 shadow-panel">
          <div className="mb-6">
            <div className="text-lg font-semibold">Mock 用户登录</div>
            <div className="mt-1 text-sm text-slate-500">默认密码均为 123456，本地保存用户与角色。</div>
          </div>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">角色</span>
            <select value={role} onChange={(event) => selectAccount(event.target.value as Role)} className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm">
              {accounts.map((account) => (
                <option key={account.role} value={account.role}>
                  {roleLabels[account.role]}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">用户名</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} className="h-10 w-full rounded border border-slate-300 px-3 text-sm" />
          </label>
          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded border border-slate-300 px-3 text-sm" />
          </label>
          <button disabled={loading} className="flex h-10 w-full items-center justify-center gap-2 rounded bg-slate-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
            登录工作台
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatPage({ user, showToast }: { user: User; showToast: (toast: Toast) => void }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const latestResponse = useMemo(() => {
    return [...messages].reverse().find((item) => item.role === 'assistant' && item.response)?.response;
  }, [messages]);

  const submit = async (event?: FormEvent, preset?: string) => {
    event?.preventDefault();
    const question = (preset || input).trim();
    if (!question || loading) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: question };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);
    try {
      const response = await sendChat({ question, user_id: user.id, role: user.role });
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        question,
        response,
        transferred: response.answer_status === 'manual_confirm'
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      showToast({ tone: 'error', text: error instanceof Error ? error.message : '问答失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (message: ChatMessage) => {
    if (!message.response) return;
    try {
      await transferSession(message.response.session_id);
      setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, transferred: true } : item)));
      showToast({ tone: 'success', text: '已记录转人工状态' });
    } catch (error) {
      showToast({ tone: 'error', text: error instanceof Error ? error.message : '转人工失败' });
    }
  };

  const handleBadCase = async (message: ChatMessage) => {
    if (!message.response || !message.question) return;
    try {
      await createBadCase({
        session_id: message.response.session_id,
        question: message.question,
        answer: message.response.answer,
        type: '',
        status: 'pending',
        suggestion: ''
      });
      setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, marked: true } : item)));
      showToast({ tone: 'success', text: '已标记 Bad Case' });
    } catch (error) {
      showToast({ tone: 'error', text: error instanceof Error ? error.message : '标记失败' });
    }
  };

  return (
    <div className="grid h-[calc(100vh-4rem)] min-h-[680px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-w-0 flex-col border-r border-slate-200">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">在线问答</h2>
              <p className="mt-1 text-sm text-slate-500">Mock RAG 会返回答案状态、置信度、引用来源和建议动作。</p>
            </div>
            <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <Bot className="h-4 w-4" />
              后端联调：/api/chat
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {examples.map((item) => (
              <button key={item} onClick={() => submit(undefined, item)} className="shrink-0 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-950">
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="还没有问答记录"
              text="选择上方示例问题，或在底部输入客户问题开始演示。"
            />
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={cx('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-3xl rounded border px-4 py-3 shadow-sm', message.role === 'user' ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-900')}>
                    <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div>
                    {message.response && (
                      <div className="mt-4 border-t border-slate-200 pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <AnswerStatusBadge status={message.response.answer_status} />
                          <ConfidencePill value={message.response.confidence} />
                          <span className="text-xs text-slate-500">{message.response.response_time_ms} ms</span>
                        </div>
                        {message.response.risk_flags.length > 0 && (
                          <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                            风控点：{message.response.risk_flags.join('、')}。需人工确认后回复。
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.response.suggested_actions.map((action) => (
                            <span key={action} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              {action}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleTransfer(message)}
                            disabled={message.transferred}
                            className="flex h-8 items-center gap-1.5 rounded border border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <Handshake className="h-3.5 w-3.5" />
                            {message.transferred ? '已转人工' : '一键转人工'}
                          </button>
                          <button
                            onClick={() => handleBadCase(message)}
                            disabled={message.marked}
                            className="flex h-8 items-center gap-1.5 rounded border border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            {message.marked ? '已标记' : '标记 bad case'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在检索知识库并生成 Mock 答案
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={(event) => submit(event)} className="border-t border-slate-200 bg-white p-4">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="输入客户问题，例如：客户签收后发现包装破损，还能申请售后吗？"
              className="min-h-12 flex-1 resize-none rounded border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-500"
            />
            <button disabled={loading || !input.trim()} className="flex h-12 w-28 items-center justify-center gap-2 rounded bg-slate-950 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400">
              <Send className="h-4 w-4" />
              发送
            </button>
          </div>
        </form>
      </section>

      <aside className="scrollbar-thin min-h-0 overflow-y-auto bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">引用依据</h3>
            <p className="mt-1 text-xs text-slate-500">展示 Top 3 Mock 检索结果</p>
          </div>
          <BookOpen className="h-5 w-5 text-slate-400" />
        </div>
        {!latestResponse ? (
          <EmptyState icon={BookOpen} title="暂无引用" text="发送问题后展示命中文档、片段和分数。" compact />
        ) : (
          <div className="space-y-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <AnswerStatusBadge status={latestResponse.answer_status} />
                <ConfidencePill value={latestResponse.confidence} />
              </div>
              {latestResponse.answer_status !== 'answered' && (
                <div className="mt-3 rounded border border-amber-200 bg-white px-3 py-2 text-xs leading-5 text-amber-800">
                  低置信或高风险场景：不要直接承诺退款、赔付或实时状态结论。
                </div>
              )}
            </div>
            {latestResponse.citations.map((citation, index) => (
              <article key={citation.id} className="rounded border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">Top {index + 1} · {citation.category}</div>
                    <div className="mt-1 text-sm font-semibold">{citation.title}</div>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">score {citation.score}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{citation.snippet}</p>
                <div className="mt-3 text-xs text-slate-400">来源：{citation.source}</div>
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function KnowledgePage({ showToast }: { showToast: (toast: Toast) => void }) {
  const [rows, setRows] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KnowledgeForm>(emptyKnowledgeForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getKnowledge());
    } catch (error) {
      showToast({ tone: 'error', text: error instanceof Error ? error.message : '知识库加载失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setForm(emptyKnowledgeForm);
  };

  const edit = (row: Knowledge) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      category: row.category,
      content: row.content,
      keywords: row.keywords.join('，'),
      source: row.source,
      status: row.status
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      title: form.title.trim(),
      category: form.category.trim(),
      content: form.content.trim(),
      keywords: form.keywords.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
      source: form.source.trim(),
      status: form.status
    };
    if (!payload.title || !payload.category || !payload.content) {
      showToast({ tone: 'error', text: '标题、分类、正文不能为空' });
      return;
    }
    try {
      if (editingId) {
        await updateKnowledge(editingId, payload);
        showToast({ tone: 'success', text: '知识已更新' });
      } else {
        await createKnowledge(payload);
        showToast({ tone: 'success', text: '知识已新增' });
      }
      reset();
      await load();
    } catch (error) {
      showToast({ tone: 'error', text: error instanceof Error ? error.message : '保存失败' });
    }
  };

  const toggleStatus = async (row: Knowledge) => {
    try {
      const status: KnowledgeStatus = row.status === 'enabled' ? 'disabled' : 'enabled';
      const updated = await updateKnowledge(row.id, {
        title: row.title,
        category: row.category,
        content: row.content,
        keywords: row.keywords,
        source: row.source,
        status
      });
      setRows((current) => current.map((item) => (item.id === row.id ? updated : item)));
    } catch (error) {
      showToast({ tone: 'error', text: error instanceof Error ? error.message : '状态更新失败' });
    }
  };

  return (
    <div className="space-y-5 p-5">
      <form onSubmit={save} className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{editingId ? '编辑知识' : '新增知识'}</h2>
            <p className="mt-1 text-sm text-slate-500">字段覆盖标题、分类、正文、关键词、来源、状态和更新时间。</p>
          </div>
          {editingId && (
            <button type="button" onClick={reset} className="flex h-9 items-center gap-2 rounded border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
              <X className="h-4 w-4" />
              取消编辑
            </button>
          )}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField label="标题" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <TextField label="分类" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
          <TextField label="来源" value={form.source} onChange={(value) => setForm({ ...form, source: value })} />
          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">状态</span>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as KnowledgeStatus })} className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm">
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </select>
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">关键词</span>
            <input value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} placeholder="用逗号分隔，例如：售后，签收，凭证" className="h-10 w-full rounded border border-slate-300 px-3 text-sm" />
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">正文</span>
            <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} className="min-h-28 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="flex h-10 items-center gap-2 rounded bg-slate-950 px-4 text-sm font-medium text-white">
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? '保存修改' : '新增知识'}
          </button>
        </div>
      </form>

      <DataPanel title="知识列表" loading={loading} onRefresh={load}>
        {rows.length === 0 ? (
          <EmptyState icon={BookOpen} title="暂无知识" text="新增一条知识后，Mock RAG 会立即参与检索。" compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3">标题</th>
                  <th className="px-4 py-3">分类</th>
                  <th className="px-4 py-3">关键词</th>
                  <th className="px-4 py-3">来源</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">更新时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.title}</td>
                    <td className="px-4 py-3 text-slate-600">{row.category}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">{row.keywords.join('、')}</td>
                    <td className="px-4 py-3 text-slate-600">{row.source}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleStatus(row)} className={cx('rounded px-2 py-1 text-xs', row.status === 'enabled' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                        {row.status === 'enabled' ? '启用' : '停用'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.updated_at}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => edit(row)} className="flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                        <Edit3 className="h-3.5 w-3.5" />
                        编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}

function SessionsPage() {
  const [rows, setRows] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getSessions());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-5">
      <DataPanel title="会话日志" loading={loading} onRefresh={load}>
        {rows.length === 0 ? (
          <EmptyState icon={FileText} title="暂无会话" text="在 AI 问答工作台发送问题后，会自动写入日志。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3">问题</th>
                  <th className="px-4 py-3">答案状态</th>
                  <th className="px-4 py-3">置信度</th>
                  <th className="px-4 py-3">命中文档</th>
                  <th className="px-4 py-3">是否转人工</th>
                  <th className="px-4 py-3">用户反馈</th>
                  <th className="px-4 py-3">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="max-w-sm px-4 py-3 text-slate-900">{row.question}</td>
                    <td className="px-4 py-3"><AnswerStatusBadge status={row.answer_status} /></td>
                    <td className="px-4 py-3"><ConfidencePill value={row.confidence} /></td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">{row.hit_documents.join('、') || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.transferred_to_human ? '是' : '否'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.user_feedback || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}

function BadCasesPage({ showToast }: { showToast: (toast: Toast) => void }) {
  const [rows, setRows] = useState<BadCase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getBadCases());
    } catch (error) {
      showToast({ tone: 'error', text: error instanceof Error ? error.message : 'Bad Case 加载失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patchRow = (id: string, patch: Partial<BadCase>) => {
    setRows((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const save = async (row: BadCase) => {
    try {
      const updated = await updateBadCase(row.id, {
        session_id: row.session_id,
        question: row.question,
        answer: row.answer,
        type: row.type,
        status: row.status,
        suggestion: row.suggestion
      });
      patchRow(row.id, updated);
      showToast({ tone: 'success', text: 'Bad Case 已更新' });
    } catch (error) {
      showToast({ tone: 'error', text: error instanceof Error ? error.message : '更新失败' });
    }
  };

  return (
    <div className="p-5">
      <DataPanel title="Bad Case 标注" loading={loading} onRefresh={load}>
        {rows.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="暂无 Bad Case" text="在问答结果中点击“标记 bad case”后，会进入这里处理。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3">问题</th>
                  <th className="px-4 py-3">问题类型</th>
                  <th className="px-4 py-3">处理状态</th>
                  <th className="px-4 py-3">修复建议</th>
                  <th className="px-4 py-3">命中文档</th>
                  <th className="px-4 py-3">更新时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="max-w-xs px-4 py-3 text-slate-900">{row.question}</td>
                    <td className="px-4 py-3">
                      <select value={row.type} onChange={(event) => patchRow(row.id, { type: event.target.value as BadCaseType })} className="h-9 rounded border border-slate-300 bg-white px-2 text-sm">
                        {Object.entries(badCaseTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={row.status} onChange={(event) => patchRow(row.id, { status: event.target.value as BadCaseStatus })} className="h-9 rounded border border-slate-300 bg-white px-2 text-sm">
                        {Object.entries(badCaseStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <textarea value={row.suggestion} onChange={(event) => patchRow(row.id, { suggestion: event.target.value })} placeholder="填写修复建议" className="min-h-16 w-72 rounded border border-slate-300 px-2 py-2 text-sm" />
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">{row.hit_documents.join('、') || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{row.updated_at}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => save(row)} className="flex h-9 items-center gap-1.5 rounded bg-slate-950 px-3 text-xs font-medium text-white">
                        <Save className="h-3.5 w-3.5" />
                        保存
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}

function MetricsPage() {
  const [cards, setCards] = useState<MetricCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await getMetrics();
      setCards(response.cards);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5 p-5">
      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">运营数据看板</h2>
            <p className="mt-1 text-sm text-slate-500">第一版支持 Mock 兜底值；产生会话后优先按日志动态统计。</p>
          </div>
          <button onClick={load} className="flex h-9 items-center gap-2 rounded border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(loading && cards.length === 0 ? metricSkeletons : cards).map((card) => (
          <div key={card.key} className="rounded border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">{card.label}</div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">{card.value}</div>
              </div>
              <div className="rounded bg-slate-100 p-2 text-slate-500">
                <LayoutDashboard className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-slate-500">{card.helper}</span>
              <span className="font-medium text-emerald-700">{card.trend}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold">指标口径</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <p>AI 独立解决率：答案状态为 answered 且未转人工。</p>
            <p>人工转接率：已转人工或触发高风险人工确认。</p>
            <p>知识命中率：单次问答至少命中 1 篇启用知识。</p>
          </div>
        </section>
        <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold">后续扩展位</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <p>真实 RAG：替换关键词召回为 embedding + rerank。</p>
            <p>大模型：将 Mock 答案生成替换为 DeepSeek 或其他模型调用。</p>
            <p>Tool Calling：将订单、物流、退款审批拆成独立工具能力。</p>
          </div>
        </section>
      </div>
    </div>
  );
}

const metricSkeletons: MetricCard[] = [
  { key: 's1', label: '总提问数', value: '--', helper: '加载中', trend: '--' },
  { key: 's2', label: 'AI 独立解决率', value: '--', helper: '加载中', trend: '--' },
  { key: 's3', label: '人工转接率', value: '--', helper: '加载中', trend: '--' },
  { key: 's4', label: '知识命中率', value: '--', helper: '加载中', trend: '--' }
];

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded border border-slate-300 px-3 text-sm" />
    </label>
  );
}

function DataPanel({ title, loading, onRefresh, children }: { title: string; loading: boolean; onRefresh: () => void; children: ReactNode }) {
  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="text-base font-semibold">{title}</div>
        <button onClick={onRefresh} className="flex h-9 items-center gap-2 rounded border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
          刷新
        </button>
      </div>
      <div>{children}</div>
    </section>
  );
}

function EmptyState({ icon: Icon, title, text, compact }: { icon: LucideIcon; title: string; text: string; compact?: boolean }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-white text-center', compact ? 'px-4 py-8' : 'min-h-72 px-6 py-12')}>
      <div className="mb-3 rounded bg-slate-100 p-3 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{text}</div>
    </div>
  );
}

function AnswerStatusBadge({ status }: { status: AnswerStatus }) {
  return (
    <span
      className={cx(
        'inline-flex rounded px-2 py-1 text-xs font-medium',
        status === 'answered' && 'bg-emerald-50 text-emerald-700',
        status === 'fallback' && 'bg-amber-50 text-amber-700',
        status === 'manual_confirm' && 'bg-rose-50 text-rose-700'
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const tone = value >= 0.7 ? 'text-emerald-700 bg-emerald-50' : value >= 0.5 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50';
  return <span className={cx('inline-flex rounded px-2 py-1 text-xs font-medium', tone)}>置信度 {Math.round(value * 100)}%</span>;
}

export default App;
