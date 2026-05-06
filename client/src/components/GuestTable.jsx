export default function GuestTable({ guests }) {
  return (
    <section className="card">
      <h3>טבלת אורחים ותשובות בזמן אמת</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>שם</th>
              <th>טלפון</th>
              <th>סטטוס</th>
              <th>כמות מגיעים</th>
              <th>צמחוני</th>
              <th>מנות ילדים</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest) => {
              const response = guest.latestResponse;
              return (
                <tr key={guest.id}>
                  <td>{guest.full_name}</td>
                  <td>{guest.phone}</td>
                  <td>{response?.status || "טרם ענה"}</td>
                  <td>{response?.attendees_count || "-"}</td>
                  <td>{response?.vegetarian_count || "-"}</td>
                  <td>{response?.kids_meals_count || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
