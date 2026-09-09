import { useCallback, useEffect, useState } from "react";
import { Alert, Field, Loading, Modal, Pager } from "../components/ui";
import { ApiError, Paged, api, money } from "../lib/api";
import { useAuth } from "../lib/auth";

export interface Product {
  id: string; name: string; sku: string; category: string; unitPrice: string;
  currentStock: number; minStockAlert: number; location: string;
}

const EMPTY = { name: "", sku: "", category: "", unitPrice: "", currentStock: "0", minStockAlert: "0", location: "" };

function ProductForm({ initial, onSaved, onCancel }: { initial?: Product; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...(initial
      ? {
          name: initial.name, sku: initial.sku, category: initial.category,
          unitPrice: String(initial.unitPrice), currentStock: String(initial.currentStock),
          minStockAlert: String(initial.minStockAlert), location: initial.location,
        }
      : {}),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setErrors({});
    try {
      if (initial) {
        const { currentStock, ...rest } = form; // stock only changes through stock movements
        await api.put(`/products/${initial.id}`, rest);
      } else {
        await api.post("/products", form);
      }
      onSaved();
    } catch (err) {
      const e2 = err as ApiError;
      setError(e2.message);
      if (e2.details) setErrors(Object.fromEntries(e2.details.map((d) => [d.field, d.message])));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Alert kind="error">{error}</Alert>
      <div className="form-grid">
        <Field label="Product name *" error={errors.name}><input value={form.name} onChange={set("name")} required /></Field>
        <Field label="SKU / code *" error={errors.sku}><input value={form.sku} onChange={set("sku")} required placeholder="SKU-GRO-010" /></Field>
        <Field label="Category *" error={errors.category}><input value={form.category} onChange={set("category")} required /></Field>
        <Field label="Unit price (₹) *" error={errors.unitPrice}><input type="number" step="0.01" min="0.01" value={form.unitPrice} onChange={set("unitPrice")} required /></Field>
        {!initial && (
          <Field label="Opening stock" error={errors.currentStock}>
            <input type="number" min="0" value={form.currentStock} onChange={set("currentStock")} />
          </Field>
        )}
        <Field label="Minimum stock alert" error={errors.minStockAlert}><input type="number" min="0" value={form.minStockAlert} onChange={set("minStockAlert")} /></Field>
        <Field label="Location / warehouse *" error={errors.location}><input value={form.location} onChange={set("location")} required /></Field>
      </div>
      {initial && <p className="muted" style={{ marginTop: 12 }}>Stock is changed through the Stock IN/OUT action so every change is logged.</p>}
      <div className="toolbar" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={busy}>{busy ? "Saving…" : initial ? "Update product" : "Add product"}</button>
      </div>
    </form>
  );
}

function StockForm({ product, onSaved, onCancel }: { product: Product; onSaved: () => void; onCancel: () => void }) {
  const [type, setType] = useState("IN");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.post(`/products/${product.id}/stock`, { type, quantity, reason });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Alert kind="error">{error}</Alert>
      <p className="muted">Current stock: <strong>{product.currentStock}</strong> · {product.location}</p>
      <div className="form-grid">
        <Field label="Movement type *">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="IN">IN — stock received</option>
            <option value="OUT">OUT — stock issued / damaged</option>
          </select>
        </Field>
        <Field label="Quantity *"><input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></Field>
        <Field label="Reason *"><input value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Purchase invoice #1234" /></Field>
      </div>
      <div className="toolbar" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={busy}>{busy ? "Saving…" : "Record movement"}</button>
      </div>
    </form>
  );
}

export default function Products() {
  const { can } = useAuth();
  const editable = can("ADMIN", "WAREHOUSE");
  const [rows, setRows] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (search) q.set("search", search);
    if (lowStock) q.set("lowStock", "true");
    api.get<Paged<Product>>(`/products?${q}`)
      .then((r) => { setRows(r.data); setMeta(r.meta); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, search, lowStock]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="card">
      <div className="card-head">
        <div className="toolbar">
          <input placeholder="Search product, SKU, category…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
          <label className="toolbar" style={{ gap: 6 }}>
            <input type="checkbox" style={{ width: 16 }} checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
            Low stock only
          </label>
        </div>
        {editable && <button className="btn" onClick={() => setShowAdd(true)}>+ Add product</button>}
      </div>

      {error && <div className="card-body"><Alert kind="error">{error}</Alert></div>}
      {loading ? <Loading what="products" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Category</th><th className="num">Unit price</th><th className="num">Stock</th><th className="num">Min</th><th>Location</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const low = p.currentStock <= p.minStockAlert;
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="muted">{p.sku}</td>
                    <td>{p.category}</td>
                    <td className="num">{money(p.unitPrice)}</td>
                    <td className="num" style={low ? { color: "var(--danger)", fontWeight: 700 } : undefined}>{p.currentStock}</td>
                    <td className="num muted">{p.minStockAlert}</td>
                    <td>{p.location}</td>
                    <td>
                      <div className="row-actions">
                        {editable && <button className="btn secondary small" onClick={() => setAdjusting(p)}>Stock IN/OUT</button>}
                        {editable && <button className="btn secondary small" onClick={() => setEditing(p)}>Edit</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8} className="empty">No products match your filters</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      {showAdd && (
        <Modal title="Add product" onClose={() => setShowAdd(false)}>
          <ProductForm onCancel={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <ProductForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
        </Modal>
      )}
      {adjusting && (
        <Modal title={`Stock movement — ${adjusting.name}`} onClose={() => setAdjusting(null)}>
          <StockForm product={adjusting} onCancel={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); load(); }} />
        </Modal>
      )}
    </div>
  );
}
