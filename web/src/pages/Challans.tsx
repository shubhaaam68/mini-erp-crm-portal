import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Field, Loading, Modal, Pager } from "../components/ui";
import { ApiError, Paged, api, dateTime, money } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Customer } from "./Customers";
import type { Product } from "./Products";

interface ChallanRow {
  id: string; challanNumber: string; customerName: string; status: string;
  totalQuantity: number; totalAmount: string; createdAt: string;
  createdBy: { name: string; role: string };
  _count: { items: number };
}

interface Line { productId: string; quantity: string }

/** New challan form: pick customer, add multiple product lines, save as draft or confirmed. */
function ChallanForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: "1" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Paged<Customer>>("/customers?pageSize=100").then((r) => setCustomers(r.data)).catch(() => {});
    api.get<Paged<Product>>("/products?pageSize=100").then((r) => setProducts(r.data)).catch(() => {});
  }, []);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const total = lines.reduce((sum, l) => {
    const p = products.find((x) => x.id === l.productId);
    return sum + (p ? Number(p.unitPrice) * Number(l.quantity || 0) : 0);
  }, 0);

  async function submit(status: "DRAFT" | "CONFIRMED") {
    setBusy(true); setError("");
    try {
      const items = lines
        .filter((l) => l.productId && Number(l.quantity) > 0)
        .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
      if (!customerId) throw new ApiError(400, "Select a customer");
      if (!items.length) throw new ApiError(400, "Add at least one product line");
      await api.post("/challans", { customerId, status, remarks, items });
      onSaved();
    } catch (err: any) {
      setError(err.message + (err.details?.length ? ` (${err.details.map((d: any) => d.message).join(", ")})` : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Alert kind="error">{error}</Alert>
      <div className="form-grid">
        <Field label="Customer *">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.businessName}</option>
            ))}
          </select>
        </Field>
        <Field label="Remarks"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" /></Field>
      </div>

      <div className="line-items" style={{ marginTop: 18 }}>
        <div className="card-head" style={{ padding: "0 0 10px", borderBottom: "none" }}>
          <h2>Products</h2>
          <button className="btn secondary small" onClick={() => setLines([...lines, { productId: "", quantity: "1" }])}>+ Add line</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Product</th><th className="num">In stock</th><th className="num">Unit price</th><th style={{ width: 110 }}>Qty</th><th className="num">Line total</th><th></th></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const p = products.find((x) => x.id === l.productId);
                const qty = Number(l.quantity || 0);
                const short = p && qty > p.currentStock;
                return (
                  <tr key={i}>
                    <td>
                      <select value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value })}>
                        <option value="">Select product…</option>
                        {products.map((prod) => (
                          <option key={prod.id} value={prod.id}>{prod.name} ({prod.sku})</option>
                        ))}
                      </select>
                    </td>
                    <td className="num">{p ? p.currentStock : "—"}</td>
                    <td className="num">{p ? money(p.unitPrice) : "—"}</td>
                    <td><input type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></td>
                    <td className="num">{p ? money(Number(p.unitPrice) * qty) : "—"}
                      {short ? <div className="err" style={{ color: "var(--danger)", fontSize: 11 }}>exceeds stock</div> : null}
                    </td>
                    <td>
                      <button className="btn secondary small" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr><th colSpan={4} className="num">Total</th><th className="num">{money(total)}</th><th></th></tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 18, justifyContent: "flex-end" }}>
        <button className="btn secondary" onClick={onCancel}>Cancel</button>
        <button className="btn secondary" disabled={busy} onClick={() => submit("DRAFT")}>Save as draft</button>
        <button className="btn" disabled={busy} onClick={() => submit("CONFIRMED")}>Save &amp; confirm (reduces stock)</button>
      </div>
    </div>
  );
}

export default function Challans() {
  const { can } = useAuth();
  const [rows, setRows] = useState<ChallanRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    api.get<Paged<ChallanRow>>(`/challans?${q}`)
      .then((r) => { setRows(r.data); setMeta(r.meta); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="card">
      <div className="card-head">
        <div className="toolbar">
          <input placeholder="Search challan number or customer…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All statuses</option><option value="DRAFT">Draft</option><option value="CONFIRMED">Confirmed</option><option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        {can("ADMIN", "SALES") && <button className="btn" onClick={() => setShowNew(true)}>+ New challan</button>}
      </div>

      {error && <div className="card-body"><Alert kind="error">{error}</Alert></div>}
      {loading ? <Loading what="challans" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Challan</th><th>Customer</th><th>Status</th><th className="num">Lines</th><th className="num">Qty</th><th className="num">Amount</th><th>Created by</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/challans/${c.id}`}>{c.challanNumber}</Link></td>
                  <td>{c.customerName}</td>
                  <td><Badge status={c.status} /></td>
                  <td className="num">{c._count.items}</td>
                  <td className="num">{c.totalQuantity}</td>
                  <td className="num">{money(c.totalAmount)}</td>
                  <td>{c.createdBy.name}</td>
                  <td className="muted">{dateTime(c.createdAt)}</td>
                  <td><div className="row-actions"><Link className="btn secondary small" to={`/challans/${c.id}`}>Open</Link></div></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="empty">No challans match your filters</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      {showNew && (
        <Modal title="New sales challan" onClose={() => setShowNew(false)}>
          <ChallanForm onCancel={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />
        </Modal>
      )}
    </div>
  );
}
