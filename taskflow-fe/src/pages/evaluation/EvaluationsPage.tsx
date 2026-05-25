import React, { useState, useEffect, useCallback } from 'react';
import { Spin, Empty, message } from 'antd';
import { PlusOutlined, CloseOutlined, BarChartOutlined, CheckSquareOutlined, StarOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './EvaluationsPage.scss';

interface EvalData {
  id: number;
  period: string;
  employee_id: number;
  employee_name: string;
  employee_avatar: string;
  employee_color: string;
  employee_department: string;
  total_tasks: number;
  completed_tasks: number;
  on_time_tasks: number;
  on_time_rate: number;
  scores: { quality: number; responsibility: number; communication: number; creativity: number; discipline: number };
  total_score: number;
  comment: string | null;
  status: 'draft' | 'published';
  tasks?: Array<{
    id: number; title: string; project_name: string;
    due_date: string; completed_at: string;
    status: string; status_label: string; is_on_time: boolean;
  }>;
}

const getRating = (score: number, isVi: boolean) => {
  if (score >= 9) return { label: '⭐ Excellent', labelVi: '⭐ Xuất sắc', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (score >= 7) return { label: '✅ Good', labelVi: '✅ Tốt', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
  if (score >= 5) return { label: '🔵 Fair', labelVi: '🔵 Khá', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
  if (score >= 3) return { label: '🟡 Average', labelVi: '🟡 Trung bình', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  return { label: '🔴 Poor', labelVi: '🔴 Yếu', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
};

const getBarColor = (score: number) => {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#3b82f6';
  if (score >= 4) return '#f59e0b';
  return '#ef4444';
};

const EvaluationsPage: React.FC = () => {
  const { t, lang } = useTranslation();
  const isVi = lang === 'vi';

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<EvalData[]>([]);
  const [summary, setSummary] = useState({ total_employees: 0, published: 0, draft: 0, avg_score: 0 });
  const [periods, setPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Drawer state
  const [selected, setSelected] = useState<EvalData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editScores, setEditScores] = useState<Record<string, number>>({});
  const [editComment, setEditComment] = useState('');

  const criteriaLabels: Record<string, string> = {
    quality: isVi ? 'Chất lượng công việc' : 'Quality of Work',
    responsibility: isVi ? 'Tinh thần trách nhiệm' : 'Responsibility',
    communication: isVi ? 'Giao tiếp & phối hợp' : 'Communication & Collab',
    creativity: isVi ? 'Sáng tạo & đề xuất' : 'Creativity & Initiative',
    discipline: isVi ? 'Chấp hành quy định' : 'Discipline & Compliance',
  };

  const fetchEvaluations = useCallback(async (period?: string, status?: string) => {
    try {
      setLoading(true);
      const params: any = {};
      if (period) params.period = period;
      if (status && status !== 'all') params.status = status;
      const res = await api.getEvaluations(params);
      if (res?.success) {
        setEvaluations(res.data || []);
        setSummary(res.summary);
        setPeriods(res.periods || []);
        if (!selectedPeriod && res.current_period) {
          setSelectedPeriod(res.current_period);
        }
      }
    } catch (err) {
      console.error('Evaluations load error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const meRes = await api.getMe();
        if (meRes) {
          setCurrentUser(meRes);
        }
      } catch (err) {
        console.error('Failed to fetch user info', err);
      }
    };
    fetchMe();
  }, []);

  useEffect(() => {
    fetchEvaluations(selectedPeriod, statusFilter);
  }, [selectedPeriod, statusFilter, fetchEvaluations]);

  const handleGenerate = async () => {
    if (!selectedPeriod) return;
    try {
      setGenerating(true);
      const res = await api.generateEvaluations(selectedPeriod);
      if (res?.success) {
        message.success(isVi ? `Đã tạo ${res.created} đánh giá` : `Generated ${res.created} evaluations`);
        fetchEvaluations(selectedPeriod, statusFilter);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error generating evaluations');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectEmployee = async (evalItem: EvalData) => {
    try {
      setDetailLoading(true);
      setSelected(evalItem); // show drawer immediately with list data
      const res = await api.getEvaluation(evalItem.id);
      if (res?.success) {
        setSelected(res.data);
        setEditScores(res.data.scores);
        setEditComment(res.data.comment || '');
      }
    } catch (err) {
      console.error('Evaluation detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!selected) return;
    try {
      setSaving(true);
      const res = await api.updateEvaluation(selected.id, {
        score_quality: editScores.quality,
        score_responsibility: editScores.responsibility,
        score_communication: editScores.communication,
        score_creativity: editScores.creativity,
        score_discipline: editScores.discipline,
        comment: editComment,
        publish,
      });
      if (res?.success) {
        message.success(publish ? t('eval.toast.published') : t('eval.toast.draft_saved'));
        setSelected(null);
        fetchEvaluations(selectedPeriod, statusFilter);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const handleScoreChange = (key: string, value: number) => {
    setEditScores(prev => ({ ...prev, [key]: Math.min(10, Math.max(0, value)) }));
  };

  const filtered = statusFilter === 'all' ? evaluations : evaluations.filter(e => e.status === statusFilter);

  if (loading && evaluations.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="evaluations-page">
      <div className="evaluations-page__header">
        <div>
          <h1>{t('eval.title')}</h1>
          <p>{t('eval.sub_title', { period: selectedPeriod })}</p>
        </div>
        {currentUser?.role !== 'employee' && (
          <button className="evaluations-page__create-btn" onClick={handleGenerate} disabled={generating}>
            <PlusOutlined /> {generating ? (isVi ? 'Đang tạo...' : 'Generating...') : t('eval.new_period')}
          </button>
        )}
      </div>

      <div className="evaluations-page__summary">
        <div className="evaluations-page__summary-card"><div className="value">{summary.total_employees}</div><div className="label">{t('eval.stat.employees')}</div></div>
        <div className="evaluations-page__summary-card"><div className="value" style={{ color: '#22c55e' }}>{summary.published}</div><div className="label">{t('eval.stat.evaluated')}</div></div>
        <div className="evaluations-page__summary-card"><div className="value" style={{ color: '#f59e0b' }}>{summary.draft}</div><div className="label">{t('eval.stat.unevaluated')}</div></div>
        <div className="evaluations-page__summary-card"><div className="value" style={{ color: '#6366f1' }}>{summary.avg_score}</div><div className="label">{t('eval.stat.average')}</div></div>
      </div>

      <div className="evaluations-page__toolbar">
        <select className="evaluations-page__period-select" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="evaluations-page__status-filters">
          {[
            { key: 'all', label: t('eval.filter.all') },
            { key: 'draft', label: t('eval.filter.draft') },
            { key: 'published', label: t('eval.filter.published') }
          ].map((f) => (
            <button key={f.key} className={statusFilter === f.key ? 'active' : ''} onClick={() => setStatusFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="evaluations-page__table">
        <div className="evaluations-page__table-header">
          <span>{t('eval.table.employee')}</span>
          <span>{t('eval.table.completed_tasks')}</span>
          <span>{t('eval.table.on_time')}</span>
          <span>{t('eval.table.suggested_score')}</span>
          <span>{t('eval.table.rating')}</span>
          <span>{t('eval.table.status')}</span>
          <span></span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Empty description={isVi ? 'Chưa có đánh giá. Nhấn "Tạo đánh giá" để bắt đầu.' : 'No evaluations yet. Click "Generate" to start.'} />
          </div>
        ) : (
          filtered.map((e) => {
            const rating = getRating(e.total_score, isVi);
            return (
              <div key={e.id} className="evaluations-page__table-row" onClick={() => handleSelectEmployee(e)}>
                <div className="evaluations-page__emp-info">
                  <div className="avatar" style={{ background: e.employee_color }}>{e.employee_avatar}</div>
                  <div className="info">
                    <div className="name">{e.employee_name}</div>
                    <div className="dept">{e.employee_department || (isVi ? 'Nhân viên' : 'Employee')}</div>
                  </div>
                </div>
                <div className="evaluations-page__task-stat">{e.completed_tasks}<span className="sub">/{e.total_tasks}</span></div>
                <div className={`evaluations-page__ontime ${e.on_time_rate >= 80 ? 'good' : e.on_time_rate >= 60 ? 'average' : 'poor'}`}>{e.on_time_rate}%</div>
                <div className="evaluations-page__score" style={{ color: getBarColor(e.total_score) }}>{e.total_score}</div>
                <div className="evaluations-page__rating"><span style={{ background: rating.bg, color: rating.color }}>{isVi ? rating.labelVi : rating.label}</span></div>
                <div className="evaluations-page__eval-status">
                  <span className={e.status}>{e.status === 'draft' ? t('eval.filter.draft') : t('eval.filter.published')}</span>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: '#6366f1', fontWeight: 500 }}>{t('eval.table.action')} →</div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <>
          <div className="evaluations-page__backdrop" onClick={() => setSelected(null)} />
          <div className="evaluations-page__drawer">
            <div className="evaluations-page__drawer-header">
              <h2>{t('eval.drawer.title', { name: selected.employee_name })}</h2>
              <button className="close-btn" onClick={() => setSelected(null)}><CloseOutlined /></button>
            </div>
            <div className="evaluations-page__drawer-body">
              {detailLoading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><Spin /></div>
              ) : (
                <>
                  {/* Task Stats */}
                  <div className="evaluations-page__section">
                    <h3><BarChartOutlined className="icon" /> {t('eval.drawer.stats')}</h3>
                    <div className="evaluations-page__task-summary">
                      <div className="box"><div className="num" style={{ color: 'var(--text-primary)' }}>{selected.total_tasks}</div><div className="lbl">{t('eval.drawer.total_tasks')}</div></div>
                      <div className="box"><div className="num" style={{ color: '#22c55e' }}>{selected.completed_tasks}</div><div className="lbl">{t('eval.drawer.completed')}</div></div>
                      <div className="box"><div className="num" style={{ color: '#3b82f6' }}>{selected.on_time_tasks}</div><div className="lbl">{t('eval.drawer.on_time')}</div></div>
                      <div className="box"><div className="num" style={{ color: '#ef4444' }}>{selected.total_tasks - selected.completed_tasks}</div><div className="lbl">{t('eval.drawer.unfinished')}</div></div>
                    </div>
                    {selected.tasks && selected.tasks.length > 0 && (
                      <table className="evaluations-page__task-table">
                        <thead>
                          <tr>
                            <th>{t('eval.drawer.table.task')}</th>
                            <th>{t('eval.drawer.table.deadline')}</th>
                            <th>{t('eval.drawer.table.completed_at')}</th>
                            <th>{t('eval.drawer.table.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.tasks.map((tItem) => (
                            <tr key={tItem.id}>
                              <td>{tItem.title}</td>
                              <td>{tItem.due_date || '—'}</td>
                              <td>{tItem.completed_at || '—'}</td>
                              <td>
                                <span className="status-chip">
                                  <span className="dot" style={{ background: tItem.is_on_time ? '#22c55e' : '#ef4444' }} />
                                  {tItem.status_label}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Criteria */}
                  <div className="evaluations-page__section">
                    <h3><StarOutlined className="icon" /> {t('eval.drawer.criteria')}</h3>
                    {Object.entries(editScores).map(([key, val]) => (
                      <div key={key} className="evaluations-page__criteria-item">
                        <div className="evaluations-page__criteria-item-header">
                          <span className="label">{criteriaLabels[key] || key}</span>
                          {selected.status === 'draft' ? (
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={val}
                              onChange={(e) => handleScoreChange(key, parseFloat(e.target.value) || 0)}
                              className="score-input"
                              style={{ width: 50, textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--divider)', borderRadius: 4, color: getBarColor(val), fontWeight: 600, fontSize: 13 }}
                            />
                          ) : (
                            <span className="score" style={{ color: getBarColor(val) }}>{val}/10</span>
                          )}
                        </div>
                        <div className="evaluations-page__criteria-item-bar">
                          <div className="evaluations-page__criteria-item-bar-fill" style={{ width: `${val * 10}%`, background: getBarColor(val) }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Score */}
                  <div className="evaluations-page__section">
                    <h3><CheckSquareOutlined className="icon" /> {t('eval.drawer.result')}</h3>
                    <div className="evaluations-page__total-score">
                      <div className="score">{selected.total_score}<span>/10</span></div>
                      {(() => {
                        const r = getRating(selected.total_score, isVi);
                        return <div className="rating" style={{ background: r.bg, color: r.color }}>{isVi ? r.labelVi : r.label}</div>;
                      })()}
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="evaluations-page__section">
                    <h3>{t('eval.drawer.comment')}</h3>
                    <div className={`evaluations-page__comment-box ${selected.status === 'draft' ? 'editable' : ''}`}>
                      {selected.status === 'draft' ? (
                        <textarea
                          placeholder={t('eval.drawer.comment_placeholder')}
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                        />
                      ) : (
                        <p>{selected.comment || t('eval.drawer.no_comment')}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {selected.status === 'draft' && (
              <div className="evaluations-page__drawer-footer">
                <button className="btn draft" disabled={saving} onClick={() => handleSave(false)}>{t('eval.drawer.save_draft')}</button>
                <button className="btn publish" disabled={saving} onClick={() => handleSave(true)}>{t('eval.drawer.publish')}</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EvaluationsPage;
