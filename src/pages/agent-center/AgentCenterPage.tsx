import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { useI18n } from '../../i18n';
import { AssistantTaskMode } from '../../types';
import { GUARDRAIL_INTERCEPTION_LOGS } from '../../mocks/assistant';
import { ApiClient } from '../../services/api/client';
import {
  Cpu,
  Send,
  ShieldAlert,
  Lock,
  Terminal,
  Activity,
  Sliders,
  CheckCircle2,
  ArrowRight,
  Layers,
  DollarSign,
  KeyRound,
  AlertOctagon,
} from 'lucide-react';

const PRESET_PROMPTS: { label: string; mode: AssistantTaskMode; prompt: string }[] = [
  {
    label: '1. Analyze Monthly Cash Flow (Accounting Mode)',
    mode: 'Accounting',
    prompt: 'Analyze my settled cash flow, net retention rate, and verify internal transfer exclusions.',
  },
  {
    label: '2. Audit Unmatched Transactions & Trial Balance (Audit Mode)',
    mode: 'Audit',
    prompt: 'Check all 32 transactions for unmatched items, duplicate fees, and verify Beancount trial balance.',
  },
  {
    label: '3. Evaluate Concentration & Drawdown (Risk Analysis Mode)',
    mode: 'Risk Analysis',
    prompt: 'Evaluate single-stock concentration risk, sector limits, and cash liquidity ratio.',
  },
  {
    label: '4. Aggregate Multi-Brokerage Portfolio (Portfolio Analysis Mode)',
    mode: 'Portfolio Analysis',
    prompt: 'Aggregate my multi-brokerage asset allocation, overall return, and non-USD FX exposure.',
  },
  {
    label: '5. Inspect DuckDB Backtest Registry (Quant Research Mode)',
    mode: 'Quantitative Research',
    prompt: 'Summarize the latest DuckDB strategy backtest net of commission and slippage.',
  },
  {
    label: '6. Synthesize Semiconductor CapEx Briefing (Research Mode)',
    mode: 'Research',
    prompt: 'Synthesize semiconductor CapEx exposure across tech holdings and check external research status.',
  },
];

