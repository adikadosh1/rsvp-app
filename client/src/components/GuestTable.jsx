import { useMemo, useState } from "react";
import { Bell, Pencil } from "lucide-react";
import { apiFetch } from "../lib/api.js";
import { avatarColorFor, avatarInitial } from "../lib/avatarColor.js";
import { useToast } from "./ToastProvider.jsx";
import EmptyState from "./EmptyState.jsx";
import { responseMealColumns, statusLabel } from "../utils/rsvpDisplay.js";

const PAGE_SIZE = 12;

const SORT_KEYS = {
  name: "name",
  phone: "phone",
  status: "status",
  attendees: "attendees",
  veg: "veg",
  kids: "kids"
};

function badgeClass(stat) {
  if (stat === "מגיע") return "badge badge-ok";
  if (stat === "לא מגיע") return "badge badge-danger";
  if (stat === "לא יודע") return "badge badge-warn";
  if (stat === "טרם ענה") return "badge badge-pending";
  return "badge badge-muted";
}

export default function GuestTable({ guests, eventId, embedded = false }) {
  const toast = useToast();
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [sendingId, setSendingId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSort = (key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  };

  const sorted = useMemo(() => {
    const rows = guests.map((guest) => {
      const response = guest.latestResponse;
      const meals = responseMealColumns(response);
      const stat = statusLabel(guest);
      return {
        guest,
        sortValues: {
          name: (guest.full_name || "").toLowerCase(),
          phone: guest.phone || "",
          status: stat,
          attendees: Number(meals.attendees === "-" ? 0 : meals.attendees),
          veg: Number(meals.veg === "-" ? 0 : meals.veg),
          kids: Number(meals.kids === "-" ? 0 : meals.kids)
        },
        meals,
        stat
      };
    });

    rows.sort((a, b) => {
      const va = a.sortValues[sortKey] ?? "";
      const vb = b.sortValues[sortKey] ?? "";
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "he");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [guests, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageIds = pageRows.map(({ guest }) => guest.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const sendReminder = async (guest) => {
    if (!eventId || !guest?.invite_token) return;
    try {
      setSendingId(guest.id);
      await apiFetch(`/events/${eventId}/guests/${guest.id}/send-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "sms", reminderText: `שלום ${guest.full_name}, נשמח לאישור הגעה` })
      });
      toast.push({
        tone: "success",
        title: "תזכורת נשלחה",
        message: `נשלחה תזכורת ל־${guest.full_name || "האורח"}`
      });
    } catch (e) {
      toast.push({ tone: "danger", title: "שליחה נכשלה", message: e.message });
    } finally {
      setSendingId(null);
    }
  };

  const headerBtn = (label, key) => (
    <th scope="col">
      <button type="button" className="th-sort" onClick={() => toggleSort(key)}>
        {label}
        {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  if (!guests.length) {
    if (embedded) {
      return <EmptyState title="אין אורחים עדיין" description="העלו קובץ CSV או ייבאו מאנשי קשר כדי להתחיל." />;
    }
    return (
      <section className="card">
        <h3>טבלת אורחים ותשובות בזמן אמת</h3>
        <EmptyState title="אין אורחים עדיין" description="העלו קובץ CSV או ייבאו מאנשי קשר כדי להתחיל." />
      </section>
    );
  }

  const content = (
    <>
      {selected.size > 0 && (
        <div className="bulk-bar" role="toolbar" aria-label="פעולות מרובות">
          <span>
            נבחרו <strong>{selected.size}</strong> אורחים
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setSelected(new Set())}>
            ביטול בחירה
          </button>
        </div>
      )}
      <div className="table-wrapper">
        <table className="table-pro">
          <thead>
            <tr>
              <th scope="col" style={{ width: 44 }}>
                <input
                  type="checkbox"
                  aria-label="בחר הכל בעמוד"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              {headerBtn("שם", SORT_KEYS.name)}
              {headerBtn("טלפון", SORT_KEYS.phone)}
              {headerBtn("סטטוס", SORT_KEYS.status)}
              {headerBtn("כמות מגיעים", SORT_KEYS.attendees)}
              {headerBtn("צמחוני", SORT_KEYS.veg)}
              {headerBtn("מנות ילדים", SORT_KEYS.kids)}
              <th scope="col">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ guest, meals, stat }) => (
              <tr key={guest.id} className={selected.has(guest.id) ? "row-selected" : undefined}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`בחר ${guest.full_name || "אורח"}`}
                    checked={selected.has(guest.id)}
                    onChange={() => toggleSelect(guest.id)}
                  />
                </td>
                <td>
                  <div className="guest-cell-name">
                    <span className="guest-avatar" style={{ background: avatarColorFor(guest.full_name || "") }} aria-hidden="true">
                      {avatarInitial(guest.full_name || "")}
                    </span>
                    <span>{guest.full_name}</span>
                  </div>
                </td>
                <td>{guest.phone}</td>
                <td>
                  <span className={badgeClass(stat)}>{stat}</span>
                </td>
                <td>{meals.attendees}</td>
                <td>{meals.veg}</td>
                <td>{meals.kids}</td>
                <td>
                  <div className="table-actions">
                    {stat === "טרם ענה" && eventId ? (
                      <button
                        type="button"
                        className="btn btn-icon btn-accent"
                        disabled={sendingId === guest.id}
                        onClick={() => sendReminder(guest)}
                        title="שלח תזכורת"
                      >
                        <Bell size={14} />
                      </button>
                    ) : null}
                    <a className="btn btn-icon" href={`/rsvp/${guest.invite_token}`} target="_blank" rel="noreferrer" title="צפה בדף RSVP">
                      <Pencil size={14} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="pagination" aria-label="עימוד טבלה">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            הקודם
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
            .map((n, idx, arr) => {
              const prev = arr[idx - 1];
              const gap = prev && n - prev > 1;
              return (
                <span key={n} style={{ display: "contents" }}>
                  {gap ? <span className="hint">…</span> : null}
                  <button type="button" className={page === n ? "active" : ""} onClick={() => setPage(n)}>
                    {n}
                  </button>
                </span>
              );
            })}
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            הבא
          </button>
        </nav>
      )}
    </>
  );

  if (embedded) {
    return <div className="event-guests-table">{content}</div>;
  }

  return (
    <section className="card">
      <h3>טבלת אורחים ותשובות בזמן אמת</h3>
      {content}
    </section>
  );
}
