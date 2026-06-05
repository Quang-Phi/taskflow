import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import SearchModal from './SearchModal';
import CreateTaskModal from '../tasks/CreateTaskModal';
import GlobalAiSidebar from './GlobalAiSidebar';
import { MenuOutlined } from '@ant-design/icons';
import './MainLayout.scss';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

const MainLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.innerWidth <= TABLET_BREAKPOINT  // auto-collapse on tablet
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarCollapsedRef = React.useRef(sidebarCollapsed);

  // Detect mobile/tablet and adjust sidebar automatically
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const tablet = window.innerWidth <= TABLET_BREAKPOINT && window.innerWidth > MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (mobile) {
        setMobileSidebarOpen(false);
      } else if (tablet) {
        setSidebarCollapsed(true); // auto-collapse at tablet
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!aiOpen) {
      sidebarCollapsedRef.current = sidebarCollapsed;
    }
  }, [sidebarCollapsed, aiOpen]);

  useEffect(() => {
    if (aiOpen) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(sidebarCollapsedRef.current);
    }
  }, [aiOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Global Search Shortcut
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // 2. Ignore other shortcuts if typing in any input field
      const isInputActive =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '') ||
        document.activeElement?.hasAttribute('contenteditable') ||
        document.activeElement?.classList.contains('ant-select-selection-search-input');

      if (isInputActive) return;

      // 3. Escape key to close panels
      if (e.key === 'Escape') {
        window.dispatchEvent(new Event('trigger-close-panels'));
        setSearchOpen(false);
        setAiOpen(false);
        setMobileSidebarOpen(false);
        return;
      }
    };

    const handleOpenSearch = () => setSearchOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-global-search', handleOpenSearch);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-global-search', handleOpenSearch);
    };
  }, [location.pathname, navigate]);

  return (
    <div className="main-layout">
      {/* Mobile sidebar backdrop */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="sidebar-backdrop visible"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        collapsed={isMobile ? false : sidebarCollapsed}
        onCollapse={isMobile ? () => setMobileSidebarOpen(false) : setSidebarCollapsed}
        className={isMobile ? (mobileSidebarOpen ? 'mobile-open' : '') : ''}
      />
      <Header
        sidebarCollapsed={isMobile ? true : sidebarCollapsed}
        aiSidebarOpen={aiOpen}
        mobileHamburger={
          isMobile ? (
            <button
              className="mobile-sidebar-toggle"
              onClick={() => setMobileSidebarOpen(v => !v)}
              aria-label="Toggle sidebar"
            >
              <MenuOutlined />
            </button>
          ) : undefined
        }
      />
      <div className={`main-layout__content ${(isMobile ? true : sidebarCollapsed) ? 'sidebar-collapsed' : ''} ${aiOpen ? 'ai-sidebar-open' : ''}`}>
        <div className="main-layout__page">
          <Outlet />
        </div>
      </div>
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <CreateTaskModal />

      {/* Floating Sparkles AI Assistant Trigger */}
      {!aiOpen && (
        <div className="main-layout__ai-trigger" onClick={() => setAiOpen(true)} title="Trợ lý AI">
          ✨
        </div>
      )}

      <GlobalAiSidebar isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
};

export default MainLayout;
