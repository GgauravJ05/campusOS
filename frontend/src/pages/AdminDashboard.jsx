import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    navigate("/");
  };

  return (
    <div className="campus-shell">

      {/* Sidebar */}
      <aside className="campus-sidebar">

        <div className="brand">
          <div className="brand-mark">C</div>

          <div>
            <h2>CampusOS</h2>
            <p>SMART CAMPUS PLATFORM</p>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="campus-nav">

          {/* Overview */}
          <button
            type="button"
            className="nav-item active"
            onClick={() => navigate("/admin-dashboard")}
          >
            <span>▦</span>
            Overview
          </button>

          {/* Venues */}
          <button
            type="button"
            className="nav-item"
            onClick={() => navigate("/venues")}
          >
            <span>⌂</span>
            Venues
          </button>

          <button
  type="button"
  className="nav-item"
  onClick={() => alert("EVENT BUTTON WORKING")}
>
  <span>◫</span>
  Events
</button>

          {/* Approvals */}
          <button type="button" className="nav-item">
            <span>✓</span>
            Approvals
            <b>8</b>
          </button>

        </nav>

        <div className="sidebar-label lower-label">
          MANAGEMENT
        </div>

        <nav className="campus-nav">

          <button type="button" className="nav-item">
            <span>●</span>
            Users
          </button>

          <button type="button" className="nav-item">
            <span>▤</span>
            Reports
          </button>

        </nav>

        <div className="sidebar-footer">

          <div className="system-status">
            <span></span>
            System Operational
          </div>

          <button
            type="button"
            className="signout-button"
            onClick={handleLogout}
          >
            Sign Out
          </button>

        </div>

      </aside>

      {/* Main Dashboard */}
      <main className="campus-main">

        {/* Top Bar */}
        <header className="topbar">

          <div className="breadcrumb">
            <span>CampusOS</span>
            <span>/</span>
            <strong>Overview</strong>
          </div>

          <div className="admin-account">

            <div className="admin-avatar">
              A
            </div>

            <div>
              <strong>Administrator</strong>
              <p>Campus Administration</p>
            </div>

          </div>

        </header>

        {/* Welcome Section */}
        <section className="welcome-section">

          <div>

            <p className="date-text">
              CAMPUS OPERATIONS · TODAY
            </p>

            <h1>Good morning, Administrator.</h1>

            <p className="welcome-text">
              Here is a live overview of your campus activity and operations.
            </p>

          </div>

          <div className="live-indicator">
            <span></span>
            LIVE SYSTEM
          </div>

        </section>

        {/* Campus Snapshot */}
        <section className="snapshot-section">

          <div className="section-heading">

            <div>
              <h2>Campus Snapshot</h2>
              <p>Current operational status across the platform</p>
            </div>

          </div>

          <div className="snapshot-grid">

            <div className="snapshot-card">
              <span className="card-label">EVENTS TODAY</span>
              <h3>04</h3>
              <p>2 upcoming in the next 3 hours</p>
            </div>

            <div className="snapshot-card">
              <span className="card-label">VENUES IN USE</span>
              <h3>06</h3>
              <p>9 venues currently available</p>
            </div>

            <div className="snapshot-card attention">
              <span className="card-label">PENDING APPROVALS</span>
              <h3>08</h3>
              <p>Requires administrative review</p>
            </div>

            <div className="snapshot-card">
              <span className="card-label">ACTIVE USERS</span>
              <h3>124</h3>
              <p>Currently active on CampusOS</p>
            </div>

          </div>

        </section>

        {/* Bottom Section */}
        <section className="operations-grid">

          {/* Today's Schedule */}
          <div className="schedule-panel">

            <div className="panel-header">
              <div>
                <p className="panel-label">CAMPUS TIMELINE</p>
                <h2>Today's Schedule</h2>
              </div>
            </div>

            <div className="timeline">

              <div className="timeline-item">

                <div className="timeline-time">
                  09:00
                </div>

                <div className="event-info">

                  <span className="event-tag academic">
                    ACADEMIC
                  </span>

                  <h3>Technical Seminar</h3>

                  <p>
                    Main Auditorium · 280 / 500 seats
                  </p>

                </div>

              </div>

              <div className="timeline-item">

                <div className="timeline-time">
                  11:30
                </div>

                <div className="event-info">

                  <span className="event-tag club">
                    CLUB EVENT
                  </span>

                  <h3>Developer Club Meeting</h3>

                  <p>
                    Seminar Hall · Pending venue setup
                  </p>

                </div>

              </div>

              <div className="timeline-item">

                <div className="timeline-time">
                  14:00
                </div>

                <div className="event-info">

                  <span className="event-tag career">
                    CAREER
                  </span>

                  <h3>Placement Preparation Workshop</h3>

                  <p>
                    Conference Hall · 75 / 120 seats
                  </p>

                </div>

              </div>

            </div>

          </div>

          {/* Needs Attention */}
          <div className="operations-panel">

            <div className="panel-header">
              <div>
                <p className="panel-label">ACTION CENTER</p>
                <h2>Needs Attention</h2>
              </div>
            </div>

            <div className="action-list">

              <button type="button" className="action-card">

                <div className="action-number warning">
                  08
                </div>

                <div>
                  <h3>Pending Venue Requests</h3>
                  <p>Review and route approval requests</p>
                </div>

                <span>→</span>

              </button>

              <button type="button" className="action-card">

                <div className="action-number neutral">
                  03
                </div>

                <div>
                  <h3>Approval Escalations</h3>
                  <p>College-level events awaiting review</p>
                </div>

                <span>→</span>

              </button>

              <button
                type="button"
                className="action-card"
                onClick={() => navigate("/venues")}
              >

                <div className="action-number success">
                  09
                </div>

                <div>
                  <h3>Venues Available</h3>
                  <p>View live venue and slot status</p>
                </div>

                <span>→</span>

              </button>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default AdminDashboard;