export const AgentCenterPage: React.FC = () => {
  const { t } = useI18n();
  const {
    assistantStatus,
    taskModeProfiles,
    selectedTaskMode,
    setSelectedTaskMode,
    unifiedModelConfig,
    modelPresets,
    updateUnifiedModelConfig,
    applyModelPreset,
    toolPermissions,
    toggleToolPermission,
    assistantTaskLogs,
    playgroundMessages,
    isAssistantRunning,
    sendPlaygroundPrompt,
    approvalTasks,
  } = useOFinance();

  const navigate = useNavigate();

  const [promptInput, setPromptInput] = useState('');
  const [activeTab, setActiveTab] = useState<'playground' | 'config' | 'tools' | 'logs'>('playground');
  const [logModeFilter, setLogModeFilter] = useState<'ALL' | AssistantTaskMode>('ALL');

  const currentModeProfile =
    taskModeProfiles.find((p) => p.mode === selectedTaskMode) || taskModeProfiles[0];

  const pendingApprovals = approvalTasks.filter((t) => t.status === 'Pending');

  const filteredLogs = assistantTaskLogs.filter(
    (log) => logModeFilter === 'ALL' || log.taskMode === logModeFilter
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isAssistantRunning) return;
    const text = promptInput;
    setPromptInput('');
    await sendPlaygroundPrompt(text, selectedTaskMode);
  };

  const toolCategories = [
    'Read-Only',
    'Deterministic Computation',
    'Drafting',
    'Governance',
    'Restricted (Prohibited)',
  ] as const;

  const budgetUsagePct = Math.min(
    100,
    Math.round((assistantStatus.realBudgetUsedTodayUSD / unifiedModelConfig.daily_budget_usd) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
              {t.assistant.title}
            </h1>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-semibold">
              v0.4.0 · Demo Adapter Active (FastAPI Harness Pending)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.assistant.subtitle}
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {[
            { id: 'playground', label: '1. Assistant Playground & Timeline', icon: Terminal },
            { id: 'config', label: '2. Unified Model & Key Status', icon: Sliders },
            { id: 'tools', label: '3. Unified Tool Registry (20)', icon: Lock },
            { id: 'logs', label: `4. Task Logs & Guardrails (${assistantTaskLogs.length})`, icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : 'bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explicit Runtime Mode Delineation Banner */}
      <div className={`p-3.5 rounded border text-xs flex flex-wrap items-center justify-between gap-3 ${
        ApiClient.isDemoMode
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${ApiClient.isDemoMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="font-bold font-mono">
            ACTIVE RUNTIME: {ApiClient.isDemoMode ? 'DEMO ADAPTER (DETERMINISTIC SIMULATION)' : 'LOCAL FASTAPI (PYDANTIC AI + GEMINI)'}
          </span>
          <span className="text-[11px] text-slate-600 dark:text-slate-300">
            {ApiClient.isDemoMode
              ? 'Executing all 6 task modes locally over in-memory dataset with 0 real tokens billed.'
              : `Connected to FastAPI server at ${ApiClient.baseUrl}`}
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {ApiClient.isDemoMode ? 'VITE_DEMO_MODE=true · No LLM API Call' : 'VITE_DEMO_MODE=false · Live Gemini Call'}
        </div>
      </div>

      {/* Single Assistant Architecture & Global AI Budget Monitor Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Central AI Instance & Adapter</span>
            <Cpu className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
            {assistantStatus.assistantName} ({assistantStatus.runtimeMode})
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
            {assistantStatus.runtimeStatus}
          </div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Phase 1 Unified LLM Target</span>
            <Layers className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
            {unifiedModelConfig.provider} · {unifiedModelConfig.model}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {unifiedModelConfig.model_status}
          </div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Backend Credential Verification</span>
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1">
            api_key_configured: {String(unifiedModelConfig.api_key_configured)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {unifiedModelConfig.api_key_status}
          </div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{t.assistant.budgetCap}</span>
            <DollarSign className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              ${assistantStatus.realBudgetUsedTodayUSD.toFixed(2)} / ${unifiedModelConfig.daily_budget_usd.toFixed(2)} USD
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>{assistantStatus.realTokensUsedToday} real tok</span>
              <span>{assistantStatus.simulatedTasksExecutedToday} sim runs</span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden mt-1.5">
            <div
              className="h-full bg-blue-600 dark:bg-blue-500"
              style={{ width: `${budgetUsagePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Task Mode Selector Bar (6 Configuration Profiles, Not Separate Agents) */}
      <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Task Mode Selector (6 Configuration Profiles on Shared OFinanceAssistant)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              All 6 task modes share the single Gemini model configuration and backend API key. Select a mode to inspect its instructions, toolset, and output schema.
            </p>
          </div>
          <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
            Active Mode: {selectedTaskMode}
          </span>
        </div>

        {/* 6 Mode Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {taskModeProfiles.map((profile) => {
            const isSelected = profile.mode === selectedTaskMode;
            return (
              <button
                key={profile.mode}
                type="button"
                onClick={() => setSelectedTaskMode(profile.mode)}
                className={`p-2.5 rounded border text-left transition-all ${
                  isSelected
                    ? 'bg-blue-600/10 border-blue-500 text-slate-900 dark:text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                }`}
              >
                <div className="font-mono text-xs font-bold flex items-center justify-between">
                  <span className="truncate">{profile.mode}</span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {profile.tagline}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Task Mode Profile Specification Card */}
        <div className="p-3.5 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          <div className="lg:col-span-5 space-y-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Mode Instructions (Pydantic AI Dynamic System Prompt)
              </span>
              <p className="text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed">
                {currentModeProfile.instructions}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Permitted Data Scope
              </span>
              <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 mt-0.5">
                {currentModeProfile.permittedDataScope}
              </p>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Accessible Deterministic Tools ({currentModeProfile.accessibleTools.length})
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {currentModeProfile.accessibleTools.map((tool) => (
                  <span
                    key={tool}
                    className="px-2 py-0.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-blue-600 dark:text-blue-400"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Expected Structured Output (Pydantic Model)
              </span>
              <code className="block font-mono text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 break-all">
                {currentModeProfile.expectedOutputSchema}
              </code>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-2 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 pt-2 lg:pt-0 lg:pl-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Permission Requirements
              </span>
              <ul className="mt-0.5 space-y-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                {currentModeProfile.permissionRequirements.map((req) => (
                  <li key={req}>• {req}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Human Approval Policy
              </span>
              <p className="font-mono text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                {currentModeProfile.approvalPolicy}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: Assistant Playground & Sequential Task Execution Timeline */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Prompt Controls, Mode Quick-Triggers & Approval Integration (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Dual-Mode Task Runner
                </h3>
                <span className="text-[11px] font-mono text-slate-400">AssistantService.runTask()</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                In <strong>Demo Mode</strong>, clicking a task runs <code className="font-mono">AssistantService.runTask()</code> against the deterministic Demo Adapter (computing live figures from your in-memory accounts, holdings, and transactions with 0 real LLM tokens). In <strong>Local FastAPI Mode</strong>, it dispatches to Pydantic AI + Gemini:
              </p>

              <div className="space-y-2">
                {PRESET_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isAssistantRunning}
                    onClick={() => sendPlaygroundPrompt(item.prompt, item.mode)}
                    className="w-full text-left p-2.5 rounded bg-slate-50 dark:bg-slate-900 hover:bg-blue-600/10 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 text-xs transition-colors disabled:opacity-50"
                  >
                    <div className="font-semibold text-blue-600 dark:text-blue-400">{item.label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      "{item.prompt}"
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Human-in-the-Loop Approval Integration Box */}
            <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Human Approval Integration
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                  {pendingApprovals.length} Pending
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Whenever <code className="font-mono">OFinanceAssistant</code> invokes <code className="font-mono">Request Human Approval</code>, tasks are queued in the Approval Inbox before any ledger state changes occur.
              </p>
              <button
                type="button"
                onClick={() => navigate('/approvals')}
                className="w-full py-1.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-semibold hover:bg-amber-500/25"
              >
                Open Approval Inbox ({pendingApprovals.length} Tasks) →
              </button>
            </div>
          </div>

          {/* Right: Assistant Playground Stream & Sequential Tool Execution Timeline (8 cols) */}
          <div className="lg:col-span-8 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  OFinanceAssistant Execution Timeline
                </h3>
                <p className="text-[11px] text-slate-500">
                  Explicitly distinguishes <code className="font-mono">DEMO_ADAPTER</code> deterministic simulation from <code className="font-mono">LOCAL_FASTAPI_GEMINI</code> live runs
                </p>
              </div>
              <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                ORIGIN: DEMO_ADAPTER (0 REAL TOKENS BILLED)
              </span>
            </div>

            {/* Message & Sequential Tool Timeline Stream */}
            <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
              {playgroundMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded border text-xs space-y-3 ${
                    msg.role === 'user'
                      ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                      : 'bg-blue-950/15 border-blue-500/30'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {msg.role === 'user'
                          ? 'OPERATOR PROMPT'
                          : 'OFinanceAssistant'}
                      </span>
                      {msg.taskMode && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 text-[10px] font-semibold">
                          Mode: {msg.taskMode}
                        </span>
                      )}
                      {msg.executionOrigin && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[10px] font-semibold">
                          {msg.executionOrigin}
                        </span>
                      )}
                    </div>
                    <span>{msg.timestamp}</span>
                  </div>

                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{msg.content}</p>

                  {/* Visual Chain Summary Header */}
                  {msg.toolTimeline && msg.toolTimeline.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="p-2 rounded bg-slate-900 text-slate-200 font-mono text-[11px] flex flex-wrap items-center gap-1.5">
                        <span className="text-blue-400 font-bold">OFinanceAssistant</span>
                        {msg.toolTimeline.map((step) => (
                          <React.Fragment key={step.stepNumber}>
                            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">
                              {step.toolName}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Step-by-Step Deterministic Tool Cards */}
                      <div className="space-y-2">
                        {msg.toolTimeline.map((step) => (
                          <div
                            key={step.stepNumber}
                            className="p-2.5 rounded bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 space-y-1"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                Step {step.stepNumber}: {step.toolName}{' '}
                                <span className="text-[10px] font-normal text-slate-400">
                                  [{step.category}]
                                </span>
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>
                                  {step.status} · {step.durationMs}ms
                                </span>
                              </span>
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              Call: <code>{step.callSignature}</code>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 text-xs pt-0.5">
                              {step.deterministicFinding}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structured Metrics Summary */}
                  {msg.structuredMetrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                      {msg.structuredMetrics.map((m) => (
                        <div
                          key={m.label}
                          className="p-2 rounded bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800"
                        >
                          <div className="text-[10px] text-slate-400 truncate">{m.label}</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                            {m.value}
                          </div>
                          {m.delta && (
                            <div className="text-[10px] text-blue-500 mt-0.5">{m.delta}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Prompt Input Form */}
            <form onSubmit={handleSend} className="flex flex-wrap sm:flex-nowrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <select
                aria-label="Select Task Mode for Prompt"
                value={selectedTaskMode}
                onChange={(e) => setSelectedTaskMode(e.target.value as AssistantTaskMode)}
                className="px-2.5 py-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200"
              >
                {taskModeProfiles.map((p) => (
                  <option key={p.mode} value={p.mode}>
                    Mode: {p.mode}
                  </option>
                ))}
              </select>
              <input
                type="text"
                aria-label="Ask OFinanceAssistant"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={`Run OFinanceAssistant in ${selectedTaskMode} Mode via AssistantService.runTask()...`}
                className="flex-1 px-3 py-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isAssistantRunning}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isAssistantRunning ? 'Running...' : 'Run Assistant'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Unified Model Configuration & Honest Key Status */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Phase 1 Single Cloud Provider (Gemini) + Optional Local Ollama (5 cols) */}
          <div className="lg:col-span-5 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Phase 1 Provider Policy: Gemini Only + Optional Local Ollama
              </h2>
              <p className="text-[11px] text-slate-500">
                Phase 1 fixes <strong>Gemini</strong> as the sole cloud LLM provider so all 6 task modes share one <code className="font-mono">GEMINI_API_KEY</code> in the Python backend. Switching presets below updates only <code className="font-mono">provider</code>, <code className="font-mono">model</code>, and <code className="font-mono">base_url</code>—it never fakes <code className="font-mono">api_key_configured: true</code>.
              </p>
            </div>

            <div className="space-y-2.5">
              {modelPresets.map((preset) => {
                const isCurrent =
                  unifiedModelConfig.provider === preset.provider &&
                  unifiedModelConfig.model === preset.model;
                return (
                  <div
                    key={preset.id}
                    className={`p-3 rounded border text-xs space-y-1.5 ${
                      isCurrent
                        ? 'bg-blue-600/10 border-blue-500'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {preset.provider} · {preset.model}
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        Key: Unverified (Demo)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      {preset.roleDescription}
                    </p>
                    <div className="font-mono text-[11px] text-slate-500 truncate">
                      base_url: {preset.base_url}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[10px] text-slate-400">
                        Context: {preset.contextWindow}
                      </span>
                      <button
                        type="button"
                        onClick={() => applyModelPreset(preset.id)}
                        className={`px-2.5 py-1 rounded font-mono text-[11px] ${
                          isCurrent
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {isCurrent ? 'Selected Target' : 'Switch Target'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Unified Model Configuration Form (`GET /api/v1/assistant/config`) (7 cols) */}
          <div className="lg:col-span-7 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Unified Model Configuration (GET /api/v1/assistant/config)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Single shared configuration for <code className="font-mono">OFinanceAssistant</code>. No multi-key management or per-agent routing.
                </p>
              </div>
              <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                {unifiedModelConfig.model_status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              <div>
                <label className="block text-[11px] font-sans text-slate-500 mb-1">
                  provider (Phase 1 Fixed Cloud = Gemini)
                </label>
                <select
                  aria-label="Global AI Provider"
                  value={unifiedModelConfig.provider}
                  onChange={(e) =>
                    updateUnifiedModelConfig({
                      provider: e.target.value as typeof unifiedModelConfig.provider,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <option value="Gemini">Gemini (Phase 1 Sole Cloud Provider)</option>
                  <option value="Local Ollama">Local Ollama (Optional Global Offline Mode)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-sans text-slate-500 mb-1">
                  model
                </label>
                <input
                  type="text"
                  aria-label="Global Model Name"
                  value={unifiedModelConfig.model}
                  onChange={(e) => updateUnifiedModelConfig({ model: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-sans text-slate-500 mb-1">
                  base_url
                </label>
                <input
                  type="text"
                  aria-label="Model Base URL"
                  value={unifiedModelConfig.base_url}
                  onChange={(e) => updateUnifiedModelConfig({ base_url: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-sans text-slate-500 mb-1">
                  request_timeout (seconds)
                </label>
                <input
                  type="number"
                  aria-label="Request Timeout Seconds"
                  value={unifiedModelConfig.request_timeout}
                  onChange={(e) =>
                    updateUnifiedModelConfig({ request_timeout: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-sans text-slate-500 mb-1">
                  max_output_tokens
                </label>
                <input
                  type="number"
                  aria-label="Max Output Tokens"
                  value={unifiedModelConfig.max_output_tokens}
                  onChange={(e) =>
                    updateUnifiedModelConfig({ max_output_tokens: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-sans text-slate-500 mb-1">
                  daily_budget_usd ($)
                </label>
                <input
                  type="number"
                  step="0.5"
                  aria-label="Daily Budget USD"
                  value={unifiedModelConfig.daily_budget_usd}
                  onChange={(e) =>
                    updateUnifiedModelConfig({ daily_budget_usd: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-sans text-slate-500 mb-1">
                  per_task_budget_usd ($)
                </label>
                <input
                  type="number"
                  step="0.05"
                  aria-label="Per Task Budget USD"
                  value={unifiedModelConfig.per_task_budget_usd}
                  onChange={(e) =>
                    updateUnifiedModelConfig({ per_task_budget_usd: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            {/* Honest API Key Status Box */}
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-mono text-[11px] space-y-1">
              <div className="font-bold">
                api_key_configured: {String(unifiedModelConfig.api_key_configured)} · api_key_status: "{unifiedModelConfig.api_key_status}"
              </div>
              <div>
                CREDENTIAL VERIFICATION POLICY: Frontend model selection never sets `api_key_configured: true`. In Demo Mode, no backend key check occurs so the status is explicitly reported as Unverified / Simulated. When running against the local FastAPI backend on Kali Linux, `GET /api/v1/assistant/config` verifies `GEMINI_API_KEY` in the backend environment and returns the real boolean status.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Unified Tool Registry & Permission Matrix */}
      {activeTab === 'tools' && (
        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Unified Tool Registry & Permission Matrix (GET /api/v1/assistant/tools)
              </h2>
              <p className="text-[11px] text-slate-500">
                Tools are grouped by capability. Tools highlighted with a badge are accessible in the currently selected <strong>{selectedTaskMode}</strong> mode.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4" />
              <span>Write / Live Trade / Fund Transfer Tools Permanently Locked OFF</span>
            </div>
          </div>

          <div className="space-y-4">
            {toolCategories.map((category) => {
              const toolsInCategory = toolPermissions.filter((t) => t.category === category);
              return (
                <div key={category} className="space-y-2">
                  <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1 flex items-center justify-between">
                    <span>{category}</span>
                    <span className="text-[11px] text-slate-400">
                      {toolsInCategory.length} Tools
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                    {toolsInCategory.map((tool) => {
                      const inActiveMode = currentModeProfile.accessibleTools.includes(tool.name);
                      return (
                        <div
                          key={tool.id}
                          className={`p-3 rounded border flex items-start justify-between gap-3 ${
                            tool.lockedReadOnly
                              ? 'bg-rose-950/10 border-rose-500/30'
                              : inActiveMode
                              ? 'bg-blue-600/5 border-blue-500/40'
                              : 'bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {tool.name}
                              </span>
                              {inActiveMode && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 font-mono text-[10px]">
                                  Active in {selectedTaskMode}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {tool.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleToolPermission(tool.id)}
                            className={`px-2.5 py-1 rounded font-mono text-[11px] shrink-0 ${
                              tool.lockedReadOnly
                                ? 'bg-rose-500/20 text-rose-500 cursor-not-allowed'
                                : tool.enabled
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {tool.lockedReadOnly
                              ? 'LOCKED OFF'
                              : tool.enabled
                              ? 'ENABLED'
                              : 'DISABLED'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Execution History, Error Logs & Guardrail Interception Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Guardrail Interception Logs */}
          <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Guardrail Interception & Policy Enforcement Logs
                </h2>
              </div>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                0 Unhandled Runtime Errors · {GUARDRAIL_INTERCEPTION_LOGS.length} Policy Interceptions Verified
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {GUARDRAIL_INTERCEPTION_LOGS.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded bg-amber-500/5 border border-amber-500/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-bold text-amber-600 dark:text-amber-400">{item.id}</span>
                    <span className="text-slate-400">{item.taskMode} Mode</span>
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {item.attemptedAction}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Rule: {item.policyRule}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                    → {item.resolution}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Task Execution History Table */}
          <div className="rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  OFinanceAssistant Task Execution History ({filteredLogs.length} Tasks)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Demo Adapter records explicitly report <code className="font-mono">0 real tokens / $0.00</code> so simulated tasks are never confused with live Gemini billing
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
                {(['ALL', ...taskModeProfiles.map((p) => p.mode)] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLogModeFilter(mode)}
                    className={`px-2 py-1 rounded ${
                      logModeFilter === mode
                        ? 'bg-slate-900 text-white dark:bg-blue-600'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                    <th className="py-2.5 px-3 font-medium">Task ID</th>
                    <th className="py-2.5 px-3 font-medium">Timestamp</th>
                    <th className="py-2.5 px-3 font-medium">Assistant & Task Mode</th>
                    <th className="py-2.5 px-3 font-medium">Origin</th>
                    <th className="py-2.5 px-3 font-medium">Task Summary & Sequential Tools</th>
                    <th className="py-2.5 px-3 font-medium text-right">Duration / Token Telemetry</th>
                    <th className="py-2.5 px-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {log.id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">
                          {log.assistantName}
                        </div>
                        <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                          Mode: {log.taskMode}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300">
                          {log.executionOrigin}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-md">
                        <div className="text-slate-900 dark:text-slate-100 font-medium">
                          {log.taskSummary}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          Tools: {log.toolsInvoked.join(' → ')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-right whitespace-nowrap tabular-nums">
                        {log.tokensUsed !== null && log.estimatedCostUSD !== null
                          ? `${log.durationMs}ms · ${log.tokensUsed} tok ($${log.estimatedCostUSD.toFixed(2)})`
                          : `${log.durationMs}ms · Sim (0 real tok / $0.00)`}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-right whitespace-nowrap">
                        <span
                          className={
                            log.status.startsWith('Success')
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400 font-semibold'
                          }
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
