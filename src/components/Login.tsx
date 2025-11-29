import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import Input from "./Input";
import "../assets/Login.css";
import { signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "./firebase";
import emailjs from "@emailjs/browser";

const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN = 60;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP States
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  
  // Timer States
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const showNotification = (message: string, type: "success" | "error" | "info" = "info") => {
    setModalMessage(message);
    setModalType(type);
    setShowModal(true);
  };

  const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

  const sendOtpEmail = async (toEmail: string, otpCode: string) => {
    try {
      await emailjs.send(
        "service_2rwmowf",          
        "template_13p1rni",          
        {
          to_email: toEmail.trim(),
          user_name: "Valued Customer",        
          message: `
            Hello!

            We noticed multiple failed login attempts on your GreenieCart account.

            To protect your account and unlock login access, please use the following One-Time Password (OTP):

            🎯 Your OTP: ${otpCode}

            This code is valid for the next 10 minutes only.

            If you did not attempt to log in, please ignore this email or contact support immediately.

            Thank you for shopping with GreenieCart!
            Stay safe,

            The GreenieCart Team
          `.replace(/^\s+/gm, ''), 
        },
        "g_32Hm9a0fyGUTR2Q" 
      );

      showNotification("OTP sent! Check your inbox or spam folder.", "success");
    } catch (err: any) {
      console.error("EmailJS OTP Error:", err);
      setError("Failed to send OTP. Please try again.");
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    
    const newOtp = generateOTP();
    setGeneratedOtp(newOtp);
    await sendOtpEmail(email, newOtp);
    
    setCanResend(false);
    setCountdown(RESEND_COOLDOWN);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const key = `failed_${email}`;
    const storedAttempts = Number(localStorage.getItem(key)) || 0;

    if (showOtpInput) {
      if (otp === generatedOtp) {
        localStorage.removeItem(key);
        setShowOtpInput(false);
        setOtp("");
        setCountdown(0);
        setCanResend(true);
        showNotification("Account unlocked! You can now log in.", "success");
        setLoading(false);
        return;
      } else {
        setError("Invalid OTP");
        setLoading(false);
        return;
      }
    }

    if (storedAttempts >= MAX_ATTEMPTS) {
      const newOtp = generateOTP();
      setGeneratedOtp(newOtp);
      await sendOtpEmail(email.trim(), newOtp);
      setShowOtpInput(true);
      setCanResend(false);
      setCountdown(RESEND_COOLDOWN);
      setError("Too many failed attempts. Check your email for OTP.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      localStorage.removeItem(key); 

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        setError("Please verify your email. Verification link sent.");
        await auth.signOut();
        setLoading(false);
        return;
      }

      navigate("/home");
    } catch (err: any) {
      const attempts = storedAttempts + 1;
      localStorage.setItem(key, attempts.toString());

      if (attempts >= MAX_ATTEMPTS) {
        const newOtp = generateOTP();
        setGeneratedOtp(newOtp);
        await sendOtpEmail(email.trim(), newOtp);
        setShowOtpInput(true);
        setCanResend(false);
        setCountdown(RESEND_COOLDOWN);
        setError("Too many failed attempts. OTP sent to your email.");
      } else {
        setError(
          err.code === "auth/wrong-password"
            ? `Wrong password. Attempt ${attempts}/${MAX_ATTEMPTS}`
            : "Invalid email or password."
        );
      }
    } finally {
      if (!showOtpInput) setLoading(false);
    }
  };

  return (
    <>
      <div className="login-wrapper">
        <div className="login-card">
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to continue shopping</p>

          {error && <div className="error-message">{error}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={showOtpInput}
            />

            {!showOtpInput ? (
              <div className="password-wrappers">
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="toggle-passwords"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEye /> : <FaEyeSlash />}
                </button>
              </div>
            ) : (
              <Input
                label="Enter 6-digit OTP"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
              />
            )}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Processing..." : showOtpInput ? "Verify OTP" : "Sign In"}
            </button>
          </form>

          {!showOtpInput && (
            <p className="login-footer">
              Don't have an account? <Link to="/register">Sign Up</Link>
            </p>
          )}

          {showOtpInput && (
            <p className="text-receive">
              Didn't receive it?{" "}
              <button
                type="button"
                onClick={handleResendOtp}
                className="text-resend"
                disabled={!canResend}
              >
                {canResend ? "Resend OTP" : `Resend OTP (${countdown}s)`}
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-icon modal-${modalType}`}>
              {modalType === "success" && "✓"}
              {modalType === "error" && "✕"}
              {modalType === "info" && "ℹ"}
            </div>
            <p className="modal-message">{modalMessage}</p>
            <button className="modal-btn" onClick={() => setShowModal(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;