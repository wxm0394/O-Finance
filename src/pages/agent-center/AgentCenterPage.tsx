import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { AssistantTaskMode } from '../../types';
import { GUARDRAIL_INTERCEPTION_LOGS } from '../../mocks/agents';
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
    prompt: 'Analyze my October cash flow, savings rate, and verify internal transfer exclusions.',
  },
  {
    label: '2. Audit Unmatched Transactions & Trial Balance (Audit Mode)',
    mode: 'Audit',
    prompt: 'Check all 32 transactions for unmatched items, duplicate fees, and verify Beancount trial balance.',
  },
  {
    label: '3. Evaluate Concentration & Drawdown (Risk Analysis Mode)',
    mode: 'Risk Analysis',
    prompt: 'Evaluate single-stock concentration risk, sector limits, and 12-month maximum drawdown.',
  },
  {
    label: '4. Compare Allocation vs Last Month (Portfolio Analysis Mode)',
    mode: 'Portfolio Analysis',
    prompt: 'Compare my current multi-brokerage asset allocation and FX exposure against last month.',
  },
  {
    label: '5. Run 50/200 Dual EMA Backtest Audit (Quant Research Mode)',
    mode: 'Quantitative Research',
    prompt: 'Summarize the 50/200 Dual EMA DuckDB backtest on SPY net of commission and slippage.',
  },
  {
    label: '6. Synthesize Semiconductor CapEx Briefing (Research Mode)',
    mode: 'Research',
    prompt: 'Synthesize semiconductor CapEx exposure across NVDA, TSM, and ASML and check external research status.',
  },
];

