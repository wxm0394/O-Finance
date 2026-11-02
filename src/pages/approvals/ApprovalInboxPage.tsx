import React, { useState } from 'react';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { ApprovalTask } from '../../types';
import { formatCurrency } from '../../utils/finance';
import { CheckCircle2, XCircle, Edit3, Eye, X, ShieldAlert } from 'lucide-react';

export const ApprovalInboxPage: React.FC = () => {
  const { approvalTasks, decideApprovalTask } = useOFinance();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Approved' | 'Rejected'>('ALL');
  const [selectedTask, setSelectedTask] = useState<ApprovalTask | null>(null);
  const [editedPayload, setEditedPayload] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const filteredTasks = approvalTasks.filter(
    (t) => statusFilter === 'ALL' || t.status === statusFilter
  );

  const pendingCount = approvalTasks.filter((t) => t.status === 'Pending').length;
  const approvedCount = approvalTasks.filter((t) => t.status === 'Approved').length;
  const rejectedCount = approvalTasks.filter((t) => t.status === 'Rejected').length;

  const openTaskModal = (task: ApprovalTask, editMode = false) => {
    setSelectedTask(task);
    setEditedPayload(task.rawPayload);
    setIsEditing(editMode);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            Human-in-the-Loop Approval Inbox (DEMO)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mandatory operator verification for low-confidence classifications, Beancount journal drafts, duplicate fee alerts, and concentration warnings.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 rounded p-0.5 text-xs font-mono">
          {(['ALL', 'Pending', 'Approved', 'Rejected'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {st} (
              {st === 'ALL'
                ? approvalTasks.length
                : st === 'Pending'
                ? pendingCount
                : st === 'Approved'
                ? approvedCount
                : rejectedCount}
              )
            </button>
          ))}
        </div>
      </div>

      {/* Notice */}
      <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-mono flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>
          DEMO GOVERNANCE NOTICE: Approving or rejecting items below updates O-Finance simulated state and appends an audit record. It never executes real transactions or modifies external accounts.
        </span>
      </div>

      {/* Approval Tasks Table */}
      <div className="rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                <th className="py-2.5 pl-3 pr-2 font-medium">Task ID</th>
                <th className="py-2.5 px-2 font-medium">Source / Task Mode</th>
                <th className="py-2.5 px-2 font-medium">Description & Proposed Action</th>
                <th className="py-2.5 px-2 font-medium text-right">Amount</th>
                <th className="py-2.5 px-1.5 font-medium text-right">Conf.</th>
                <th className="py-2.5 px-2 font-medium">Risk</th>
                <th className="py-2.5 px-2 font-medium">Created</th>
                <th className="py-2.5 px-2 font-medium">Status</th>
                <th className="py-2.5 pl-2 pr-3 font-medium text-right">Human Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pl-3 pr-2 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {task.id}
                  </td>
                  <td className="py-2.5 px-2 whitespace-nowrap">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{task.source}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {task.assistantName} · {task.taskMode}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 max-w-[270px]">
                    <div className="font-semibold text-slate-900 dark:text-white truncate" title={task.title}>
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {task.description}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-right whitespace-nowrap tabular-nums">
                    {task.amount !== undefined && task.currency
                      ? `${formatCurrency(task.amount, task.currency)} ${task.currency}`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-1.5 font-mono text-right whitespace-nowrap tabular-nums">
                    {(task.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[11px] whitespace-nowrap">
                    <span
                      className={
                        task.riskLevel === 'Critical' || task.riskLevel === 'High'
                          ? 'text-rose-600 dark:text-rose-400 font-bold'
                          : task.riskLevel === 'Medium'
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-slate-500'
                      }
                    >
                      {task.riskLevel}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {task.createdAt.slice(5, 16)}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[11px] whitespace-nowrap">
                    <span
                      className={
                        task.status === 'Approved'
                          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                          : task.status === 'Rejected'
                          ? 'text-rose-600 dark:text-rose-400 font-bold'
                          : 'text-amber-600 dark:text-amber-400 font-bold'
                      }
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="py-2.5 pl-2 pr-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {task.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            aria-label={`Approve ${task.id}`}
                            onClick={() => decideApprovalTask(task.id, 'Approved')}
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Reject ${task.id}`}
                            onClick={() => decideApprovalTask(task.id, 'Rejected')}
                            className="px-2 py-1 rounded bg-rose-600/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600/25 text-[11px] font-medium inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => openTaskModal(task, true)}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review / Edit Draft / View Source Modal */}
      {selectedTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Approval Task Inspector"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-700 rounded max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  Review & Edit Draft · {selectedTask.id} ({selectedTask.source})
                </h3>
                <p className="text-[11px] font-mono text-slate-500">
                  Generated by {selectedTask.assistantName} ({selectedTask.taskMode} Mode) · Confidence: {(selectedTask.confidence * 100).toFixed(0)}%
                </p>
              </div>
              <button
                type="button"
                aria-label="Close approval inspector"
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-slate-900 dark:text-white">{selectedTask.title}</div>
              <p className="text-slate-600 dark:text-slate-300">{selectedTask.description}</p>
              <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-mono text-[11px]">
                Proposed Action: {selectedTask.proposedAction}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Draft / Source Payload (Editable before Approval)</span>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>{isEditing ? 'Switch to Read-Only' : 'Enable Edit'}</span>
                </button>
              </div>
              {isEditing ? (
                <textarea
                  aria-label="Editable Draft Payload"
                  rows={5}
                  value={editedPayload}
                  onChange={(e) => setEditedPayload(e.target.value)}
                  className="w-full p-3 rounded bg-slate-950 text-emerald-400 font-mono text-xs border border-slate-700 focus:outline-none focus:border-blue-500"
                />
              ) : (
                <pre className="p-3 rounded bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto">
                  {editedPayload}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  decideApprovalTask(selectedTask.id, 'Rejected', editedPayload);
                  setSelectedTask(null);
                }}
                className="px-3 py-1.5 rounded bg-rose-600/20 border border-rose-500/40 text-rose-500 text-xs font-medium hover:bg-rose-600/30"
              >
                Reject Task (Sim)
              </button>
              <button
                type="button"
                onClick={() => {
                  decideApprovalTask(selectedTask.id, 'Approved', editedPayload);
                  setSelectedTask(null);
                }}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
              >
                Save & Approve Task (Sim)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
