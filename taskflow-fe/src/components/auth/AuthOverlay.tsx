import React from 'react';

export type AuthOverlayStep = 'preparing' | 'connecting' | 'authenticating' | 'session_expired' | 'redirecting' | 'error';

interface AuthOverlayProps {
  step?: AuthOverlayStep;
  message?: string;
}

const STEP_CONFIG: Record<AuthOverlayStep, { title: string; sub: string; icon: 'spinner' | 'check' | 'warning' }> = {
  preparing:     { title: 'Đang khởi động',        sub: 'Chuẩn bị môi trường làm việc của bạn...',   icon: 'spinner' },
  connecting:    { title: 'Đang kết nối',           sub: 'Thiết lập kết nối bảo mật...',              icon: 'spinner' },
  authenticating:{ title: 'Đang xác thực',          sub: 'Kiểm tra thông tin tài khoản...',           icon: 'spinner' },
  session_expired:{ title: 'Phiên làm việc hết hạn', sub: 'Đang tự động đăng nhập lại...',            icon: 'warning' },
  redirecting:   { title: 'Đang chuyển trang',      sub: 'Vui lòng chờ trong giây lát...',            icon: 'spinner' },
  error:         { title: 'Có lỗi xảy ra',           sub: 'Đang thử kết nối lại...',                  icon: 'warning' },
};

const AuthOverlay: React.FC<AuthOverlayProps> = ({ step = 'preparing', message }) => {
  const config = STEP_CONFIG[step];

  return (
    <div style={s.backdrop}>
      {/* Ambient glow orbs */}
      <div style={{ ...s.orb, ...s.orb1 }} />
      <div style={{ ...s.orb, ...s.orb2 }} />

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <path d="M14 24l8 8 12-16" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={s.logoText}>TaskFlow</span>
        </div>

        {/* Divider */}
        <div style={s.divider} />

        {/* Icon / animation */}
        <div style={s.iconArea}>
          {config.icon === 'spinner' ? (
            <div style={s.ringOuter}>
              <div style={s.ringInner} />
              <div style={s.ringDot} />
            </div>
          ) : (
            <div style={{ ...s.ringOuter, border: '2px solid rgba(251,191,36,0.15)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4m0 4h.01M12 3C6.477 3 2 7.477 2 12s4.477 9 10 9 10-4.477 10-9S17.523 3 12 3z"
                  stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>

        {/* Text */}
        <div style={s.textArea}>
          <h2 style={s.title}>{config.title}</h2>
          <p style={s.sub}>{message || config.sub}</p>
        </div>

        {/* Progress dots */}
        <div style={s.dotsRow}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ ...s.dot, animationDelay: `${i * 0.3}s` }} />
          ))}
        </div>

        {/* App version badge */}
        <div style={s.badge}>Workspace Manager</div>
      </div>

      <style>{`
        @keyframes tf-orbit {
          0%   { transform: rotate(0deg) translateX(18px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(18px) rotate(-360deg); }
        }
        @keyframes tf-ring {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes tf-dot-bounce {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40%            { opacity: 1;    transform: scale(1.1); }
        }
        @keyframes tf-orb-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(20px, -30px) scale(1.1); }
        }
        @keyframes tf-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tf-ring-inner {
          animation: tf-ring 1.1s linear infinite;
        }
        .tf-dot {
          animation: tf-dot-bounce 1.4s ease-in-out infinite;
        }
        .tf-orb-1 { animation: tf-orb-float 7s ease-in-out infinite; }
        .tf-orb-2 { animation: tf-orb-float 9s ease-in-out infinite reverse; }
        .tf-card   { animation: tf-fade-up 0.4s ease-out both; }
        .tf-dot-orbit { animation: tf-orbit 2s linear infinite; }
      `}</style>
    </div>
  );
};

// ─── Inline styles ─────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(ellipse at 30% 40%, #13132b 0%, #0d0d1a 60%, #0a0a12 100%)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute', borderRadius: '50%',
    filter: 'blur(80px)', pointerEvents: 'none',
  },
  orb1: {
    width: 400, height: 400,
    background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
    top: '-10%', left: '-10%',
  } as React.CSSProperties,
  orb2: {
    width: 350, height: 350,
    background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
    bottom: '-10%', right: '-5%',
  } as React.CSSProperties,
  card: {
    position: 'relative',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    padding: '44px 52px 36px',
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 24,
    backdropFilter: 'blur(32px)',
    boxShadow: '0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
    minWidth: 300, maxWidth: 360,
    animation: 'tf-fade-up 0.4s ease-out both',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  logoIcon: {
    width: 40, height: 40, borderRadius: 10,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
  },
  logoText: {
    fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px',
  },
  divider: {
    width: '100%', height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
  },
  iconArea: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 72, height: 72,
  },
  ringOuter: {
    position: 'relative',
    width: 60, height: 60, borderRadius: '50%',
    border: '2px solid rgba(99,102,241,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties,
  ringInner: {
    position: 'absolute', inset: 4, borderRadius: '50%',
    border: '2px solid transparent',
    borderTopColor: '#6366f1',
    borderRightColor: 'rgba(99,102,241,0.3)',
    animation: 'tf-ring 1.1s linear infinite',
  } as React.CSSProperties,
  ringDot: {
    position: 'absolute', top: 6, right: 6,
    width: 6, height: 6, borderRadius: '50%',
    background: '#6366f1',
    boxShadow: '0 0 6px #6366f1',
    animation: 'tf-orbit 1.1s linear infinite',
  } as React.CSSProperties,
  textArea: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    textAlign: 'center',
  },
  title: {
    margin: 0, fontSize: 17, fontWeight: 600,
    color: '#f1f5f9', letterSpacing: '-0.2px',
  },
  sub: {
    margin: 0, fontSize: 13,
    color: 'rgba(148,163,184,0.8)',
    lineHeight: 1.5,
  },
  dotsRow: {
    display: 'flex', gap: 6, alignItems: 'center',
  },
  dot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#6366f1',
    animation: 'tf-dot-bounce 1.4s ease-in-out infinite',
  },
  badge: {
    fontSize: 11, color: 'rgba(100,116,139,0.7)',
    fontWeight: 500, letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    marginTop: -4,
  },
};

export default AuthOverlay;
