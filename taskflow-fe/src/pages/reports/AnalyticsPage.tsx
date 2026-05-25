import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, Legend } from 'recharts';
import { DownloadOutlined } from '@ant-design/icons';
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
}

const AnalyticsPage: React.FC = () => {
  const { t, lang } = useTranslation();
  const isVi = lang === 'vi';

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('all');

  const statusLabels: Record<string, string> = {
    done: t('tasks.status.done'),
    in_progress: t('tasks.status.in_progress'),
    review: t('tasks.status.in_review'),
    todo: t('tasks.status.todo'),
    overdue: t('dashboard.overdue'),
  };

  const priorityLabels: Record<string, string> = {
    urgent: t('tasks.priority.urgent') || (isVi ? 'Khẩn cấp' : 'Urgent'),
    high: t('tasks.priority.high'),
    medium: t('tasks.priority.medium'),
    low: t('tasks.priority.low'),
    none: t('tasks.priority.none') || (isVi ? 'Không ưu tiên' : 'No priority'),
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
      message.error(isVi ? 'Lỗi tải dữ liệu phân tích' : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [isVi]);

  useEffect(() => {
    fetchData(projectFilter);
  }, [projectFilter, fetchData]);

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
        <Empty description={isVi ? 'Không có dữ liệu' : 'No data available'} />
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
  const createdLabel = isVi ? 'Đã tạo mới' : 'Created';

  const completionTrend = data.completion_trend.map(item => ({
    week: isVi ? `Tuần ${item.week.replace('W', '')}` : item.week,
    [completedLabel]: item.completed,
    [createdLabel]: item.created,
  }));

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
        <button className="export-btn"><DownloadOutlined /> {t('analytics.action.export')}</button>
      </div>

      <div className="analytics-page__grid">
        {/* Pie: Task Overview */}
        <div className="analytics-page__chart-card">
          <div className="analytics-page__chart-card-header">
            <h3>{t('analytics.chart.overview')}</h3>
            <span className="sub">{t('analytics.chart.overview_total', { count: data.total_tasks })}</span>
          </div>
          {data.total_tasks === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={isVi ? 'Chưa có task' : 'No tasks'} /></div>
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
            <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={isVi ? 'Chưa có dữ liệu' : 'No data'} /></div>
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
            <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={isVi ? 'Chưa có dữ liệu' : 'No data'} /></div>
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
          <div style={{ padding: '40px', textAlign: 'center' }}><Empty description={isVi ? 'Chưa có dữ liệu' : 'No data'} /></div>
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
    </div>
  );
};

export default AnalyticsPage;
