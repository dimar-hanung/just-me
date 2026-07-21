import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api";
import HomePage from "./pages/HomePage";
import OnboardingPage from "./pages/OnboardingPage";
import SettingsPage from "./pages/SettingsPage";
import TodoDetailPage from "./pages/TodoDetailPage";
import TrashPage from "./pages/TrashPage";
import DocsPage from "./pages/DocsPage";
import Layout from "./components/Layout";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api
      .onboarding()
      .then((state) => {
        setOnboardingComplete(state.complete);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [location.pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  if (!onboardingComplete && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage onComplete={() => setOnboardingComplete(true)} />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/todos/:id" element={<TodoDetailPage />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
