import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { Loading } from "./components/ui";
import { AuthProvider, useAuth } from "./lib/auth";
import ChallanDetail from "./pages/ChallanDetail";
import Challans from "./pages/Challans";
import CustomerDetail from "./pages/CustomerDetail";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Products from "./pages/Products";
import StockMovements from "./pages/StockMovements";
import "./styles.css";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading what="session" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/products" element={<Products />} />
            <Route path="/stock-movements" element={<StockMovements />} />
            <Route path="/challans" element={<Challans />} />
            <Route path="/challans/:id" element={<ChallanDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
