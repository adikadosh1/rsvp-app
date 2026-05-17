import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const palette = {
  coral: "#FF6B7A",
  primary: "#6F4CFF",
  ok: "#22c55e",
  danger: "#ef4444",
  accent: "#3BA7FF",
  uncertain: "#FF8F9A",
  muted: "#ECEEF5"
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{label || p.name}</div>
      <div className="chart-tip-val">{p.value}</div>
    </div>
  );
}

export function RSVPDonut({ stats }) {
  const data = [
    { name: "מגיעים", value: stats.arrived, color: palette.ok },
    { name: "לא מגיעים", value: stats.notArrived, color: palette.danger },
    { name: "לא ענו", value: stats.notAnswered, color: palette.accent },
    { name: "לא יודעים", value: stats.uncertain, color: palette.uncertain }
  ].filter((d) => d.value > 0);

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="chart-title">פילוח סטטוסים</div>
          <div className="hint">דונאט לפי סטטוס הגעה</div>
        </div>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data.length ? data : [{ name: "אין נתונים", value: 1, color: palette.muted }]}
              dataKey="value"
              innerRadius={68}
              outerRadius={92}
              paddingAngle={3}
              stroke="#ECEEF5"
              strokeWidth={2}
            >
              {(data.length ? data : [{ color: palette.muted }]).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          {[
            ["מגיעים", stats.arrived, palette.ok],
            ["לא מגיעים", stats.notArrived, palette.danger],
            ["לא ענו", stats.notAnswered, palette.accent],
            ["לא יודעים", stats.uncertain, palette.uncertain]
          ].map(([label, val, color]) => (
            <div key={label} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              <span className="legend-label">{label}</span>
              <span className="legend-val">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ResponsesByHour({ items }) {
  // items: [{ hourLabel, count }]
  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="chart-title">קצב תשובות</div>
          <div className="hint">כמה אישרו בכל שעה (24 שעות אחרונות)</div>
        </div>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={items} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="hourLabel" tick={{ fill: "#70768A", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#70768A", fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[10, 10, 0, 0]} fill={palette.coral} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RecentResponses({ items }) {
  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="chart-title">תשובות אחרונות</div>
          <div className="hint">עד 12 האחרונות</div>
        </div>
      </div>
      <div className="chart-body">
        {items?.length ? (
          <div className="recent-list">
            {items.map((it) => (
              <div key={`${it.guest_id}-${it.updated_at || ""}`} className="recent-item">
                <div className="recent-main">
                  <div className="recent-name">{it.name || "—"}</div>
                  <div className="recent-sub">
                    <span className="recent-status">{it.status || "—"}</span>
                    {it.attendees_count != null && <span className="recent-dot">•</span>}
                    {it.attendees_count != null && <span className="recent-count">{it.attendees_count} סועדים</span>}
                  </div>
                </div>
                <div className="recent-time">{it.updated_at ? new Date(it.updated_at).toLocaleString("he-IL") : ""}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="hint">עדיין אין תשובות</div>
        )}
      </div>
    </div>
  );
}

