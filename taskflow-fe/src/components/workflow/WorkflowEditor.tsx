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

          const dbInitialStatus = wf.initial_status || project.statuses[0]?.id || '';
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

      await api.updateWorkflow(project.id, payload);
      message.success(t('workflow.save_success'));
      onSaved();
      onClose();
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
    </div>
  );
};
