import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto p-8">
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
