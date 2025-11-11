import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { auth } from "../../firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import LoginBackground from "./images/login-background-image.jpg";
import Logo from "./images/homezy-logo.png";
import GoogleIcon from "./images/google-icon.png"; 
import { getFirestore, doc, getDoc } from "firebase/firestore";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const db = getFirestore();

  const provider = new GoogleAuthProvider();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      let user = userCredential.user;

      await user.getIdToken(true);
      await user.reload();
      user = auth.currentUser;

      if (!user.emailVerified) {
        setError("⚠️ Please verify your email before logging in.");
        return;
      }

      const hostRef = doc(db, "hosts", user.uid);
      const hostSnap = await getDoc(hostRef);

      if (hostSnap.exists()) {
        alert("Login Successful! Welcome, Host! 🧡");
        navigate("/dashboard");
      } else {
        alert("Login Successful! Welcome, User! 🧡");
        navigate("/");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      alert(`✅ Welcome, ${user.displayName || "User"}!`);
      navigate("/");
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Left side image */}
      <div
        className="w-full md:w-1/2 h-64 md:h-auto bg-cover bg-center"
        style={{
          backgroundImage: `url(${LoginBackground})`,
        }}
      ></div>

      {/* Right side form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center bg-white px-8 md:px-16 py-12">
        {/* Logo */}
        <div className="mb-6">
          <img src={Logo} alt="Homezy Logo" className="w-20 h-20" />
        </div>

        {/* Header */}
        <h2 className="text-2xl font-extrabold text-gray-800 mb-2 text-center">
          Log In To Your Account
        </h2>
        <p className="text-gray-500 mb-8 text-center">
          Access your bookings, profile, and more.
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} className="w-full max-w-sm">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-4 px-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-orange-500 outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-6 px-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-orange-500 outline-none"
            required
          />

          <button
            type="submit"
            className="w-full bg-orange-500 text-white font-semibold py-3 rounded-full hover:bg-orange-600 transition"
          >
            Login
          </button>

          {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
        </form>

        {/* Divider */}
        <div className="flex items-center w-full max-w-sm my-6">
          <hr className="flex-grow border-gray-300" />
          <span className="px-2 text-gray-500 text-sm">or</span>
          <hr className="flex-grow border-gray-300" />
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-3 w-full max-w-sm border border-gray-300 rounded-full py-3 hover:bg-gray-100 transition"
        >
          <img src={GoogleIcon} alt="Google" className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Continue with Google</span>
        </button>

        <p className="text-sm text-gray-600 mt-6 text-center">
          Don’t have an account?{" "}
          <Link to="/register" className="text-orange-500 font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
