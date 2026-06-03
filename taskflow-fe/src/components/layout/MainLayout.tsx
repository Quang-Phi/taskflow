import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import SearchModal from './SearchModal';
import CreateTaskModal from '../tasks/CreateTaskModal';
import GlobalAiSidebar from './GlobalAiSidebar';
import './MainLayout.scss';

const MainLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarCollapsedRef = React.useRef(sidebarCollapsed);

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
      <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} aiSidebarOpen={aiOpen} />
      <div className={`main-layout__content ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${aiOpen ? 'ai-sidebar-open' : ''}`}>
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
