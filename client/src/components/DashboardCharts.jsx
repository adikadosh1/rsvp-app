import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { avatarColorFor, avatarInitial } from "../lib/avatarColor.js";

const palette = {
  primary: "#5C2D91",
  ok: "#22c55e",
  danger: "#ef4444",
  accent: "#00B4D8",
  gold: "#F4A825",
  uncertain: "#9CA3AF",
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
  const total = stats.total || 0;
  const pct = total ? Math.round((stats.arrived / total) * 100) : 0;
  const data = [
    { name: "מגיעים", value: stats.arrived, color: palette.primary },
    { name: "לא מגיעים", value: stats.notArrived, color: palette.danger },
    { name: "לא ענו", value: stats.notAnswered, color: palette.accent },
    { name: "לא יודעים", value: stats.uncertain, color: palette.gold }
  ].filter((d) => d.value > 0);

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="chart-title">פילוח סטטוסים</div>
          <div className="hint">דונאט לפי סטטוס הגעה</div>
        </div>
      </div>
      <div className="chart-body" style={{ position: "relative" }}>
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
        <div
          className="donut-center-label"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -58%)",
            pointerEvents: "none"
          }}
        >
          <div className="big">{stats.arrived}</div>
          <div className="hint">{pct}% מגיעים</div>
        </div>
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
  const gradientId = "responsesAreaFill";
  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="chart-title">קצב תשובות</div>
          <div className="hint">תשובות לאורך זמן (24 שעות אחרונות)</div>
        </div>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={items} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.primary} stopOpacity={0.35} />
                <stop offset="100%" stopColor={palette.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="hourLabel" tick={{ fill: "#70768A", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#70768A", fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke={palette.primary}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={{ fill: palette.primary, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
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
          <div className="activity-feed">
            {items.map((it) => (
              <div key={`${it.guest_id}-${it.updated_at || ""}`} className="activity-item">
                <div className="guest-avatar" style={{ background: avatarColorFor(it.name || "") }} aria-hidden="true">
                  {avatarInitial(it.name || "")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="recent-name">{it.name || "—"}</div>
                  <div className="recent-sub">
                    <span className="recent-status">{it.status || "—"}</span>
                  </div>
                </div>
                <div className="recent-time">{it.updated_at ? new Date(it.updated_at).toLocaleTimeString("he-IL") : ""}</div>
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

