import { AppProvider, useApp } from './hooks/AppContext';
import { LandingPage } from './pages/LandingPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProjectPage } from './pages/ProjectPage';

function AppContent() {
  const { currentPage, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      {currentPage === 'landing' && <LandingPage />}
      {currentPage === 'overview' && <OverviewPage />}
      {currentPage === 'project' && <ProjectPage />}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
