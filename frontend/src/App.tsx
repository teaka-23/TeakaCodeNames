import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const LobbyPage = lazy(() => import('./pages/LobbyPage'));
const GamePage = lazy(() => import('./pages/GamePage'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p className="route-loading">Загрузка...</p>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/room/:roomId" element={<GamePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
