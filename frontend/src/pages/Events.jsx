import { useNavigate } from "react-router-dom";
import "./Events.css";

function Events() {
  const navigate = useNavigate();

  const events = [
    {
      title: "Tech Fest 2026",
      category: "Technical",
      venue: "Main Auditorium",
      date: "12 Sep 2026",
      time: "10:00 AM",
      status: "Approved",
    },
    {
      title: "Coding Competition",
      category: "Technical",
      venue: "Seminar Hall",
      date: "15 Sep 2026",
      time: "11:00 AM",
      status: "Pending",
    },
    {
      title: "Cultural Night",
      category: "Cultural",
      venue: "Main Auditorium",
      date: "20 Sep 2026",
      time: "5:00 PM",
      status: "Approved",
    },
    {
      title: "AI & Innovation Workshop",
      category: "Workshop",
      venue: "Conference Room",
      date: "25 Sep 2026",
      time: "2:00 PM",
      status: "Pending",
    },
  ];

  return (
    <div className="events-shell">

      {/* Sidebar */}
      <aside className="events-sidebar">

        <div className="events-brand">
          <div className="events-brand-mark">C</div>

          <div>
            <h2>CampusOS</h2>
            <p>SMART CAMPUS PLATFORM</p>
          </div>
        </div>

        <div className="events-sidebar-label">
          WORKSPACE
        </div>

        <nav className="events-nav">

          <button
            className="events-nav-item"
            onClick={() => navigate("/admin-dashboard")}
          >
            <span>▦</span>
            Overview
          </button>

          <button
            className="events-nav-item"
            onClick={() => navigate("/venues")}
          >
            <span>⌂</span>
            Venues
          </button>

          <button className="events-nav-item active">
            <span>◫</span>
            Events
          </button>

          <button className="events-nav-item">
            <span>✓</span>
            Approvals
            <b>8</b>
          </button>

        </nav>

        <div className="events-sidebar-label events-lower-label">
          MANAGEMENT
        </div>

        <nav className="events-nav">

          <button className="events-nav-item">
            <span>●</span>
            Users
          </button>

          <button className="events-nav-item">
            <span>▤</span>
            Reports
          </button>

        </nav>

        <div className="events-sidebar-footer">

          <div className="events-system-status">
            <span></span>
            System Operational
          </div>

          <button
            className="events-signout"
            onClick={() => navigate("/")}
          >
            Sign Out
          </button>

        </div>

      </aside>

      {/* Main Content */}
      <main className="events-main">

        {/* Top Bar */}
        <header className="events-topbar">

          <div className="events-breadcrumb">
            <span>CampusOS</span>
            <span>/</span>
            <strong>Event Management</strong>
          </div>

          <div className="events-admin-account">

            <div className="events-admin-avatar">
              A
            </div>

            <div>
              <strong>Administrator</strong>
              <p>Campus Administration</p>
            </div>

          </div>

        </header>

        {/* Page Title */}
        <section className="events-title-section">

          <div>

            <p className="events-page-label">
              EVENT MANAGEMENT
            </p>

            <h1>Campus Events</h1>

            <p className="events-description">
              Manage, monitor and organize events happening across campus.
            </p>

          </div>

          <button className="create-event-button">
            + Create Event
          </button>

        </section>

        {/* Summary Cards */}
        <section className="events-summary">

          <div className="events-summary-card">
            <p>Total Events</p>
            <h2>12</h2>
            <span>Scheduled this month</span>
          </div>

          <div className="events-summary-card">
            <p>Approved Events</p>
            <h2>8</h2>
            <span>Ready to publish</span>
          </div>

          <div className="events-summary-card">
            <p>Pending Approval</p>
            <h2>4</h2>
            <span>Awaiting review</span>
          </div>

        </section>

        {/* Event Section */}
        <section className="events-content">

          <div className="events-section-heading">

            <div>
              <h2>Upcoming Events</h2>
              <p>Manage upcoming campus activities and events.</p>
            </div>

            <span className="events-count">
              {events.length} Events
            </span>

          </div>

          <div className="events-list">

            {events.map((event, index) => (

              <div className="event-card" key={index}>

                <div className="event-date">

                  <span className="event-day">
                    {event.date.split(" ")[0]}
                  </span>

                  <span className="event-month">
                    {event.date.split(" ")[1]}
                  </span>

                </div>

                <div className="event-details">

                  <div className="event-title-row">

                    <div>

                      <span className="event-category">
                        {event.category}
                      </span>

                      <h3>{event.title}</h3>

                    </div>

                    <span
                      className={`event-status ${event.status.toLowerCase()}`}
                    >
                      {event.status}
                    </span>

                  </div>

                  <div className="event-info">

                    <span>📍 {event.venue}</span>

                    <span>🕒 {event.time}</span>

                  </div>

                </div>

              </div>

            ))}

          </div>

        </section>

      </main>

    </div>
  );
}

export default Events;