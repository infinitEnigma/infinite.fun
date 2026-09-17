import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LaunchFeed } from './pages/LaunchFeed';
import { LaunchForm } from './pages/LaunchForm';
import { CoinDetail } from './pages/CoinDetail';
import { Leaderboard } from './pages/Leaderboard';
import { Paper } from './pages/Paper';
import { Admin } from './pages/Admin';
import { Portfolio } from './pages/Portfolio';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LaunchFeed />} />
        <Route path="/launch" element={<LaunchForm />} />
        <Route path="/coin/:address" element={<CoinDetail />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/paper" element={<Paper />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/portfolio/:address" element={<Portfolio />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
