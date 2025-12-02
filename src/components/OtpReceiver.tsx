// OtpReceiver.tsx
import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const OtpReceiver = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get("code");
    const email = searchParams.get("email");

    if (code && email) {
      localStorage.setItem("pending_otp", code);
      localStorage.setItem("pending_email", decodeURIComponent(email));
      navigate("/login");
    }
  }, [searchParams, navigate]);

  return <div style={{textAlign: "center", padding: "50px"}}>Redirecting to login...</div>;
};

export default OtpReceiver;