import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, Legend } from 'recharts';
import { DownloadOutlined, RiseOutlined, DashboardOutlined, FieldTimeOutlined, HourglassOutlined, FireOutlined } from '@ant-design/icons';
import { Spin, Empty, message, Progress } from 'antd';
import api from '../../services/api';
import { useTranslation } from '../../utils/i18n';
import './AnalyticsPage.scss';

interface AnalyticsData {
  task_overview: Array<{ name: string; value: number; color: string }>;
  total_tasks: number;
  priority_dist: Array<{ name: string; count: number; color: string }>;
  completion_trend: Array<{ week: string; completed: number; created: number }>;
  workload: Array<{ name: string; tasks: number; color: string }>;
  team_performance: Array<{
    name: string;
    avatar: string;
    color: string;
    total: number;
    completed: number;
    on_time: number;
    avg_time: string;
  }>;
  projects: Array<{ id: number; name: string; color: string }>;
  process_performance?: {
    cycle_time_avg: number;
    lead_time_avg: number;
    throughput_weekly_avg: number;
    wip_count: number;
    throughput_trend: Array<{ week: string; throughput: number }>;
    cycle_time_trend: Array<{ week: string; avg_days: number }>;
  };
}

const AnalyticsPage: React.FC = () => {
  const { t, lang, locale } = useTranslation();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'performance'>('overview');

  // Milestone burndown states
  const [milestones, setMilestones] = useState<any[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<string>('');
  const [burndownData, setBurndownData] = useState<any[]>([]);
  const [burndownLoading, setBurndownLoading] = useState<boolean>(false);
  const [burndownUnit, setBurndownUnit] = useState<'tasks' | 'hours'>('tasks');

  const statusLabels: Record<string, string> = {
    done: t('tasks.status.done'),
    in_progress: t('tasks.status.in_progress'),
    review: t('tasks.status.in_review'),
    todo: t('tasks.status.todo'),
    overdue: t('dashboard.overdue'),
  };

  const priorityLabels: Record<string, string> = {
    urgent: t('tasks.priority.urgent'),
    high: t('tasks.priority.high'),
    medium: t('tasks.priority.medium'),
    low: t('tasks.priority.low'),
    none: t('tasks.priority.none'),
  };

  const fetchData = useCallback(async (projId: string) => {
    try {
      setLoading(true);
      const params = projId !== 'all' ? { project_id: projId } : undefined;
      const res = await api.getAnalyticsData(params);
      if (res?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Analytics load error:', err);
      message.error(t('analytics.load_err'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData(projectFilter);
  }, [projectFilter, fetchData]);

  // Load project milestones when projectFilter changes
  useEffect(() => {
    if (projectFilter !== 'all') {
      api.getProjectMilestones(projectFilter)
        .then((res) => {
          if (res?.success) {
            const list = res.data || [];
            setMilestones(list);
            const activeMilestone = list.find((m: any) => m.status === 'active') || list[0];
            if (activeMilestone) {
              setSelectedMilestone(String(activeMilestone.id));
            } else {
              setSelectedMilestone('');
              setBurndownData([]);
            }
          }
        })
        .catch((err) => {
          console.error('Error loading milestones:', err);
          setMilestones([]);
          setSelectedMilestone('');
          setBurndownData([]);
        });
    } else {
      setMilestones([]);
      setSelectedMilestone('');
      setBurndownData([]);
    }
  }, [projectFilter]);

  // Load burndown data when selectedMilestone changes
  useEffect(() => {
    if (selectedMilestone) {
      setBurndownLoading(true);
      api.getMilestoneBurndown(selectedMilestone)
        .then((res) => {
          if (res?.success) {
            setBurndownData(res.data || []);
          }
        })
        .catch((err) => {
          console.error('Error loading burndown data:', err);
          setBurndownData([]);
        })
        .finally(() => {
          setBurndownLoading(false);
        });
    } else {
      setBurndownData([]);
    }
  }, [selectedMilestone]);

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProjectFilter(e.target.value);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Empty description={t('analytics.no_data')} />
      </div>
    );
  }

  const taskOverview = data.task_overview.map(item => ({
    ...item,
    name: statusLabels[item.name] || item.name,
  }));

  const doneItem = data.task_overview.find(item => item.name === 'done');
  const doneCount = doneItem ? doneItem.value : 0;
  const completionRate = data.total_tasks > 0 ? Math.round((doneCount / data.total_tasks) * 100) : 0;

  const priorityDist = data.priority_dist.map(item => ({
    ...item,
    name: priorityLabels[item.name] || item.name,
  }));

  const completedLabel = t('dashboard.completed');
  const createdLabel = t('analytics.trend.created');

  const completionTrend = data.completion_trend.map(item => ({
    week: item.week.startsWith('W') ? t('analytics.trend.week_label', { n: item.week.replace('W', '') }) : item.week,
    [completedLabel]: item.completed,
    [createdLabel]: item.created,
  }));

  const handleExport = () => {
    if (!data) return;

    const activeProject = projectFilter === 'all'
      ? t('analytics.project.all')
      : (data.projects.find(p => String(p.id) === projectFilter)?.name || projectFilter);

    const csvContent: string[] = [];

    csvContent.push(`"${t('analytics.csv.report_title')}"`);
    csvContent.push(`"${t('analytics.csv.project')}:","${activeProject}"`);
    csvContent.push(`"${t('analytics.csv.export_date')}:","${new Date().toLocaleString(locale)}"`);
    csvContent.push('');

    csvContent.push(`"${t('analytics.csv.section_overview')}"`);
    csvContent.push(`"${t('analytics.csv.status')}","${t('analytics.csv.quantity')}"`);
    data.task_overview.forEach(item => {
      const label = statusLabels[item.name] || item.name;
      csvContent.push(`"${label}","${item.value}"`);
    });
    csvContent.push(`"${t('analytics.csv.total_tasks')}","${data.total_tasks}"`);
    csvContent.push(`"${t('analytics.csv.completion_rate')}","${completionRate}%"`);
    csvContent.push('');

    csvContent.push(`"${t('analytics.csv.section_priority')}"`);
    csvContent.push(`"${t('analytics.csv.priority')}","${t('analytics.csv.quantity')}"`);
    data.priority_dist.forEach(item => {
      const label = priorityLabels[item.name] || item.name;
      csvContent.push(`"${label}","${item.count}"`);
    });
    csvContent.push('');

    csvContent.push(`"${t('analytics.csv.section_workload')}"`);
    csvContent.push(`"${t('analytics.csv.member')}","${t('analytics.csv.non_completed')}"`);
    data.workload.forEach(item => {
      csvContent.push(`"${item.name}","${item.tasks}"`);
    });
    csvContent.push('');

    csvContent.push(`"${t('analytics.csv.section_performance')}"`);
    csvContent.push(`"${t('analytics.csv.member')}","${t('analytics.csv.total')}","${t('analytics.csv.completed')}","${t('analytics.csv.on_time_pct')}","${t('analytics.csv.avg_time')}"`);
    data.team_performance.forEach(item => {
      csvContent.push(`"${item.name}","${item.total}","${item.completed}","${item.on_time}%","${item.avg_time}"`);
    });

    const blob = new Blob([`\uFEFF${csvContent.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const safeProjectName = activeProject.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `bao_cao_phan_tich_${safeProjectName}_${timestamp}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(t('analytics.export_success'));
  };

  return (
    <div className="analytics-page">
      <div className="analytics-page__header">
        <div>
          <h1>{t('analytics.title')}</h1>
          <p>{t('analytics.sub_title')}</p>
        </div>
      </div>

      <div className="analytics-page__toolbar">
        <select value={projectFilter} onChange={handleProjectChange}>
          <option value="all">{t('analytics.project.all')}</option>
          {data.projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="export-btn" onClick={handleExport}><DownloadOutlined /> {t('analytics.action.export')}</button>
      </div>

      {/* Tabs list */}
      <div className="analytics-page__tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          {t('analytics.tab.overview') || 'Tổng quan'}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          {t('analytics.tab.performance') || 'Hiệu suất quy trình'}
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="analytics-page__grid">
            {/* Pie: Task Overview */}
            <div className="analytics-page__chart-card">
              <div className="analytics-page__chart-card-header">
                <h3>{t('analytics.chart.overview')}</h3>
                <span className="sub">{t('analytics.chart.overview_total', { count: data.total_tasks })}</span>
              </div>
              {data.total_tasks === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={t('analytics.no_tasks')} /></div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={taskOverview} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value" paddingAngle={3} stroke="none">
                      {taskOverview.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar: Priority */}
            <div className="analytics-page__chart-card">
              <div className="analytics-page__chart-card-header">
                <h3>{t('analytics.chart.priority')}</h3>
              </div>
              {priorityDist.every(p => p.count === 0) ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={t('analytics.no_data')} /></div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={priorityDist} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {priorityDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Line: Completion Trend */}
          <div className="analytics-page__grid-full">
            <div className="analytics-page__chart-card">
              <div className="analytics-page__chart-card-header">
                <h3>{t('analytics.chart.trend')}</h3>
                <span className="sub">{t('analytics.chart.trend_sub')}</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={completionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                  <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={completedLabel} stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey={createdLabel} stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="analytics-page__grid">
            {/* Horizontal Bar: Team Workload */}
            <div className="analytics-page__chart-card">
              <div className="analytics-page__chart-card-header">
                <h3>{t('analytics.chart.workload')}</h3>
                <span className="sub">{t('analytics.chart.workload_sub')}</span>
              </div>
              {data.workload.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={t('analytics.no_data')} /></div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.workload} layout="vertical" barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="tasks" radius={[0, 4, 4, 0]}>
                      {data.workload.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="analytics-page__chart-card stats-summary-card">
              <div className="analytics-page__chart-card-header">
                <h3>{t('analytics.chart.summary')}</h3>
              </div>
              <div className="stats-summary-card__content">
                <div className="stats-summary-card__progress-circle">
                  <Progress 
                    type="circle" 
                    percent={completionRate} 
                    strokeColor="#10b981"
                    trailColor="var(--border-color)"
                    width={130}
                    format={(percent) => (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>{percent}%</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('analytics.chart.completion_rate')}</span>
                      </div>
                    )}
                  />
                </div>
                <div className="stats-summary-card__list">
                  {data.task_overview.map(item => {
                    const label = statusLabels[item.name] || item.name;
                    return (
                      <div key={item.name} className="stats-summary-item">
                        <span className="dot" style={{ backgroundColor: item.color }} />
                        <span className="name">{label}</span>
                        <span className="value">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Team Table */}
          <div className="analytics-page__team-table">
            <div className="analytics-page__team-table-header">
              <h3>{t('analytics.performance.title')}</h3>
            </div>
            <div className="analytics-page__team-row-header">
              <span>{t('analytics.performance.member')}</span>
              <span>{t('analytics.performance.total_tasks')}</span>
              <span>{t('analytics.performance.completed')}</span>
              <span>{t('analytics.performance.on_time')}</span>
              <span>{t('analytics.performance.avg_time')}</span>
            </div>
            {data.team_performance.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={t('analytics.no_data')} /></div>
            ) : (
              data.team_performance.map((m) => (
                <div key={m.name} className="analytics-page__team-row">
                  <div className="analytics-page__team-member">
                    <div className="avatar" style={{ background: m.color }}>{m.avatar}</div>
                    <span className="name">{m.name}</span>
                  </div>
                  <div className="analytics-page__team-cell">{m.total}</div>
                  <div className="analytics-page__team-cell">{m.completed}</div>
                  <div className={`analytics-page__team-cell ${m.on_time >= 80 ? 'good' : m.on_time >= 60 ? 'warn' : 'bad'}`}>{m.on_time}%</div>
                  <div className="analytics-page__team-cell">{m.avg_time}</div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Tab: Process Performance */
        <>
          {/* 4 Metric cards */}
          <div className="analytics-page__metrics-grid">
            <div className="analytics-page__metric-card">
              <span className="title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FieldTimeOutlined style={{ color: '#3b82f6' }} />
                {t('analytics.metric.cycle_time') || 'Cycle Time'}
              </span>
              <span className="value">
                {data.process_performance ? `${data.process_performance.cycle_time_avg}d` : '0d'}
              </span>
              <span className="subtext">
                {t('analytics.metric.cycle_time_sub') || 'Thời gian xử lý trung bình (In Progress → Done)'}
              </span>
            </div>

            <div className="analytics-page__metric-card">
              <span className="title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HourglassOutlined style={{ color: '#a855f7' }} />
                {t('analytics.metric.lead_time') || 'Lead Time'}
              </span>
              <span className="value">
                {data.process_performance ? `${data.process_performance.lead_time_avg}d` : '0d'}
              </span>
              <span className="subtext">
                {t('analytics.metric.lead_time_sub') || 'Thời gian hoàn thành trung bình (Created → Done)'}
              </span>
            </div>

            <div className="analytics-page__metric-card">
              <span className="title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RiseOutlined style={{ color: '#10b981' }} />
                {t('analytics.metric.throughput') || 'Throughput'}
              </span>
              <span className="value">
                {data.process_performance ? `${data.process_performance.throughput_weekly_avg}` : '0'}
              </span>
              <span className="subtext">
                {t('analytics.metric.throughput_sub') || 'Số task hoàn thành trung bình hàng tuần'}
              </span>
            </div>

            <div className="analytics-page__metric-card">
              <span className="title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FireOutlined style={{ color: '#f59e0b' }} />
                {t('analytics.metric.wip') || 'Work In Progress (WIP)'}
              </span>
              <span className="value">
                {data.process_performance ? `${data.process_performance.wip_count}` : '0'}
              </span>
              <span className="subtext">
                {t('analytics.metric.wip_sub') || 'Số lượng công việc đang xử lý hiện tại'}
              </span>
            </div>
          </div>

          <div className="analytics-page__grid">
            {/* Chart: Cycle Time Trend */}
            <div className="analytics-page__chart-card">
              <div className="analytics-page__chart-card-header">
                <h3>{t('analytics.chart.cycle_time_trend') || 'Xu hướng thời gian xử lý (Cycle Time)'}</h3>
              </div>
              {!data.process_performance || data.process_performance.cycle_time_trend.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={t('analytics.no_data')} /></div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.process_performance.cycle_time_trend.map(item => ({
                    ...item,
                    week: item.week.startsWith('W') ? t('analytics.trend.week_label', { n: item.week.replace('W', '') }) : item.week
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                    <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="d" />
                    <Tooltip />
                    <Line type="monotone" dataKey="avg_days" name={t('analytics.metric.cycle_time') || 'Cycle Time'} stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Chart: Throughput Trend */}
            <div className="analytics-page__chart-card">
              <div className="analytics-page__chart-card-header">
                <h3>{t('analytics.chart.throughput_trend') || 'Xu hướng hiệu suất hoàn thành (Throughput)'}</h3>
              </div>
              {!data.process_performance || data.process_performance.throughput_trend.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={t('analytics.no_data')} /></div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.process_performance.throughput_trend.map(item => ({
                    ...item,
                    week: item.week.startsWith('W') ? t('analytics.trend.week_label', { n: item.week.replace('W', '') }) : item.week
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                    <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="throughput" name={t('analytics.performance.completed') || 'Đã xong'} fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Milestone Burndown chart */}
          <div className="analytics-page__grid-full">
            <div className="analytics-page__chart-card">
              <div className="analytics-page__chart-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                <h3 style={{ margin: 0 }}>{t('analytics.chart.burndown') || 'Biểu đồ Burndown theo Milestone'}</h3>
                
                {projectFilter === 'all' ? (
                  <div style={{ marginTop: '8px' }}>
                    <Empty description={t('analytics.burndown.select_project_note') || 'Vui lòng chọn một dự án cụ thể để xem biểu đồ Burndown.'} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div className="analytics-page__burndown-picker">
                      <select 
                        value={selectedMilestone} 
                        onChange={(e) => setSelectedMilestone(e.target.value)}
                        style={{ margin: 0 }}
                      >
                        <option value="" disabled>{t('analytics.burndown.select_milestone') || 'Chọn mốc công việc (Milestone)...'}</option>
                        {milestones.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.status})</option>
                        ))}
                      </select>
                    </div>

                    {selectedMilestone && (
                      <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '2px' }}>
                        <button 
                          className="tab-btn" 
                          style={{ 
                            background: burndownUnit === 'tasks' ? 'var(--primary)' : 'transparent', 
                            color: burndownUnit === 'tasks' ? '#fff' : 'var(--text-secondary)',
                            border: 'none', borderRadius: '4px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 500
                          }}
                          onClick={() => setBurndownUnit('tasks')}
                        >
                          {t('analytics.burndown.ideal_tasks') || 'Số lượng task'}
                        </button>
                        <button 
                          className="tab-btn" 
                          style={{ 
                            background: burndownUnit === 'hours' ? 'var(--primary)' : 'transparent', 
                            color: burndownUnit === 'hours' ? '#fff' : 'var(--text-secondary)',
                            border: 'none', borderRadius: '4px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 500
                          }}
                          onClick={() => setBurndownUnit('hours')}
                        >
                          {t('analytics.burndown.ideal_hours') || 'Số giờ ước tính'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {projectFilter !== 'all' && (
                burndownLoading ? (
                  <div style={{ padding: '60px', textAlign: 'center' }}><Spin /></div>
                ) : !selectedMilestone ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <Empty description={t('analytics.burndown.no_milestones') || 'Dự án này chưa có mốc công việc nào.'} />
                  </div>
                ) : burndownData.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={t('analytics.no_data')} /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={burndownData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey={burndownUnit === 'tasks' ? 'ideal_tasks' : 'ideal_hours'} 
                        name={burndownUnit === 'tasks' ? (t('analytics.burndown.ideal_tasks') || 'Task lý thuyết') : (t('analytics.burndown.ideal_hours') || 'Giờ lý thuyết')} 
                        stroke="#9ca0b0" 
                        strokeWidth={1.5} 
                        strokeDasharray="5 5" 
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey={burndownUnit === 'tasks' ? 'actual_tasks' : 'actual_hours'} 
                        name={burndownUnit === 'tasks' ? (t('analytics.burndown.actual_tasks') || 'Task thực tế') : (t('analytics.burndown.actual_hours') || 'Giờ thực tế')} 
                        stroke={burndownUnit === 'tasks' ? '#3b82f6' : '#a855f7'} 
                        strokeWidth={2.5} 
                        dot={{ r: 3 }} 
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
