import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const ProtectedRoute = ({ children, allowedRole }) => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      toast.error("Please log in to access this page.");
      const timer = setTimeout(() => navigate("/", { replace: true }), 1000);
      return () => clearTimeout(timer);
    }

    if (allowedRole && role !== allowedRole) {
      toast.error("You are not authorized to view this page.");
      const timer = setTimeout(() => {
        if (role === "buyer") navigate("/buyer-dashboard", { replace: true });
        else if (role === "cardholder") navigate("/cardholder-dashboard", { replace: true });
        else navigate("/", { replace: true });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [token, role, allowedRole, navigate]);

  if (!token || (allowedRole && role !== allowedRole)) return null;

  return children;
};

export default ProtectedRoute;