import React, { useState, useEffect } from 'react';
import { message, Spin } from 'antd';
import { useTranslation } from '../../utils/i18n';
import api from '../../services/api';
import { WorkflowToolbar } from './WorkflowToolbar';
import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowSidebar } from './WorkflowSidebar';
import { WorkflowRulesModal } from './WorkflowRulesModal';
import './workflow.scss';

interface Status {
  id: string;
  name: string;
  color: string;
  type?: 'not_started' | 'active' | 'closed' | 'done';
}

interface Member {
  id: string | number;
  name: string;
  photo?: string;
  email?: string;
}

interface Project {
  id: string | number;
  name: string;
  statuses: Status[];
  members?: Member[];
  labels?: any[];
}

interface Transition {
  id: string;
  name: string;
  from: string;
  to: string;
  allowed_roles: string[];
  rules?: any[];
}

interface GlobalTransition {
  id: string;
  name: string;
  to: string;
  allowed_roles: string[];
  rules?: any[];
}

interface Position {
  x: number;
  y: number;
}

interface WorkflowEditorProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  project,
  open,
  onClose,
  onSaved
}) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<'unrestricted' | 'restricted'>('restricted');
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [globalTransitions, setGlobalTransitions] = useState<GlobalTransition[]>([]);
  const [nodePositions, setNodePositions] = useState<Record<string, Position>>({});
  const [initialStatusId, setInitialStatusId] = useState<string>('');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);

  const [isAddingTransition, setIsAddingTransition] = useState(false);
  const [addingTransitionFromId, setAddingTransitionFromId] = useState<string | null>(null);

  // Canvas display controls
  const [showTransitionLabels, setShowTransitionLabels] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Rules Modal States
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesModalTargetId, setRulesModalTargetId] = useState<string | null>(null);
  const [rulesModalTargetIsGlobal, setRulesModalTargetIsGlobal] = useState(false);
  const [editRuleIndex, setEditRuleIndex] = useState<number | null>(null);

  // Load workflow from server when component is opened
  useEffect(() => {
    if (!open || !project) return;

    const loadWorkflow = async () => {
      setLoading(true);
      try {
        const res = await api.getWorkflow(project.id);
        const wf = res.data?.workflow || res.data;

        if (wf) {
          setWorkflowMode('restricted');
          setTransitions(wf.transitions || []);
          setGlobalTransitions(wf.global_transitions || []);

          // Use the saved initial status; only fallback to first status if none set
          const dbInitialStatus = wf.initial_status
            ? String(wf.initial_status)
            : (project.statuses[0]?.id ? String(project.statuses[0].id) : '');
          setInitialStatusId(dbInitialStatus);

          // Build or reuse node coordinates
          const dbPositions = wf.node_positions || {};
          const newPositions: Record<string, Position> = { ...dbPositions };

          // Categories mapping for grid positioning
          const notStartedList = project.statuses.filter(s => s.type === 'not_started');
          const activeList = project.statuses.filter(s => s.type === 'active' || !s.type);
          const closedList = project.statuses.filter(s => s.type === 'closed' || s.type === 'done');

          project.statuses.forEach((s) => {
            if (!newPositions[s.id]) {
              if (s.type === 'not_started') {
                const idx = notStartedList.findIndex(ns => ns.id === s.id);
                newPositions[s.id] = { x: 180, y: 120 + idx * 120 };
              } else if (s.type === 'closed' || s.type === 'done') {
                const idx = closedList.findIndex(cl => cl.id === s.id);
                newPositions[s.id] = { x: 660, y: 120 + idx * 120 };
              } else {
                const idx = activeList.findIndex(ac => ac.id === s.id);
                newPositions[s.id] = { x: 420, y: 120 + idx * 120 };
              }
            }
          });

          // Ensure START node position exists
          if (!newPositions['__start__']) {
            const initPos = newPositions[dbInitialStatus] || { x: 180, y: 120 };
            newPositions['__start__'] = { x: Math.max(20, initPos.x - 100), y: initPos.y };
          }

          setNodePositions(newPositions);
        }
      } catch (err) {
        console.error('Failed to load project workflow', err);
        message.error(t('workflow.toast.load_error'));
      } finally {
        setLoading(false);
      }
    };

    loadWorkflow();
  }, [open, project]);

  // Adjust START node position when initialStatus changes
  useEffect(() => {
    if (initialStatusId && nodePositions[initialStatusId]) {
      const initPos = nodePositions[initialStatusId];
      setNodePositions(prev => ({
        ...prev,
        '__start__': {
          x: Math.max(20, initPos.x - 100),
          y: initPos.y + 2
        }
      }));
    }
  }, [initialStatusId]);

  if (!open || !project) return null;

  // Handle preset applications
  const handleApplyPreset = (type: 'all' | 'linear' | 'linear_back' | 'clear') => {
    const statuses = project.statuses;
    if (type === 'clear') {
      setTransitions([]);
      setGlobalTransitions([]);
      message.info(t('workflow.toast.clear_success'));
      return;
    }

    if (type === 'all') {
      const all: Transition[] = [];
      statuses.forEach((from) => {
        statuses.forEach((to) => {
          if (from.id !== to.id) {
            all.push({
              id: `t_${from.id}_${to.id}`,
              name: to.name,
              from: from.id,
              to: to.id,
              allowed_roles: []
            });
          }
        });
      });
      setTransitions(all);
      setGlobalTransitions([]);
      message.success(t('workflow.toast.preset_all_success'));
      return;
    }

    if (type === 'linear') {
      const linear: Transition[] = [];
      for (let i = 0; i < statuses.length - 1; i++) {
        linear.push({
          id: `t_${statuses[i].id}_${statuses[i + 1].id}`,
          name: statuses[i + 1].name,
          from: statuses[i].id,
          to: statuses[i + 1].id,
          allowed_roles: []
        });
      }
      setTransitions(linear);
      setGlobalTransitions([]);
      message.success(t('workflow.toast.preset_linear_success'));
      return;
    }

    if (type === 'linear_back') {
      const bidir: Transition[] = [];
      for (let i = 0; i < statuses.length - 1; i++) {
        bidir.push({
          id: `t_${statuses[i].id}_${statuses[i + 1].id}`,
          name: statuses[i + 1].name,
          from: statuses[i].id,
          to: statuses[i + 1].id,
          allowed_roles: []
        });
        bidir.push({
          id: `t_${statuses[i + 1].id}_${statuses[i].id}`,
          name: statuses[i].name,
          from: statuses[i + 1].id,
          to: statuses[i].id,
          allowed_roles: []
        });
      }
      setTransitions(bidir);
      setGlobalTransitions([]);
      message.success(t('workflow.toast.preset_linear_back_success'));
      return;
    }
  };

  // Node Drag
  const handleNodeDrag = (nodeId: string, pos: Position) => {
    setNodePositions(prev => ({
      ...prev,
      [nodeId]: pos
    }));
  };

  // Selection handlers
  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
      setSelectedTransitionId(null);
      setLastSelectedNodeId(id);
    }
  };

  const handleSelectTransition = (id: string | null, fromCanvas?: boolean) => {
    setSelectedTransitionId(id);
    if (id) {
      setSelectedNodeId(null);
      if (fromCanvas) {
        setLastSelectedNodeId(null);
      }
    }
  };

  // Node connection handler
  const handleAddTransitionSelect = (statusId: string) => {
    if (statusId === '__start__') {
      message.warning(t('workflow.toast.start_node_no_transition'));
      setAddingTransitionFromId(null);
      setIsAddingTransition(false);
      return;
    }

    if (!addingTransitionFromId) {
      setAddingTransitionFromId(statusId);
    } else {
      const from = addingTransitionFromId;
      const to = statusId;

      if (from === to) {
        message.warning(t('workflow.toast.no_self_loop'));
        setAddingTransitionFromId(null);
        setIsAddingTransition(false);
        return;
      }

      // Check duplicate
      const exists = transitions.some(tr => tr.from === from && tr.to === to);
      if (exists) {
        message.warning(t('workflow.toast.already_exists'));
        setAddingTransitionFromId(null);
        setIsAddingTransition(false);
        return;
      }

      const newTr: Transition = {
        id: `t_${Date.now()}`,
        name: '',
        from,
        to,
        allowed_roles: [],
        rules: []
      };

      setTransitions(prev => [...prev, newTr]);
      setAddingTransitionFromId(null);
      setIsAddingTransition(false);
      handleSelectTransition(newTr.id);
      message.success(t('workflow.toast.created_success'));
    }
  };

  // Sidebar transition actions
  const handleUpdateTransition = (id: string, updated: Partial<Transition>) => {
    setTransitions(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
  };

  const handleDeleteTransition = (id: string, silent?: boolean) => {
    setTransitions(prev => prev.filter(t => t.id !== id));
    setSelectedTransitionId(null);
    if (!silent) {
      message.info(t('workflow.toast.deleted_success'));
    }
  };

  // Global transition actions
  const handleUpdateGlobalTransition = (id: string, updated: Partial<GlobalTransition>) => {
    setGlobalTransitions(prev => prev.map(gt => gt.id === id ? { ...gt, ...updated } : gt));
  };

  const handleDeleteGlobalTransition = (id: string, silent?: boolean) => {
    setGlobalTransitions(prev => prev.filter(gt => gt.id !== id));
    setSelectedTransitionId(null);
    if (!silent) {
      message.info(t('workflow.toast.global_deleted_success'));
    }
  };

  const handleAddGlobalTransition = (toId: string) => {
    const exists = globalTransitions.some(gt => gt.to === toId);
    if (exists) {
      message.warning(t('workflow.toast.global_exists'));
      return;
    }

    const newGt: GlobalTransition = {
      id: `gt_${Date.now()}`,
      name: '',
      to: toId,
      allowed_roles: [],
      rules: []
    };

    setGlobalTransitions(prev => [...prev, newGt]);
    handleSelectTransition(newGt.id);
    message.success(t('workflow.toast.global_created_success'));
  };

  // Rule additions/deletions
  const handleOpenRulesModal = (transitionId: string, isGlobal: boolean, ruleIndex: number | null = null) => {
    setRulesModalTargetId(transitionId);
    setRulesModalTargetIsGlobal(isGlobal);
    setEditRuleIndex(ruleIndex);
    setRulesModalOpen(true);
  };

  const handleAddRule = (type: string, config: any, editIndex?: number | null) => {
    if (!rulesModalTargetId) return;

    const newRule = { type, config };

    if (rulesModalTargetIsGlobal) {
      setGlobalTransitions(prev => prev.map(gt => {
        if (gt.id === rulesModalTargetId) {
          const currentRules = gt.rules || [];
          let updatedRules;
          if (editIndex !== null && editIndex !== undefined && editIndex >= 0) {
            updatedRules = currentRules.map((r, idx) => idx === editIndex ? newRule : r);
          } else {
            updatedRules = [...currentRules, newRule];
          }
          return { ...gt, rules: updatedRules };
        }
        return gt;
      }));
    } else {
      setTransitions(prev => prev.map(t => {
        if (t.id === rulesModalTargetId) {
          const currentRules = t.rules || [];
          let updatedRules;
          if (editIndex !== null && editIndex !== undefined && editIndex >= 0) {
            updatedRules = currentRules.map((r, idx) => idx === editIndex ? newRule : r);
          } else {
            updatedRules = [...currentRules, newRule];
          }
          return { ...t, rules: updatedRules };
        }
        return t;
      }));
    }

    if (editIndex !== null && editIndex !== undefined && editIndex >= 0) {
      message.success(t('workflow.toast.rule_updated'));
    } else {
      message.success(t('workflow.toast.rule_created'));
    }
  };

  const handleDeleteRule = (transitionId: string, ruleIndex: number, isGlobal: boolean) => {
    if (isGlobal) {
      setGlobalTransitions(prev => prev.map(gt => {
        if (gt.id === transitionId) {
          const currentRules = gt.rules || [];
          return { ...gt, rules: currentRules.filter((_, idx) => idx !== ruleIndex) };
        }
        return gt;
      }));
    } else {
      setTransitions(prev => prev.map(t => {
        if (t.id === transitionId) {
          const currentRules = t.rules || [];
          return { ...t, rules: currentRules.filter((_, idx) => idx !== ruleIndex) };
        }
        return t;
      }));
    }
    message.info(t('workflow.toast.rule_deleted'));
  };

  // Save changes
  const handleSave = async () => {
    const hasUnnamedTransition = transitions.some(tr => !tr.name || tr.name.trim() === '');

    if (hasUnnamedTransition) {
      message.error(t('workflow.toast.name_required'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        mode: workflowMode,
        initial_status: initialStatusId,
        node_positions: nodePositions,
        transitions: transitions,
        global_transitions: globalTransitions
      };

      const res = await api.updateWorkflow(project.id, payload);
      message.success(t('workflow.save_success'));

      // Update state from server response — no reload, drawer stays open
      const savedWf = res.data?.data?.workflow;
      if (savedWf) {
        if (savedWf.initial_status) setInitialStatusId(String(savedWf.initial_status));
        if (savedWf.transitions) setTransitions(savedWf.transitions);
        if (savedWf.global_transitions) setGlobalTransitions(savedWf.global_transitions);
        if (savedWf.node_positions) setNodePositions(savedWf.node_positions);
      }

      // Notify parent that workflow changed (e.g., to refresh project data outside)
      onSaved();
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || t('workflow.save_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workflow-editor-modal">
      <WorkflowToolbar
        projectName={project.name}
        workflowMode={workflowMode}
        setWorkflowMode={(mode) => {
          setWorkflowMode(mode);
          if (mode === 'restricted' && transitions.length === 0) {
            handleApplyPreset('all');
          }
        }}
        isAddingTransition={isAddingTransition}
        setIsAddingTransition={(active) => {
          setIsAddingTransition(active);
          if (!active) setAddingTransitionFromId(null);
        }}
        onApplyPreset={handleApplyPreset}
        onSave={handleSave}
        onDiscard={onClose}
        t={t}
      />

      <div className="workflow-workspace">
        {/* Canvas Controls Bar — floats bottom-left over the canvas */}
        <div className="workflow-canvas-controls">
          <button
            className="wf-ctrl-btn wf-help-btn"
            onClick={() => setShowHelpModal(true)}
            title={t('workflow.help.title') || 'Hướng dẫn sử dụng'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              {/* ? mark via path */}
              <path d="M6.5 6.2a1.5 1.5 0 012.8.8c0 .8-.8 1.2-1.3 1.7V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="8" cy="11.5" r="0.7" fill="currentColor"/>
            </svg>
          </button>

          <label className="wf-ctrl-label">
            <input
              type="checkbox"
              checked={showTransitionLabels}
              onChange={e => setShowTransitionLabels(e.target.checked)}
              style={{ accentColor: '#6366f1', width: 14, height: 14, cursor: 'pointer' }}
            />
            <span>{t('workflow.show_labels') || 'Hiển thị nhãn transition'}</span>
          </label>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-body)' }}>
            <Spin size="large" description={t('workflow.toast.loading_diagram')} />
          </div>
        ) : (
          <WorkflowCanvas
            statuses={project.statuses}
            transitions={transitions}
            globalTransitions={globalTransitions}
            initialStatusId={initialStatusId}
            nodePositions={nodePositions}
            onNodeDrag={handleNodeDrag}
            selectedNodeId={selectedNodeId}
            selectedTransitionId={selectedTransitionId}
            onSelectNode={handleSelectNode}
            onSelectTransition={handleSelectTransition}
            isAddingTransition={isAddingTransition}
            addingTransitionFromId={addingTransitionFromId}
            onAddTransitionSelect={handleAddTransitionSelect}
            showTransitionLabels={showTransitionLabels}
            t={t}
          />
        )}

        <WorkflowSidebar
          selectedNodeId={selectedNodeId}
          selectedTransitionId={selectedTransitionId}
          lastSelectedNodeId={lastSelectedNodeId}
          statuses={project.statuses}
          members={project.members}
          projectLabels={project.labels}
          transitions={transitions}
          globalTransitions={globalTransitions}
          initialStatusId={initialStatusId}
          setInitialStatusId={setInitialStatusId}
          onUpdateTransition={handleUpdateTransition}
          onDeleteTransition={handleDeleteTransition}
          onUpdateGlobalTransition={handleUpdateGlobalTransition}
          onDeleteGlobalTransition={handleDeleteGlobalTransition}
          onAddTransitionClick={(fromId) => {
            setIsAddingTransition(true);
            setAddingTransitionFromId(fromId);
          }}
          onAddGlobalTransition={handleAddGlobalTransition}
          onOpenRulesModal={handleOpenRulesModal}
          onDeleteRule={handleDeleteRule}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedTransitionId(null);
            setLastSelectedNodeId(null);
          }}
          t={t}
          onSelectNode={handleSelectNode}
          onSelectTransition={handleSelectTransition}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        />
      </div>

      {/* Rules Selection & Configuration Modal */}
      <WorkflowRulesModal
        open={rulesModalOpen}
        onClose={() => {
          setRulesModalOpen(false);
          setEditRuleIndex(null);
        }}
        onAddRule={handleAddRule}
        statuses={project.statuses}
        members={project.members}
        projectLabels={project.labels}
        t={t}
        existingRules={
          rulesModalTargetIsGlobal
            ? globalTransitions.find(gt => gt.id === rulesModalTargetId)?.rules || []
            : transitions.find(t => t.id === rulesModalTargetId)?.rules || []
        }
        editRuleIndex={editRuleIndex}
      />

      {/* Help Modal */}
      {showHelpModal && (
        <div className="wf-help-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="wf-help-modal" onClick={e => e.stopPropagation()}>
            <div className="wf-help-modal__header">
              <h3>{t('workflow.help.title') || 'Cách sử dụng sơ đồ Workflow'}</h3>
              <button className="wf-help-modal__close" onClick={() => setShowHelpModal(false)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="wf-help-modal__body">
              {[
                {
                  // Add status: rectangle node + plus badge
                  icon: (
                    <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
                      <rect x="4" y="9" width="36" height="18" rx="5" fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth="1.5"/>
                      <rect x="10" y="15" width="18" height="2.5" rx="1.2" fill="#6366f1" opacity="0.6"/>
                      <rect x="10" y="20" width="12" height="2.5" rx="1.2" fill="#6366f1" opacity="0.35"/>
                      <circle cx="40" cy="9" r="6" fill="#6366f1"/>
                      <path d="M40 6v6M37 9h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  ),
                  title: t('workflow.help.add_status.title'),
                  desc: t('workflow.help.add_status.desc')
                },
                {
                  // 1. Add transition via toolbar
                  icon: (
                    <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
                      {/* Toolbar button */}
                      <rect x="11" y="2" width="26" height="12" rx="3" fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth="1.3"/>
                      <path d="M17 8h4M25 8h4" stroke="#6366f1" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M22 6l2 2-2 2" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      {/* Arrow from node A to node B */}
                      <rect x="1" y="20" width="16" height="13" rx="3" fill="rgba(99,102,241,0.1)" stroke="#6366f1" strokeWidth="1"/>
                      <rect x="31" y="20" width="16" height="13" rx="3" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth="1"/>
                      <path d="M17 26.5H31" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M28 23.5L32 26.5l-4 3" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      {/* Step numbers */}
                      <circle cx="9" cy="26.5" r="4" fill="#6366f1"/>
                      <rect x="7.5" y="25" width="3" height="3" rx="0.5" fill="white" opacity="0.9"/>
                      <circle cx="39" cy="26.5" r="4" fill="#10b981"/>
                      <rect x="37.5" y="25" width="3" height="3" rx="0.5" fill="white" opacity="0.9"/>
                    </svg>
                  ),
                  title: t('workflow.help.add_transition.title'),
                  desc: t('workflow.help.add_transition.desc')
                },
                {
                  // 2. Preset / quick-create
                  icon: (
                    <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
                      {/* Lightning bolt = preset */}
                      <circle cx="24" cy="18" r="14" fill="rgba(245,158,11,0.1)" stroke="#f59e0b" strokeWidth="1.3"/>
                      <path d="M26 8l-6 10h6l-2 10 8-12h-6l2-8z" fill="#f59e0b" opacity="0.85"/>
                    </svg>
                  ),
                  title: t('workflow.help.preset.title'),
                  desc: t('workflow.help.preset.desc')
                },
                {
                  // 3. Click to inspect
                  icon: (
                    <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
                      <rect x="8" y="9" width="32" height="18" rx="5" fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth="2"/>
                      <rect x="6" y="7" width="36" height="22" rx="6" stroke="#6366f1" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.5"/>
                      {/* Cursor pointer */}
                      <path d="M27 20l4 8 2-2 3 3 2-2-3-3 2-2-10-4z" fill="#6366f1" opacity="0.8" stroke="#6366f1" strokeWidth="0.5" strokeLinejoin="round"/>
                    </svg>
                  ),
                  title: t('workflow.help.edit.title'),
                  desc: t('workflow.help.edit.desc')
                },
                {
                  // 4. Drag to move
                  icon: (
                    <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
                      <rect x="13" y="11" width="22" height="14" rx="4" fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1.5"/>
                      <path d="M24 7l-2.5 3.5h5L24 7z" fill="#f59e0b"/>
                      <path d="M24 29l-2.5-3.5h5L24 29z" fill="#f59e0b"/>
                      <path d="M7 18l3.5-2.5v5L7 18z" fill="#f59e0b"/>
                      <path d="M41 18l-3.5-2.5v5L41 18z" fill="#f59e0b"/>
                      <circle cx="24" cy="18" r="2" fill="#f59e0b" opacity="0.6"/>
                    </svg>
                  ),
                  title: t('workflow.help.move.title'),
                  desc: t('workflow.help.move.desc')
                },
                {
                  // 5. Global transition from sidebar
                  icon: (
                    <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
                      <rect x="1" y="3" width="12" height="10" rx="3" fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth="1"/>
                      <rect x="1" y="23" width="12" height="10" rx="3" fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth="1"/>
                      <rect x="15" y="13" width="12" height="10" rx="3" fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth="1"/>
                      <path d="M13 8L32 18" stroke="#6366f1" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.7"/>
                      <path d="M13 28L32 18" stroke="#6366f1" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.7"/>
                      <path d="M27 18H32" stroke="#6366f1" strokeWidth="1" opacity="0.7"/>
                      <rect x="32" y="11" width="15" height="14" rx="4" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1.5"/>
                      <path d="M39.5 14l1.2 3h3l-2.4 1.8 1 3-2.8-1.8-2.8 1.8 1-3L36.3 17h3l1.2-3z" fill="#10b981" opacity="0.85"/>
                    </svg>
                  ),
                  title: t('workflow.help.global.title'),
                  desc: t('workflow.help.global.desc')
                },
                {
                  // 6. Rules from transition sidebar
                  icon: (
                    <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
                      <rect x="1" y="11" width="14" height="14" rx="4" fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth="1.3"/>
                      <rect x="33" y="11" width="14" height="14" rx="4" fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth="1.3"/>
                      <path d="M15 18H33" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M29.5 14.5L34 18l-4.5 3.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      <rect x="19" y="13" width="10" height="10" rx="3" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.2"/>
                      <path d="M22 18v-2a2 2 0 014 0v2" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
                      <rect x="21.5" y="18" width="5" height="3.5" rx="1.2" fill="#ef4444" opacity="0.7"/>
                    </svg>
                  ),
                  title: t('workflow.help.rules.title'),
                  desc: t('workflow.help.rules.desc')
                },
              ].map((item, i) => (
                <div className="wf-help-item" key={i}>
                  <div className="wf-help-item__icon">{item.icon}</div>
                  <div className="wf-help-item__content">
                    <div className="wf-help-item__title">{item.title}</div>
                    <div className="wf-help-item__desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="wf-help-modal__footer">
              <button className="wf-help-close-btn" onClick={() => setShowHelpModal(false)}>
                {t('common.close') || 'Đóng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
