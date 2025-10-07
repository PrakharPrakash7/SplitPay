import { auth } from "./firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

function App() {
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("Signed in user:", user.displayName, user.email);
      alert(`Signed in as ${user.displayName}`);
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-4">Firebase Google Sign-In ✅</h1>
      <button
        onClick={handleGoogleSignIn}
        className="bg-red-500 px-6 py-3 rounded hover:bg-red-600"
      >
        Sign in with Google
      </button>
    </div>
  );
}

export default App;
