import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getAuthToken, getAuthRole } from "../utils/authHelper";

const ProtectedRoute = ({ children, allowedRole }) => {
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = () => {
      const token = getAuthToken(allowedRole);
      const role = getAuthRole(allowedRole);

      if (!token) {
        toast.error("Please log in to access this page.");
        navigate(allowedRole === "admin" ? "/admin" : allowedRole === "cardholder" ? "/cardholder" : "/", { replace: true });
        setIsChecking(false);
        return;
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [allowedRole, navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;