import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    // Temporary frontend authentication
    localStorage.setItem("isLoggedIn", "true");

    // Navigate to Admin Dashboard
    navigate("/admin-dashboard");
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="logo-section">
          <div className="logo-icon">C</div>
          <h1>CampusOS</h1>
          <p>Smart Campus Management Platform</p>
        </div>

        <form onSubmit={handleLogin}>

          <div className="input-group">
            <label>Email Address</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-button">
            Sign In
          </button>

        </form>

        <p className="login-footer">
          Secure access to the CampusOS platform
        </p>

      </div>
    </div>
  );
}

export default Login;