import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import PeopleList from "./pages/PeopleList";
import PersonDetail from "./pages/PersonDetail";
import CompanyList from "./pages/CompanyList";
import CompanyDetail from "./pages/CompanyDetail";
import ActionList from "./pages/ActionList";
import ActionDetail from "./pages/ActionDetail";
import ProjectList from "./pages/ProjectList";
import ProjectDetail from "./pages/ProjectDetail";
import CalendarView from "./pages/CalendarView";
import Settings from "./pages/Settings";
import Guide from "./pages/Guide";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />

        <Route path="people" element={<PeopleList />} />
        <Route path="people/:id" element={<PersonDetail />} />

        <Route path="company" element={<CompanyList />} />
        <Route path="company/:id" element={<CompanyDetail />} />

        <Route path="actions" element={<ActionList />} />
        <Route path="actions/:id" element={<ActionDetail />} />

        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/:id" element={<ProjectDetail />} />

        <Route path="calendar" element={<CalendarView />} />

        <Route path="settings" element={<Settings />} />
        <Route path="guide" element={<Guide />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
