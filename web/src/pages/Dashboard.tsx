import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Loading } from "../components/ui";
import { api, dateTime, money } from "../lib/api";

interface Summary {
  customers: number;
  leads: number;
  products: number;
  draftChallans: number;
  confirmedChallans: number;
  lowStockCount: number;
  lowStock: { name: string; sku: string; currentStock: number; minStockAlert: number }[];
  recentChallans: {
    id: string; challanNumber: string; customerName: string; status: string;
    totalQuantity: number; totalAmount: string; createdAt: string;
  }[];
}

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ data: Summary }>("/dashboard/summary")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Loading what="dashboard" />;

  const stats = [
    ["Customers", data.customers],
    ["Open leads", data.leads],
    ["Products", data.products],
    ["Draft challans", data.draftChallans],
    ["Confirmed challans", data.confirmedChallans],
    ["Low stock items", data.lowStockCount],
  ] as const;

  return (
    <>
      <div className="stat-grid">
        {stats.map(([label, value]) => (
          <div className="stat" key={label}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="card">
          <div className="card-head"><h2>Recent challans</h2><Link to="/challans">View all</Link></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Challan</th><th>Customer</th><th>Status</th><th className="num">Qty</th><th className="num">Amount</th><th>Created</th></tr>
              </thead>
              <tbody>
                {data.recentChallans.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/challans/${c.id}`}>{c.challanNumber}</Link></td>
                    <td>{c.customerName}</td>
                    <td><Badge status={c.status} /></td>
                    <td className="num">{c.totalQuantity}</td>
                    <td className="num">{money(c.totalAmount)}</td>
                    <td className="muted">{dateTime(c.createdAt)}</td>
                  </tr>
                ))}
                {!data.recentChallans.length && <tr><td colSpan={6} className="empty">No challans yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Low stock alerts</h2><Link to="/products">Products</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th className="num">In stock</th><th className="num">Min</th></tr></thead>
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p.sku}>
                    <td>{p.name}</td>
                    <td className="muted">{p.sku}</td>
                    <td className="num" style={{ color: "var(--danger)", fontWeight: 600 }}>{p.currentStock}</td>
                    <td className="num">{p.minStockAlert}</td>
                  </tr>
                ))}
                {!data.lowStock.length && <tr><td colSpan={4} className="empty">All products above minimum level</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
