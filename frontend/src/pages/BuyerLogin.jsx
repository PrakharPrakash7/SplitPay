import { useState } from "react";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../utils/api";

const BuyerLogin = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate(); // ✅ right place for a hook!

  const loginBackend = async (name, email, uid) => {
    const res = await fetch(`${API_BASE_URL}/api/buyer/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, firebaseUid: uid }),
    });
    const data = await res.json();
    
    if (data.token && data.user) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.user.role || "buyer"); // Use role from backend
      console.log("✅ Logged in as:", data.user.role);
    }
    
    return data;
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      toast.success(`Signed in as ${user.displayName}`);
      await loginBackend(user.displayName, user.email, user.uid);
      navigate("/buyer-dashboard");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEmailSignup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      toast.success(`Signed up as ${email}`);
      await loginBackend(name || email, email, user.uid);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEmailLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      toast.success(`Logged in as ${email}`);
      await loginBackend(name || email, email, user.uid);
      navigate("/buyer-dashboard");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white space-y-4">
      <h1 className="text-4xl font-bold mb-4">Buyer Login / Signup</h1>
      <button
        onClick={handleGoogleSignIn}
        className="bg-red-500 px-6 py-3 rounded hover:bg-red-600"
      >
        Sign in with Google
      </button>
      <input
        type="text"
        placeholder="Name (for signup)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="px-4 py-2 rounded text-black"
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="px-4 py-2 rounded text-black"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="px-4 py-2 rounded text-black"
      />
      <div className="flex space-x-4">
        <button
          onClick={handleEmailSignup}
          className="bg-green-500 px-4 py-2 rounded hover:bg-green-600"
        >
          Sign Up
        </button>
        <button
          onClick={handleEmailLogin}
          className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
        >
          Login
        </button>
      </div>
    </div>
  );
};

export default BuyerLogin;