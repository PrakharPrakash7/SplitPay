import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../utils/api";
import { saveAuth } from "../utils/authHelper";

const CardholderLogin = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSignup = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if(res.ok){
        toast.success(`Cardholder signed up: ${data.user.name}`);
        saveAuth('cardholder', data.token);
        console.log("✅ Logged in as cardholder");
        navigate("/cardholder-dashboard");
      } else {
        toast.error(data.message);
      }
    } catch(err){
      toast.error(err.message);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if(res.ok){
        toast.success(`Cardholder logged in: ${data.user.name}`);
        saveAuth('cardholder', data.token);
        console.log("✅ Logged in as cardholder");
        navigate("/cardholder-dashboard");
        
      } else {
        toast.error(data.message);
      }
    } catch(err){
      toast.error(err.message);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-800 text-white space-y-4">
      <h1 className="text-4xl font-bold mb-4">Cardholder Login / Signup</h1>
      <input type="text" placeholder="Name (for signup)" value={name} onChange={(e)=>setName(e.target.value)} className="px-4 py-2 rounded text-black"/>
      <input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} className="px-4 py-2 rounded text-black"/>
      <input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} className="px-4 py-2 rounded text-black"/>
      <div className="flex space-x-4">
        <button onClick={handleSignup} className="bg-green-500 px-4 py-2 rounded hover:bg-green-600">Sign Up</button>
        <button onClick={handleLogin} className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600">Login</button>
      </div>
     
    </div>
  );
};

export default CardholderLogin;
