import { useMemo, useState } from "react";
import { responseMealColumns, statusLabel } from "../utils/rsvpDisplay.js";

const SORT_KEYS = {
  name: "name",
  phone: "phone",
  status: "status",
  attendees: "attendees",
  veg: "veg",
  kids: "kids"
};

export default function GuestTable({ guests }) {
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

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

  const headerBtn = (label, key) => (
    <th scope="col">
      <button type="button" className="th-sort" onClick={() => toggleSort(key)}>
        {label}
        {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  if (!guests.length) {
    return (
      <section className="card">
        <h3>טבלת אורחים ותשובות בזמן אמת</h3>
        <div className="empty-state">אין עדיין אורחים להצגה. העלה קובץ CSV או רענן.</div>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>טבלת אורחים ותשובות בזמן אמת</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {headerBtn("שם", SORT_KEYS.name)}
              {headerBtn("טלפון", SORT_KEYS.phone)}
              {headerBtn("סטטוס", SORT_KEYS.status)}
              {headerBtn("כמות מגיעים", SORT_KEYS.attendees)}
              {headerBtn("צמחוני", SORT_KEYS.veg)}
              {headerBtn("מנות ילדים", SORT_KEYS.kids)}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ guest, meals, stat }) => (
              <tr key={guest.id}>
                <td>{guest.full_name}</td>
                <td>{guest.phone}</td>
                <td>{stat}</td>
                <td>{meals.attendees}</td>
                <td>{meals.veg}</td>
                <td>{meals.kids}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