export const AgentCenterPage: React.FC = () => {
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
    agentLogs,
    playgroundMessages,
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

  const filteredLogs = agentLogs.filter(
    (log) => logModeFilter === 'ALL' || log.taskMode === logModeFilter
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    sendPlaygroundPrompt(promptInput, selectedTaskMode);
    setPromptInput('');
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
    Math.round((assistantStatus.budgetUsedTodayUSD / unifiedModelConfig.daily_budget_usd) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
              AI Assistant Center · OFinanceAssistant (DEMO)
            </h1>
            <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-mono text-[11px] font-semibold">
              Single-Assistant Architecture v0.3
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            One reusable Pydantic AI assistant (<code className="font-mono">OFinanceAssistant</code>) with 6 task mode configuration profiles, one unified LLM provider, and deterministic tool execution.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {[
            { id: 'playground', label: '1. Assistant Playground & Timeline', icon: Terminal },
            { id: 'config', label: '2. Unified Model & Budget Config', icon: Sliders },
            { id: 'tools', label: '3. Unified Tool Registry (20)', icon: Lock },
            { id: 'logs', label: `4. Execution History & Guardrails (${agentLogs.length})`, icon: Activity },
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

      {/* Single Assistant Architecture & Global AI Budget Monitor Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Central AI Instance</span>
            <Cpu className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
            {assistantStatus.assistantName}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
            {assistantStatus.runtimeStatus} · 0 Sub-Agents
          </div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Unified LLM Provider & Model</span>
            <Layers className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
            {unifiedModelConfig.provider} · {unifiedModelConfig.model}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            Shared across all 6 Task Modes · Timeout {unifiedModelConfig.request_timeout}s
          </div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Credential Isolation Status</span>
            <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            api_key_configured: {unifiedModelConfig.api_key_configured ? 'true' : 'false'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Backend Vault / OS Keyring Only · 0 Keys in Browser
          </div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Global AI Budget Monitor (Today)</span>
            <DollarSign className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              ${assistantStatus.budgetUsedTodayUSD.toFixed(2)} / ${unifiedModelConfig.daily_budget_usd.toFixed(2)} USD
            </span>
            <span className="text-[11px] text-slate-400">
              Per-Task Cap: ${unifiedModelConfig.per_task_budget_usd.toFixed(2)}
            </span>
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
              Task Mode Selector (Configuration Profiles on Shared OFinanceAssistant)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Select a task mode profile to inspect its dynamic instructions, permitted data scope, accessible tools, structured output schema, and approval policy.
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
                  Simulated Task Prompts
                </h3>
                <span className="text-[11px] font-mono text-slate-400">POST /api/v1/assistant/run</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click a preset below to run <code className="font-mono">OFinanceAssistant</code> in the corresponding task mode and inspect the sequential tool call timeline:
              </p>

              <div className="space-y-2">
                {PRESET_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => sendPlaygroundPrompt(item.prompt, item.mode)}
                    className="w-full text-left p-2.5 rounded bg-slate-50 dark:bg-slate-900 hover:bg-blue-600/10 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 text-xs transition-colors"
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
                  OFinanceAssistant Execution Timeline (Simulated Sequential Tool Trace)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Single assistant invoking deterministic tools in sequence · Zero sub-agent delegation
                </p>
              </div>
              <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                SIMULATED RUNTIME · DETERMINISTIC TOOLS
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
                          : 'OFinanceAssistant (Pydantic AI Single Runtime)'}
                      </span>
                      {msg.taskMode && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 text-[10px] font-semibold">
                          Mode: {msg.taskMode}
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
                placeholder={`Ask OFinanceAssistant in ${selectedTaskMode} Mode...`}
                className="flex-1 px-3 py-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Run Assistant (Sim)</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Unified Model Configuration & Global Budget */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Global Provider Presets (5 cols) */}
          <div className="lg:col-span-5 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Primary LLM Provider Presets (Global Selection)
              </h2>
              <p className="text-[11px] text-slate-500">
                O-Finance v0.3 enforces one shared LLM provider across all task modes. Local Ollama remains available as an optional global provider without creating separate agents.
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
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {preset.model_status}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 truncate">
                      base_url: {preset.base_url}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[10px] text-slate-400">
                        Context: {preset.contextWindow} · {preset.latencyEstimate}
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
                        {isCurrent ? 'Active Global Model' : 'Select Globally'}
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
                  Single shared configuration for <code className="font-mono">OFinanceAssistant</code>. No per-agent model routing or per-agent API keys exist.
                </p>
              </div>
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                {unifiedModelConfig.model_status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              <div>
                <label className="block text-[11px] font-sans text-slate-500 mb-1">
                  provider
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
                  <option value="Gemini">Gemini (Primary Cloud)</option>
                  <option value="Claude">Claude (Primary Cloud)</option>
                  <option value="OpenAI-Compatible">OpenAI-Compatible</option>
                  <option value="Local Ollama">Local Ollama (Optional Global Local)</option>
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

            {/* Security Invariant Box for API Key */}
            <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] space-y-1">
              <div className="font-bold">
                api_key_configured: {String(unifiedModelConfig.api_key_configured)} · model_status: "{unifiedModelConfig.model_status}"
              </div>
              <div>
                SECURITY INVARIANT: The single cloud LLM API key (`OFINANCE_AI_API_KEY`) is stored exclusively in the Python FastAPI backend environment or Kali Linux OS credential store. It is never stored in frontend state, browser LocalStorage, or `VITE_` environment variables.
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
                  OFinanceAssistant Execution History ({filteredLogs.length} Tasks)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Every execution runs on the single shared <code className="font-mono">OFinanceAssistant</code> instance under a specific Task Mode profile
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
                    <th className="py-2.5 px-3 font-medium">Trigger</th>
                    <th className="py-2.5 px-3 font-medium">Task Summary & Sequential Tools</th>
                    <th className="py-2.5 px-3 font-medium text-right">Duration / Cost</th>
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
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {log.trigger}
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
                        {log.durationMs}ms · {log.tokensUsed} tok (${log.estimatedCostUSD.toFixed(2)})
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-right whitespace-nowrap">
                        <span
                          className={
                            log.status === 'Success (Simulated)'
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
