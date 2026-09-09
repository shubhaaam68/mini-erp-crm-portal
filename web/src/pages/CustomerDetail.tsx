import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Field, Loading } from "../components/ui";
import { api, date, dateTime, money } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Detail {
  id: string; name: string; mobile: string; email: string | null; businessName: string;
  gstNumber: string | null; type: string; address: string; status: string;
  followUpDate: string | null; notes: string | null; createdAt: string;
  followUps: { id: string; note: string; nextDate: string | null; createdAt: string; createdBy: { name: string; role: string } }[];
  challans: { id: string; challanNumber: string; status: string; totalQuantity: number; totalAmount: string; createdAt: string }[];
}

export default function CustomerDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");

  const load = useCallback(() => {
    api.get<{ data: Detail }>(`/customers/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function addFollowUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setOk("");
    try {
      await api.post(`/customers/${id}/follow-ups`, {
        note,
        nextDate: nextDate ? new Date(nextDate + "T00:00:00.000Z").toISOString() : "",
      });
      setNote(""); setNextDate(""); setOk("Follow-up note added."); load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Loading what="customer" />;

  const rows: [string, React.ReactNode][] = [
    ["Business", data.businessName],
    ["Mobile", data.mobile],
    ["Email", data.email || "—"],
    ["GST number", data.gstNumber || "—"],
    ["Type", <Badge status={data.type} />],
    ["Status", <Badge status={data.status} />],
    ["Follow-up date", date(data.followUpDate)],
    ["Address", data.address],
    ["Notes", data.notes || "—"],
    ["Created", dateTime(data.createdAt)],
  ];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="card">
        <div className="card-head">
          <h2>{data.name}</h2>
          <Link className="btn secondary small" to="/customers">Back to customers</Link>
        </div>
        <div className="table-wrap">
          <table>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}><th style={{ width: 180 }}>{k}</th><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Follow-up notes</h2></div>
        {can("ADMIN", "SALES") && (
          <div className="card-body" style={{ borderBottom: "1px solid var(--border)" }}>
            <Alert kind="error">{error}</Alert>
            <Alert kind="success">{ok}</Alert>
            <form onSubmit={addFollowUp} className="form-grid" style={{ alignItems: "end" }}>
              <Field label="Note *"><input value={note} onChange={(e) => setNote(e.target.value)} required placeholder="Called about pending order…" /></Field>
              <Field label="Next follow-up date"><input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
              <button className="btn" disabled={busy}>{busy ? "Saving…" : "Add follow-up"}</button>
            </form>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Note</th><th>Next date</th><th>By</th><th>Logged</th></tr></thead>
            <tbody>
              {data.followUps.map((f) => (
                <tr key={f.id}>
                  <td>{f.note}</td>
                  <td className="muted">{date(f.nextDate)}</td>
                  <td>{f.createdBy.name} <span className="muted">({f.createdBy.role})</span></td>
                  <td className="muted">{dateTime(f.createdAt)}</td>
                </tr>
              ))}
              {!data.followUps.length && <tr><td colSpan={4} className="empty">No follow-ups logged yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Challans for this customer</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Challan</th><th>Status</th><th className="num">Qty</th><th className="num">Amount</th><th>Created</th></tr></thead>
            <tbody>
              {data.challans.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/challans/${c.id}`}>{c.challanNumber}</Link></td>
                  <td><Badge status={c.status} /></td>
                  <td className="num">{c.totalQuantity}</td>
                  <td className="num">{money(c.totalAmount)}</td>
                  <td className="muted">{dateTime(c.createdAt)}</td>
                </tr>
              ))}
              {!data.challans.length && <tr><td colSpan={5} className="empty">No challans for this customer</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
