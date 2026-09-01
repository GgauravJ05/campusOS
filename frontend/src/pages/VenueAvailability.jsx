import { useNavigate } from "react-router-dom";
import "./VenueAvailability.css";

function VenueAvailability() {
  const navigate = useNavigate();

  const venues = [
    {
      name: "Main Auditorium",
      type: "Large Event Venue",
      capacity: 500,
      slots: [
        { time: "9:00 AM - 11:00 AM", status: "Available" },
        { time: "11:30 AM - 1:30 PM", status: "Pending" },
        { time: "2:00 PM - 4:00 PM", status: "Booked" },
      ],
    },
    {
      name: "Seminar Hall",
      type: "Academic & Club Activities",
      capacity: 200,
      slots: [
        { time: "9:00 AM - 11:00 AM", status: "Booked" },
        { time: "11:30 AM - 1:30 PM", status: "Available" },
        { time: "2:00 PM - 4:00 PM", status: "Available" },
      ],
    },
    {
      name: "Conference Room",
      type: "Meetings & Discussions",
      capacity: 50,
      slots: [
        { time: "9:00 AM - 11:00 AM", status: "Available" },
        { time: "11:30 AM - 1:30 PM", status: "Pending" },
        { time: "2:00 PM - 4:00 PM", status: "Booked" },
      ],
    },
  ];

  return (
    <div className="venue-shell">

      {/* Sidebar */}
      <aside className="venue-sidebar">

        <div className="venue-brand">
          <div className="venue-brand-mark">C</div>

          <div>
            <h2>CampusOS</h2>
            <p>SMART CAMPUS PLATFORM</p>
          </div>
        </div>

        <div className="venue-sidebar-label">
          WORKSPACE
        </div>

        <nav className="venue-nav">

          <button
            className="venue-nav-item"
            onClick={() => navigate("/admin-dashboard")}
          >
            <span>▦</span>
            Overview
          </button>

          <button className="venue-nav-item active">
            <span>⌂</span>
            Venues
          </button>

          <button className="venue-nav-item">
            <span>◫</span>
            Events
          </button>

          <button className="venue-nav-item">
            <span>✓</span>
            Approvals
            <b>8</b>
          </button>

        </nav>

        <div className="venue-sidebar-label venue-lower-label">
          MANAGEMENT
        </div>

        <nav className="venue-nav">

          <button className="venue-nav-item">
            <span>●</span>
            Users
          </button>

          <button className="venue-nav-item">
            <span>▤</span>
            Reports
          </button>

        </nav>

        <div className="venue-sidebar-footer">

          <div className="venue-system-status">
            <span></span>
            System Operational
          </div>

          <button
            className="venue-signout"
            onClick={() => navigate("/")}
          >
            Sign Out
          </button>

        </div>

      </aside>

      {/* Main Content */}
      <main className="venue-main">

        {/* Top Bar */}
        <header className="venue-topbar">

          <div className="venue-breadcrumb">
            <span>CampusOS</span>
            <span>/</span>
            <strong>Venue Management</strong>
          </div>

          <div className="venue-admin-account">

            <div className="venue-admin-avatar">
              A
            </div>

            <div>
              <strong>Administrator</strong>
              <p>Campus Administration</p>
            </div>

          </div>

        </header>

        {/* Page Header */}
        <section className="venue-title-section">

          <div>

            <p className="venue-page-label">
              RESOURCE MANAGEMENT
            </p>

            <h1>Venue Availability</h1>

            <p className="venue-description">
              Monitor venue availability and manage booking schedules across campus.
            </p>

          </div>

          <button
            className="dashboard-button"
            onClick={() => navigate("/admin-dashboard")}
          >
            ← Back to Dashboard
          </button>

        </section>

        {/* Status Summary */}
        <section className="status-summary">

          <div className="status-summary-item">
            <span className="status-dot available-dot"></span>

            <div>
              <strong>Available</strong>
              <p>Ready for booking</p>
            </div>

          </div>

          <div className="status-summary-item">
            <span className="status-dot pending-dot"></span>

            <div>
              <strong>Pending Approval</strong>
              <p>Waiting for approval</p>
            </div>

          </div>

          <div className="status-summary-item">
            <span className="status-dot booked-dot"></span>

            <div>
              <strong>Booked</strong>
              <p>Currently reserved</p>
            </div>

          </div>

        </section>

        {/* Venue Grid */}
        <section className="venue-content">

          <div className="venue-section-heading">

            <div>
              <h2>Campus Venues</h2>
              <p>Live booking status for today's schedule</p>
            </div>

            <span className="venue-count">
              {venues.length} Venues
            </span>

          </div>

          <div className="venue-grid">

            {venues.map((venue) => (

              <div className="campus-venue-card" key={venue.name}>

                <div className="venue-card-header">

                  <div>

                    <span className="venue-type">
                      {venue.type}
                    </span>

                    <h2>{venue.name}</h2>

                  </div>

                  <div className="venue-icon">
                    ⌂
                  </div>

                </div>

                <div className="venue-capacity">
                  <span>Capacity</span>
                  <strong>{venue.capacity} People</strong>
                </div>

                <div className="venue-divider"></div>

                <p className="slots-heading">
                  TODAY'S TIME SLOTS
                </p>

                <div className="venue-slots">

                  {venue.slots.map((slot, index) => (

                    <div
                      className={`venue-slot ${slot.status.toLowerCase()}`}
                      key={index}
                    >

                      <div>
                        <span className="slot-time">
                          {slot.time}
                        </span>
                      </div>

                      <span className="slot-status">
                        {slot.status}
                      </span>

                    </div>

                  ))}

                </div>

              </div>

            ))}

          </div>

        </section>

      </main>

    </div>
  );
}

export default VenueAvailability;