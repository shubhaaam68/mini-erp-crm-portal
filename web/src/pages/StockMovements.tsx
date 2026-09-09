import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Loading, Pager } from "../components/ui";
import { Paged, api, dateTime } from "../lib/api";

interface Movement {
  id: string; quantity: number; type: string; reason: string; reference: string | null; createdAt: string;
  product: { name: string; sku: string };
  createdBy: { name: string; role: string };
}

export default function StockMovements() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (type) q.set("type", type);
    api.get<Paged<Movement>>(`/stock-movements?${q}`)
      .then((r) => { setRows(r.data); setMeta(r.meta); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, type]);

  useEffect(load, [load]);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Every stock change, newest first</h2>
        <select value={type} onChange={(e) => { setPage(1); setType(e.target.value); }} style={{ width: "auto" }}>
          <option value="">All movements</option><option value="IN">IN only</option><option value="OUT">OUT only</option>
        </select>
      </div>
      {error && <div className="card-body"><Alert kind="error">{error}</Alert></div>}
      {loading ? <Loading what="stock log" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Type</th><th className="num">Qty</th><th>Reason</th><th>Reference</th><th>By</th><th>When</th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>{m.product.name}</td>
                  <td className="muted">{m.product.sku}</td>
                  <td><Badge status={m.type} /></td>
                  <td className="num">{m.type === "IN" ? "+" : "−"}{m.quantity}</td>
                  <td>{m.reason}</td>
                  <td className="muted">{m.reference || "—"}</td>
                  <td>{m.createdBy.name} <span className="muted">({m.createdBy.role})</span></td>
                  <td className="muted">{dateTime(m.createdAt)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="empty">No stock movements recorded</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
    </div>
  );
}
