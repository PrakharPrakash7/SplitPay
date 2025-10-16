import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Admin logged in: ${data.user.name}`);
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", "admin");
        navigate("/admin-dashboard");
      } else {
        toast.error(data.message || "Invalid credentials");
      }
    } catch (err) {
      toast.error("Login failed. Check backend is running.");
      console.error(err);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 text-white">
      <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/20 w-96">
        <h1 className="text-4xl font-bold mb-6 text-center">🔐 Admin Login</h1>
        <div className="space-y-4">
          <input 
            type="email" 
            placeholder="Admin Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg text-black focus:ring-2 focus:ring-purple-400 outline-none"
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 rounded-lg text-black focus:ring-2 focus:ring-purple-400 outline-none"
          />
          <button 
            onClick={handleLogin}
            className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded-lg font-semibold transition transform hover:scale-105"
          >
            🔓 Login as Admin
          </button>
        </div>
        <p className="text-center text-sm mt-6 text-white/70">
          Admin access only. Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
