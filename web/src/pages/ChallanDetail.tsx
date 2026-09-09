import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Loading } from "../components/ui";
import { api, dateTime, money } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Challan {
  id: string; challanNumber: string; customerName: string; customerMobile: string;
  customerGst: string | null; status: string; totalQuantity: number; totalAmount: string;
  remarks: string | null; createdAt: string; confirmedAt: string | null; cancelledAt: string | null;
  customerId: string;
  createdBy: { name: string; role: string };
  items: { id: string; productName: string; sku: string; category: string; unitPrice: string; quantity: number; lineTotal: string }[];
}

export default function ChallanDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [data, setData] = useState<Challan | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<{ data: Challan }>(`/challans/${id}`).then((r) => setData(r.data)).catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function act(action: "confirm" | "cancel") {
    setBusy(true); setError(""); setOk("");
    try {
      await api.post(`/challans/${id}/${action}`);
      setOk(action === "confirm" ? "Challan confirmed and stock reduced." : "Challan cancelled; stock returned.");
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Loading what="challan" />;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="card">
        <div className="card-head">
          <h2>{data.challanNumber} <Badge status={data.status} /></h2>
          <div className="toolbar">
            {can("ADMIN", "SALES") && data.status === "DRAFT" && (
              <button className="btn" disabled={busy} onClick={() => act("confirm")}>Confirm challan</button>
            )}
            {can("ADMIN", "SALES") && data.status !== "CANCELLED" && (
              <button className="btn danger" disabled={busy} onClick={() => act("cancel")}>Cancel challan</button>
            )}
            <Link className="btn secondary" to="/challans">Back</Link>
          </div>
        </div>
        <div className="card-body">
          <Alert kind="error">{error}</Alert>
          <Alert kind="success">{ok}</Alert>
          <div className="form-grid">
            <div><div className="muted">Customer</div><Link to={`/customers/${data.customerId}`}>{data.customerName}</Link></div>
            <div><div className="muted">Mobile</div>{data.customerMobile}</div>
            <div><div className="muted">GST</div>{data.customerGst || "—"}</div>
            <div><div className="muted">Created by</div>{data.createdBy.name} ({data.createdBy.role})</div>
            <div><div className="muted">Created</div>{dateTime(data.createdAt)}</div>
            <div><div className="muted">Confirmed</div>{dateTime(data.confirmedAt)}</div>
            <div><div className="muted">Cancelled</div>{dateTime(data.cancelledAt)}</div>
            <div><div className="muted">Remarks</div>{data.remarks || "—"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Line items (snapshot taken when the challan was created)</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Category</th><th className="num">Unit price</th><th className="num">Qty</th><th className="num">Line total</th></tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.productName}</td>
                  <td className="muted">{i.sku}</td>
                  <td>{i.category}</td>
                  <td className="num">{money(i.unitPrice)}</td>
                  <td className="num">{i.quantity}</td>
                  <td className="num">{money(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th colSpan={4} className="num">Total</th><th className="num">{data.totalQuantity}</th><th className="num">{money(data.totalAmount)}</th></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
