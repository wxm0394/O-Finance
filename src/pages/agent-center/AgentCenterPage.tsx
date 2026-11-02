import React, { useState } from 'react';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { AgentRoleId } from '../../types';
import { Cpu, Send, Shield, Lock, Terminal, CheckCircle2 } from 'lucide-react';

const PRESET_PROMPTS = [
  '分析我所有券商账户的持仓集中度。',
  '解释最近一个月的现金流变化。',
  '检查我的账户是否存在未匹配交易。',
  '比较当前投资组合与上个月的资产配置。',
  '分析最近的投资组合回撤。',
];

export const AgentCenterPage: React.FC = () => {
  const {
    agents,
    aiModels,
    toolPermissions,
    agentLogs,
    playgroundMessages,
    assignAgentModel,
    toggleToolPermission,
    sendPlaygroundPrompt,
  } = useOFinance();

  const [selectedAgentId, setSelectedAgentId] = useState<AgentRoleId>('orchestrator');
  const [promptInput, setPromptInput] = useState('');
  const [activeTab, setActiveTab] = useState<'playground' | 'details' | 'permissions' | 'logs'>('playground');

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
  const assignedModel = aiModels.find((m) => m.id === selectedAgent.assignedModelId) || aiModels[0];
  const agentSpecificLogs = agentLogs.filter((l) => l.agentId === selectedAgentId);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    sendPlaygroundPrompt(promptInput);
    setPromptInput('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            AI Agent Control Center & Pydantic AI Governance (SIMULATED)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Multi-agent orchestration architecture (Orchestrator, Accounting, Investment, Research, Quant, Auditor, Risk). All executions are simulated by the Mock Agent Runtime.
          </p>
        </div>

        <div className="flex items-center bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 rounded p-0.5 text-xs font-mono">
          {[
            { id: 'playground', label: '1. Agent Playground & Call Chain' },
            { id: 'details', label: '2. Agent Inspector & Model Routing' },
            { id: 'permissions', label: '3. Tool Permissions Matrix' },
            { id: 'logs', label: `4. Execution History (${agentLogs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 12.1 7-Agent Roster Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
        {agents.map((ag) => {
          const isSelected = ag.id === selectedAgentId;
          const model = aiModels.find((m) => m.id === ag.assignedModelId);
          return (
            <button
              key={ag.id}
              type="button"
              onClick={() => setSelectedAgentId(ag.id)}
              className={`p-3 rounded border text-left transition-colors flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-600/10 border-blue-500 text-slate-900 dark:text-white'
                  : 'bg-white dark:bg-[#0F1420] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-blue-500">
                  <span>{ag.id.toUpperCase()}</span>
                  <span>SIM</span>
                </div>
                <div className="text-xs font-bold mt-0.5 truncate">{ag.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {ag.role}
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-[10px] font-mono text-slate-400 truncate">
                {model?.provider}: {model?.modelName.split(':')[0]}
              </div>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 12.4 Agent Playground & Multi-Agent Call Chain */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Prompt Launcher & Selected Agent Quick Profile (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Preset Multi-Agent Analytical Prompts
                </h2>
                <span className="text-[10px] font-mono text-amber-500">SIMULATED RUNTIME</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Click any prompt below to simulate Orchestrator task decomposition, deterministic tool invocation, and specialist agent synthesis:
              </p>

              <div className="space-y-2">
                {PRESET_PROMPTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => sendPlaygroundPrompt(preset)}
                    className="w-full text-left p-2.5 rounded bg-slate-50 dark:bg-slate-900/80 hover:bg-blue-600/10 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 text-xs text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-between gap-2"
                  >
                    <span>"{preset}"</span>
                    <Send className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Agent Summary Card */}
            <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">{selectedAgent.name}</span>
                <span className="font-mono text-[11px] text-amber-500">{selectedAgent.runtimeStatus}</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">{selectedAgent.description}</p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 font-mono text-[11px]">
                <div>
                  <span className="text-slate-400">Model:</span> {assignedModel.modelName}
                </div>
                <div>
                  <span className="text-slate-400">Tools:</span> {selectedAgent.tools.join(', ')}
                </div>
                <div>
                  <span className="text-slate-400">Budget Used:</span> ${selectedAgent.budgetUsedUSD.toFixed(2)} / ${selectedAgent.executionBudgetUSD.toFixed(2)} USD
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className="w-full py-1.5 mt-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs"
              >
                Configure {selectedAgent.name} Model & Budget →
              </button>
            </div>
          </div>

          {/* Right: Multi-Turn Orchestrator Trace Console (8 cols) */}
          <div className="lg:col-span-8 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Orchestrator Execution Trace & Specialist Call Chain
                </h2>
              </div>
              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                MOCK AGENT RUNTIME · DETERMINISTIC NUMBERS
              </span>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {playgroundMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded border text-xs ${
                    msg.role === 'user'
                      ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      : 'bg-blue-950/20 border-blue-500/30 space-y-3'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {msg.role === 'user' ? 'OPERATOR REQUEST' : 'ORCHESTRATOR AGENT (SIMULATED TRACE)'}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{msg.content}</p>

                  {/* Delegated Agent Call Chain Steps */}
                  {msg.delegatedAgents && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-mono font-semibold text-slate-400">
                        AGENT CALL CHAIN & TOOL INVOCATIONS:
                      </div>
                      {msg.delegatedAgents.map((step, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 space-y-1"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              Step {idx + 1} · {step.agentName}: {step.stepTitle}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{step.status}</span>
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            Tool Invoked: <code className="text-amber-500">{step.toolCalled}</code>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 text-[11px] pt-0.5">
                            {step.finding}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Deterministic Metrics Strip */}
                  {msg.structuredMetrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                      {msg.structuredMetrics.map((m) => (
                        <div
                          key={m.label}
                          className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
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

            {/* Input Form */}
            <form onSubmit={handlePromptSubmit} className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <input
                type="text"
                aria-label="Ask Orchestrator Agent"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Ask Orchestrator (e.g., 分析我所有券商账户的持仓集中度 / Analyze cash flow)..."
                className="flex-1 px-3 py-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Simulate Dispatch</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: 12.2 Agent Details & 12.3 Model Routing Configuration */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900 dark:text-white">
                  {selectedAgent.name} — {selectedAgent.role}
                </h2>
                <p className="text-xs font-mono text-amber-500 mt-0.5">
                  Runtime Status: {selectedAgent.runtimeStatus} · Memory: {selectedAgent.memoryStatus}
                </p>
              </div>
              <Cpu className="w-5 h-5 text-blue-500" />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedAgent.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-900 dark:text-white">Core Responsibilities</div>
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 list-disc pl-4">
                  {selectedAgent.responsibilities.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 font-mono text-[11px]">
                <div className="font-sans font-semibold text-slate-900 dark:text-white text-xs">
                  Telemetry & Budget Governance
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Assigned Model:</span>
                  <span className="font-bold text-blue-400">{assignedModel.modelName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last Execution:</span>
                  <span>{selectedAgent.lastExecution}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tokens Used Today:</span>
                  <span>{selectedAgent.tokensUsedToday.toLocaleString()} tok</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Daily Budget Used:</span>
                  <span>
                    ${selectedAgent.budgetUsedUSD.toFixed(2)} / ${selectedAgent.executionBudgetUSD.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Error Logs (24h):</span>
                  <span className="text-emerald-500">{selectedAgent.errorCount} Errors</span>
                </div>
              </div>
            </div>

            {/* Agent-Specific Execution History */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Recent Executions for {selectedAgent.name} ({agentSpecificLogs.length})
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                {agentSpecificLogs.map((l) => (
                  <div
                    key={l.id}
                    className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="text-blue-500 font-bold">{l.id}</span> · {l.timestamp} ·{' '}
                      <span className="font-sans text-slate-800 dark:text-slate-200">{l.taskSummary}</span>
                    </div>
                    <span className="text-emerald-500">{l.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 12.3 Model Routing Selector for Selected Agent (5 cols) */}
          <div className="lg:col-span-5 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Model Provider Routing for {selectedAgent.name}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Provider-independent Pydantic AI configuration. API Keys are never exposed in the client browser.
              </p>
            </div>

            <div className="space-y-2.5">
              {aiModels.map((m) => {
                const isAssigned = selectedAgent.assignedModelId === m.id;
                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded border text-xs space-y-1.5 ${
                      isAssigned
                        ? 'bg-blue-600/10 border-blue-500'
                        : 'bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {m.provider} · <span className="font-mono text-blue-500">{m.modelName}</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{m.status}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      Endpoint: {m.endpoint} · Context: {m.contextWindow}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[10px] text-slate-400">
                        Est. Speed: {m.latencyEstimate}
                      </span>
                      <button
                        type="button"
                        onClick={() => assignAgentModel(selectedAgent.id, m.id)}
                        disabled={isAssigned}
                        className={`px-3 py-1 rounded text-[11px] font-medium ${
                          isAssigned
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-blue-600'
                        }`}
                      >
                        {isAssigned ? 'Assigned to Agent' : 'Assign Model (Sim)'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 12.5 Agent Tool Permissions Matrix */}
      {activeTab === 'permissions' && (
        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-500" />
                <span>Agent Tool Permissions & Hard Read-Only Guardrails</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Toggle read, computation, and drafting capabilities. Real fund transfers, withdrawals, and live brokerage orders are permanently prohibited.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              Write/Execution Tools: PERMANENTLY LOCKED OFF
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {toolPermissions.map((tool) => (
              <div
                key={tool.id}
                className={`p-3.5 rounded border flex items-start justify-between gap-3 text-xs ${
                  tool.lockedReadOnly
                    ? 'bg-rose-500/5 border-rose-500/30'
                    : 'bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{tool.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">[{tool.category}]</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{tool.description}</p>
                </div>

                {tool.lockedReadOnly ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600/20 text-rose-500 font-mono text-[10px] shrink-0">
                    <Lock className="w-3 h-3" />
                    <span>BLOCKED</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={tool.enabled}
                    aria-label={`Toggle ${tool.name}`}
                    onClick={() => toggleToolPermission(tool.id)}
                    className={`px-3 py-1 rounded font-mono text-[11px] font-semibold shrink-0 transition-colors ${
                      tool.enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {tool.enabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: 30 Agent Execution Logs */}
      {activeTab === 'logs' && (
        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Complete Agent Execution Telemetry ({agentLogs.length} Simulated Runs)
            </h2>
            <span className="text-xs font-mono text-slate-400">Append-Only Runtime Log</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  <th className="py-2 pr-3 font-medium">Log ID</th>
                  <th className="py-2 px-3 font-medium">Timestamp</th>
                  <th className="py-2 px-3 font-medium">Agent</th>
                  <th className="py-2 px-3 font-medium">Trigger</th>
                  <th className="py-2 px-3 font-medium">Task Summary & Output</th>
                  <th className="py-2 px-3 font-medium">Tools Invoked</th>
                  <th className="py-2 pl-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono text-[11px]">
                {agentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3 font-bold text-blue-500 whitespace-nowrap">{log.id}</td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {log.agentName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{log.trigger}</td>
                    <td className="py-2.5 px-3 font-sans max-w-md">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{log.taskSummary}</div>
                      <div className="text-[10px] text-slate-500 truncate">{log.outputPreview}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{log.toolsInvoked.join(', ')}</td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <span
                        className={
                          log.status === 'Success (Simulated)'
                            ? 'text-emerald-500'
                            : 'text-amber-500 font-semibold'
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
      )}
    </div>
  );
};
