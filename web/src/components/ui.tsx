import { ReactNode } from "react";

export function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "green", CONFIRMED: "green", IN: "green",
    LEAD: "blue", DRAFT: "amber", OUT: "amber",
    INACTIVE: "gray", CANCELLED: "red",
    ADMIN: "blue", SALES: "blue", WAREHOUSE: "gray", ACCOUNTS: "gray",
    RETAIL: "gray", WHOLESALE: "blue", DISTRIBUTOR: "green",
  };
  return <span className={`badge ${map[status] || "gray"}`}>{status}</span>;
}

export function Alert({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  if (!children) return null;
  return <div className={`alert ${kind}`}>{children}</div>;
}

export function Pager({
  page, totalPages, total, onPage,
}: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="pager">
      <span className="muted">{total} record{total === 1 ? "" : "s"} · page {page} of {totalPages}</span>
      <span className="toolbar">
        <button className="btn secondary small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn secondary small" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
      </span>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2>{title}</h2>
          <button className="btn secondary small" onClick={onClose}>Close</button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label, error, children,
}: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error ? <span className="err">{error}</span> : null}
    </div>
  );
}

export function Loading({ what = "data" }: { what?: string }) {
  return <div className="empty">Loading {what}…</div>;
}
