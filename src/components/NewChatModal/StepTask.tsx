import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Check,
  Zap,
  GitBranch,
  GitFork,
  ChevronDown,
  ChevronRight,
  Settings2,
  FolderOpen,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { AgentProvider } from '@/types/electron';
import OrchestratorModeToggle from './OrchestratorModeToggle';

interface StepTaskProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  selectedSkills: string[];
  useWorktree: boolean;
  onToggleWorktree: () => void;
  branchName: string;
  onBranchNameChange: (name: string) => void;
  skipPermissions: boolean;
  onToggleSkipPermissions: () => void;
  isOrchestrator: boolean;
  onOrchestratorToggle: (enabled: boolean) => void;
  // Summary data
  projectPath: string;
  provider: AgentProvider;
  model: string;
  selectedObsidianVaults: string[];
}

const StepTask = React.memo(function StepTask({
  prompt,
  onPromptChange,
  selectedSkills,
  useWorktree,
  onToggleWorktree,
  branchName,
  onBranchNameChange,
  skipPermissions,
  onToggleSkipPermissions,
  isOrchestrator,
  onOrchestratorToggle,
  projectPath,
  provider,
  model,
  selectedObsidianVaults,
}: StepTaskProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div>
        <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-accent-green" />
          Define Task
        </h3>
        <p className="text-text-secondary text-sm">
          Describe the task or leave empty to start an interactive session
        </p>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium mb-2">
          What should this agent do?
          <span className="text-text-muted font-normal ml-1">(optional)</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe the task, or leave empty to start an interactive session"
          rows={4}
          className="w-full px-4 py-3 rounded-lg text-sm resize-none"
        />
        {selectedSkills.length > 0 && !prompt && (
          <p className="text-xs text-accent-purple mt-2">
            Agent will start with selected skills: {selectedSkills.slice(0, 3).join(', ')}{selectedSkills.length > 3 ? ` +${selectedSkills.length - 3} more` : ''}
          </p>
        )}
      </div>

      {/* Advanced Options (collapsible) */}
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setShowAdvanced(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 hover:bg-secondary/80 transition-colors"
        >
          <span className="font-medium text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-text-muted" />
            Advanced Options
          </span>
          {showAdvanced ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4 border-t border-border">
                {/* Git Worktree Option */}
                <div className="p-3 rounded-lg border border-border-primary bg-bg-tertiary/30">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={onToggleWorktree}
                      className={`
                        mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0
                        ${useWorktree
                          ? 'bg-accent-purple border-accent-purple'
                          : 'border-border-primary hover:border-accent-purple'
                        }
                      `}
                    >
                      {useWorktree && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <GitFork className="w-4 h-4 text-accent-purple" />
                        <span className="font-medium text-sm">Use Git Worktree</span>
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Create an isolated branch for this agent
                      </p>

                      <AnimatePresence>
                        {useWorktree && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-border-primary">
                              <label className="block text-xs font-medium mb-2 flex items-center gap-2">
                                <GitBranch className="w-3.5 h-3.5 text-accent-blue" />
                                Branch Name
                              </label>
                              <input
                                type="text"
                                value={branchName}
                                onChange={(e) => onBranchNameChange(e.target.value.replace(/\s+/g, '-'))}
                                placeholder="feature/my-task"
                                className="w-full px-3 py-2 rounded-lg text-sm font-mono bg-bg-primary border border-border-primary focus:border-accent-blue focus:outline-none"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Skip Permissions */}
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={onToggleSkipPermissions}
                      className={`
                        mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0
                        ${skipPermissions
                          ? 'bg-amber-500 border-amber-500'
                          : 'border-amber-500/50 hover:border-amber-500'
                        }
                      `}
                    >
                      {skipPermissions && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="font-medium text-sm">Skip Permission Prompts</span>
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Run without asking for permission — the agent will have full autonomy
                      </p>
                    </div>
                  </div>
                </div>

                {/* Orchestrator Mode */}
                <OrchestratorModeToggle
                  isOrchestrator={isOrchestrator}
                  onToggle={onOrchestratorToggle}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Summary Card */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Summary</span>
        <div className="space-y-1.5">
          <SummaryRow icon={<FolderOpen className="w-3.5 h-3.5" />} label="Project" value={projectPath.split('/').pop() || projectPath} />
          <SummaryRow icon={<Sparkles className="w-3.5 h-3.5" />} label="Model" value={`${provider} / ${model}`} />
          {selectedSkills.length > 0 && (
            <SummaryRow icon={<Zap className="w-3.5 h-3.5" />} label="Skills" value={`${selectedSkills.length} selected`} />
          )}
          {selectedObsidianVaults.length > 0 && (
            <SummaryRow icon={<BookOpen className="w-3.5 h-3.5" />} label="Vaults" value={`${selectedObsidianVaults.length + 1} sources`} />
          )}
          {useWorktree && branchName && (
            <SummaryRow icon={<GitBranch className="w-3.5 h-3.5" />} label="Branch" value={branchName} mono />
          )}
        </div>
      </div>
    </div>
  );
});

function SummaryRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={`truncate max-w-[200px] ${mono ? 'font-mono text-accent-purple' : ''}`}>{value}</span>
    </div>
  );
}

export default StepTask;
