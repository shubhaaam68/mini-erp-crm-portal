import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Badge } from "./ui";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/customers": "Customer CRM",
  "/products": "Products & Inventory",
  "/stock-movements": "Stock Movement Log",
  "/challans": "Sales Challans",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const title =
    TITLES[pathname] ||
    (pathname.startsWith("/customers") ? "Customer Detail" :
     pathname.startsWith("/challans") ? "Challan Detail" :
     pathname.startsWith("/products") ? "Product Detail" : "Portal");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Wholesale ERP
          <small>ERP + CRM Portal</small>
        </div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/customers">Customers</NavLink>
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/stock-movements">Stock Log</NavLink>
          <NavLink to="/challans">Challans</NavLink>
        </nav>
        <div className="spacer" />
        <div className="who">
          {user?.name}
          <br />
          {user?.email}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="toolbar">
            {user ? <Badge status={user.role} /> : null}
            <button className="btn secondary small" onClick={logout}>Log out</button>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
