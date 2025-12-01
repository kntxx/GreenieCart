import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaEye,
  FaEyeSlash,
  FaCheck,
  FaTimes,
  FaCheckCircle,
} from "react-icons/fa";
import Input from "./Input";
import "../assets/Register.css";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import {
  setDoc,
  doc,
  collection,
  getCountFromServer,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";


const Register: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    contact: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    contact: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [passwordRules, setPasswordRules] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Allow only numbers for contact
    if (name === "contact" && !/^\d*$/.test(value)) return;
    if (name === "contact" && value.length > 11) return;

    setFormData((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));

    // Update password rules in real-time
    if (name === "password") {
      const pwd = value;
      setPasswordRules({
        length: pwd.length >= 8,
        uppercase: /[A-Z]/.test(pwd),
        lowercase: /[a-z]/.test(pwd),
        number: /\d/.test(pwd),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      });
    }
  };

  const allRulesPassed = Object.values(passwordRules).every(Boolean);
  const passwordsMatch =
    formData.password === formData.confirmPassword && formData.password !== "";
  const contactValid =
    formData.contact.length === 11 && formData.contact.startsWith("09");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);

  const isFormValid =
    formData.firstName.trim() &&
    formData.lastName.trim() &&
    contactValid &&
    emailValid &&
    allRulesPassed &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Mark all fields as touched
    setTouched({
      firstName: true,
      lastName: true,
      contact: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (!isFormValid) {
      setError("Please fix all errors before submitting.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      // 2. Send verification email
     // Sa Register.tsx → handleSubmit()
await sendEmailVerification(user, {
  url: window.location.origin, // ← KINI ANG MAGIC LINE!
  // or hardcode for testing:
  // url: "http://localhost:3000"
});

      // 3. Generate custom USER001, USER002, etc.
      const usersRef = collection(db, "users");
      const snapshot = await getCountFromServer(usersRef);
      const totalUsers = snapshot.data().count;
      const newUserNumber = totalUsers + 1;
      const customUserId = `USER${String(newUserNumber).padStart(3, "0")}`;

      // 4. Save user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        userId: customUserId,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        contact: formData.contact,
        email: formData.email.toLowerCase(),
        emailVerified: false,
        createdAt: new Date(),
      });

      // SUCCESS! Show success screen
      setSuccess(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };


useEffect(() => {
  if (!success) return;

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      // ALWAYS RELOAD para ma-update ang emailVerified status
      await user.reload();

      if (user.emailVerified) {
        // SUCCESS! Auto login
        setSuccess(false);

        // Optional: Update Firestore nga verified na
        await setDoc(doc(db, "users", user.uid), {
          emailVerified: true,
          verifiedAt: new Date(),
        }, { merge: true });

        // Navigate to home
        navigate("/home", { replace: true });
      }
    }
  });

  // Poll every 2 seconds (faster detection)
  const interval = setInterval(() => {
    auth.currentUser?.reload();
  }, 2000);

  // Cleanup
  return () => {
    unsubscribe();
    clearInterval(interval);
  };
}, [success, navigate]);



  // SUCCESS SCREEN (NOW INSIDE RETURN!)
  if (success) {
    return (
      <div className="register-wrapper success-screen">
        <div className="success-card">
          <div className="success-icon">
            <FaCheckCircle color="#22c55e" size={80} />
          </div>
          <h1>Check Your Email!</h1>
          <p>
            Verification link sent to:
            <br />
            <strong>{formData.email}</strong>
          </p>

          <div style={{
            background: "#fefce8",
            padding: "16px",
            borderRadius: "12px",
            margin: "20px 0",
            border: "1px solid #f59e0b"
          }}>
            <p style={{ margin: 0, color: "#92400e", fontWeight: "600" }}>
              You cannot log in until you verify your email.
              <br />
              <span style={{ fontSize: "0.9rem", fontWeight: "normal" }}>
                We will automatically log you in once verified!
              </span>
            </p>
          </div>

    <div className="success-actions">
  {/* RESEND EMAIL */}
  <button
    className="resend-btn"
    onClick={async () => {
      if (auth.currentUser) {
        setLoading(true);
        await sendEmailVerification(auth.currentUser, {
          url: window.location.origin,
        });
        setLoading(false);
        alert("Verification email sent again!");
      }
    }}
    disabled={loading}
  >
    {loading ? "Sending..." : "Resend Email"}
  </button>

  {/* OPEN EMAIL PROVIDER */}
  <button
    className="open-email-btn"
    onClick={() => {
      const domain = formData.email.split("@")[1].toLowerCase();
      const providers: Record<string, string> = {
        "gmail.com": "https://mail.google.com",
        "yahoo.com": "https://mail.yahoo.com",
        "outlook.com": "https://outlook.live.com",
        "hotmail.com": "https://outlook.live.com",
        "icloud.com": "https://www.icloud.com/mail",
      };
      window.open(providers[domain] || `https://${domain}`, "_blank");
    }}
  >
    Open Email
  </button>

  {/* BACK TO LOGIN (NEW!) */}
  <button
    className="back-to-login-btn"
    onClick={() => {
      setSuccess(false);
      navigate("/login", { replace: true });
    }}
    style={{
      marginTop: "12px",
      background: "transparent",
      color: "#666",
      border: "1px solid #ddd",
      padding: "12px 20px",
      borderRadius: "12px",
      fontSize: "0.95rem",
      cursor: "pointer",
    }}
  >
    Back to Login
  </button>
</div>

          <div style={{ marginTop: "20px", color: "#666", fontSize: "0.9rem" }}>
            <p>Checking verification every 3 seconds...</p>
          </div>
        </div>
      </div>
    );
  }
  // MAIN REGISTRATION FORM
  return (
    <div className="register-wrapper">
      <div className="register-card">
        <h1 className="register-title">Create Account</h1>
        <p className="register-subtitle">Start your shopping journey</p>

        {error && <div className="error-message">{error}</div>}

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          {/* First Name & Last Name */}
          <div className="name-row">
            <div
              className={`input-container ${
                touched.firstName && !formData.firstName.trim()
                  ? "error"
                  : formData.firstName.trim()
                  ? "valid"
                  : ""
              }`}
            >
              <Input
                label="First Name"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                onBlur={() => setTouched((prev) => ({ ...prev, firstName: true }))}
                placeholder="First name"
                required
              />
              {touched.firstName && !formData.firstName.trim() && (
                <small className="field-error">First name is required</small>
              )}
            </div>

            <div
              className={`input-container ${
                touched.lastName && !formData.lastName.trim()
                  ? "error"
                  : formData.lastName.trim()
                  ? "valid"
                  : ""
              }`}
            >
              <Input
                label="Last Name"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                onBlur={() => setTouched((prev) => ({ ...prev, lastName: true }))}
                placeholder="Last name"
                required
              />
              {touched.lastName && !formData.lastName.trim() && (
                <small className="field-error">Last name is required</small>
              )}
            </div>
          </div>

          {/* Contact & Email */}
          <div className="name-row">
            <div
              className={`input-container ${
                touched.contact && !contactValid
                  ? "error"
                  : contactValid
                  ? "valid"
                  : ""
              }`}
            >
              <Input
                label="Contact Number"
                type="tel"
                name="contact"
                value={formData.contact}
                onChange={handleChange}
                onBlur={() => setTouched((prev) => ({ ...prev, contact: true }))}
                placeholder="e.g. 09123456789"
                maxLength={11}
                required
              />
              {touched.contact && !contactValid && (
                <small className="field-error">
                  {formData.contact.length === 0
                    ? "Contact number is required"
                    : "Must be 11 digits starting with 09"}
                </small>
              )}
            </div>

            <div
              className={`input-container ${
                touched.email && !emailValid ? "error" : emailValid ? "valid" : ""
              }`}
            >
              <Input
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                placeholder="Enter your email"
                required
              />
              {touched.email && !emailValid && (
                <small className="field-error">
                  {formData.email.length === 0 ? "Email is required" : "Invalid email address"}
                </small>
              )}
            </div>
          </div>

          {/* Password */}
          <div className="password-wrapper">
            <div
              className={`input-container ${
                touched.password && !allRulesPassed
                  ? "error"
                  : allRulesPassed
                  ? "valid"
                  : ""
              }`}
            >
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                placeholder="Create a strong password"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEye /> : <FaEyeSlash />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="password-wrapper">
            <div
              className={`input-container ${
                touched.confirmPassword && !passwordsMatch
                  ? "error"
                  : passwordsMatch
                  ? "valid"
                  : ""
              }`}
            >
              <Input
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, confirmPassword: true }))
                }
                placeholder="Repeat your password"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <FaEye /> : <FaEyeSlash />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="password-requirements-compact">
            <div className="req-item">
              <span className={passwordRules.length ? "valid" : ""}>
                {passwordRules.length ? <FaCheck /> : <FaTimes />} 8+ characters
              </span>
              <span className={passwordRules.uppercase ? "valid" : ""}>
                {passwordRules.uppercase ? <FaCheck /> : <FaTimes />} A-Z
              </span>
            </div>
            <div className="req-item">
              <span className={passwordRules.lowercase ? "valid" : ""}>
                {passwordRules.lowercase ? <FaCheck /> : <FaTimes />} a-z
              </span>
              <span className={passwordRules.number ? "valid" : ""}>
                {passwordRules.number ? <FaCheck /> : <FaTimes />} 0-9
              </span>
              <span className={passwordRules.special ? "valid" : ""}>
                {passwordRules.special ? <FaCheck /> : <FaTimes />} !@#$%
              </span>
            </div>
            <div className="match-status">
              {touched.confirmPassword &&
                (passwordsMatch ? (
                  <span style={{ color: "#22c55e" }}>Passwords match</span>
                ) : (
                  <span style={{ color: "#ef4444" }}>Passwords do not match</span>
                ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="register-btn"
            disabled={loading || !isFormValid}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <p className="register-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;