import { useState } from "react";
import { auth } from "../firebase";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

const BuyerLogin = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginBackend = async (name, email, uid) => {
    const res = await fetch("http://localhost:5000/api/buyer/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, firebaseUid: uid })
    });
    const data = await res.json();
    localStorage.setItem("token", data.token);
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      toast.success(`Signed in as ${user.displayName}`);
      await loginBackend(user.displayName, user.email, user.uid);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEmailSignup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      toast.success(`Signed up as ${email}`);
      await loginBackend(name || email, email, user.uid);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEmailLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      toast.success(`Logged in as ${email}`);
      await loginBackend(name || email, email, user.uid);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white space-y-4">
      <h1 className="text-4xl font-bold mb-4">Buyer Login / Signup</h1>
      <button onClick={handleGoogleSignIn} className="bg-red-500 px-6 py-3 rounded hover:bg-red-600">
        Sign in with Google
      </button>
      <input type="text" placeholder="Name (for signup)" value={name} onChange={(e)=>setName(e.target.value)} className="px-4 py-2 rounded text-black"/>
      <input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} className="px-4 py-2 rounded text-black"/>
      <input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} className="px-4 py-2 rounded text-black"/>
      <div className="flex space-x-4">
        <button onClick={handleEmailSignup} className="bg-green-500 px-4 py-2 rounded hover:bg-green-600">Sign Up</button>
        <button onClick={handleEmailLogin} className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600">Login</button>
      </div>
       </div>
  );
};

export default BuyerLogin;
