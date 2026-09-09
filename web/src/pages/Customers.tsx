import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Field, Loading, Modal, Pager } from "../components/ui";
import { ApiError, Paged, api, date } from "../lib/api";
import { useAuth } from "../lib/auth";

export interface Customer {
  id: string; name: string; mobile: string; email: string | null; businessName: string;
  gstNumber: string | null; type: string; address: string; status: string;
  followUpDate: string | null; notes: string | null;
}

const EMPTY = {
  name: "", mobile: "", email: "", businessName: "", gstNumber: "",
  type: "RETAIL", address: "", status: "LEAD", followUpDate: "", notes: "",
};

/** Shared add/edit customer form used by the list page. */
export function CustomerForm({
  initial, onSaved, onCancel,
}: { initial?: Customer; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...(initial
      ? {
          name: initial.name, mobile: initial.mobile, email: initial.email || "",
          businessName: initial.businessName, gstNumber: initial.gstNumber || "",
          type: initial.type, address: initial.address, status: initial.status,
          followUpDate: initial.followUpDate ? initial.followUpDate.slice(0, 10) : "",
          notes: initial.notes || "",
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
    const payload = {
      ...form,
      followUpDate: form.followUpDate ? new Date(form.followUpDate + "T00:00:00.000Z").toISOString() : "",
    };
    try {
      if (initial) await api.put(`/customers/${initial.id}`, payload);
      else await api.post("/customers", payload);
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
        <Field label="Customer name *" error={errors.name}><input value={form.name} onChange={set("name")} required /></Field>
        <Field label="Mobile number *" error={errors.mobile}><input value={form.mobile} onChange={set("mobile")} required placeholder="9822012345" /></Field>
        <Field label="Email" error={errors.email}><input type="email" value={form.email} onChange={set("email")} /></Field>
        <Field label="Business name *" error={errors.businessName}><input value={form.businessName} onChange={set("businessName")} required /></Field>
        <Field label="GST number" error={errors.gstNumber}><input value={form.gstNumber} onChange={set("gstNumber")} placeholder="Optional" /></Field>
        <Field label="Customer type *">
          <select value={form.type} onChange={set("type")}>
            <option value="RETAIL">Retail</option><option value="WHOLESALE">Wholesale</option><option value="DISTRIBUTOR">Distributor</option>
          </select>
        </Field>
        <Field label="Status *">
          <select value={form.status} onChange={set("status")}>
            <option value="LEAD">Lead</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
          </select>
        </Field>
        <Field label="Follow-up date"><input type="date" value={form.followUpDate} onChange={set("followUpDate")} /></Field>
      </div>
      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        <Field label="Address *" error={errors.address}><textarea value={form.address} onChange={set("address")} required /></Field>
        <Field label="Notes"><textarea value={form.notes} onChange={set("notes")} /></Field>
      </div>
      <div className="toolbar" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={busy}>{busy ? "Saving…" : initial ? "Update customer" : "Add customer"}</button>
      </div>
    </form>
  );
}

export default function Customers() {
  const { can } = useAuth();
  const editable = can("ADMIN", "SALES");
  const [rows, setRows] = useState<Customer[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    if (type) q.set("type", type);
    api.get<Paged<Customer>>(`/customers?${q}`)
      .then((r) => { setRows(r.data); setMeta(r.meta); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, search, status, type]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search typing
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="card">
      <div className="card-head">
        <div className="toolbar">
          <input placeholder="Search name, business, mobile…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All statuses</option><option value="LEAD">Lead</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
          </select>
          <select value={type} onChange={(e) => { setPage(1); setType(e.target.value); }}>
            <option value="">All types</option><option value="RETAIL">Retail</option><option value="WHOLESALE">Wholesale</option><option value="DISTRIBUTOR">Distributor</option>
          </select>
        </div>
        {editable && <button className="btn" onClick={() => setShowAdd(true)}>+ Add customer</button>}
      </div>

      {error && <div className="card-body"><Alert kind="error">{error}</Alert></div>}
      {loading ? <Loading what="customers" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Business</th><th>Mobile</th><th>Type</th><th>Status</th><th>Follow-up</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
                  <td>{c.businessName}</td>
                  <td>{c.mobile}</td>
                  <td><Badge status={c.type} /></td>
                  <td><Badge status={c.status} /></td>
                  <td className="muted">{date(c.followUpDate)}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn secondary small" to={`/customers/${c.id}`}>View</Link>
                      {editable && <button className="btn secondary small" onClick={() => setEditing(c)}>Edit</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="empty">No customers match your filters</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />

      {showAdd && (
        <Modal title="Add customer" onClose={() => setShowAdd(false)}>
          <CustomerForm onCancel={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <CustomerForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
        </Modal>
      )}
    </div>
  );
}
