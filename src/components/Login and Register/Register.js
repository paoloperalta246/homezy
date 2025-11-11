import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { auth, db } from "../../firebase";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import RegisterImage from "./images/register-background-image.jpg";
import Logo from "./images/homezy-logo.png";
import GoogleIcon from "./images/google-icon.png";

function Register() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const provider = new GoogleAuthProvider();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const displayName = `${firstName} ${lastName}`.trim();

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName });

      await setDoc(doc(db, "guests", user.uid), {
        uid: user.uid,
        email,
        firstName,
        fullName: displayName,
        lastName,
        phone,
        timestamp: new Date(),
      });

      // await fetch("http://localhost:4000/send-verification", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email, fullName: displayName }),
      // });

      const emailResponse = await fetch("/.netlify/functions/sendVerification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: displayName }),
      });

      const emailResult = await emailResponse.json();
      
      if (!emailResponse.ok || !emailResult.success) {
        console.error("❌ Failed to send verification email:", emailResult.error);
        setMessage("⚠️ Registration successful, but verification email failed. Please contact support.");
        return;
      }

      setMessage("✅ Registration successful! Check your email for a verification link before logging in.");
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await setDoc(doc(db, "guests", user.uid), {
        firstName: user.displayName?.split(" ")[0] || "Guest",
        lastName: user.displayName?.split(" ")[1] || "",
        fullName: user.displayName || "Guest",
        email: user.email,
        timestamp: new Date(),
      });

      alert(`✅ Welcome, ${user.displayName || "User"}!`);
      navigate("/");
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Image first on mobile */}
      <div
        className="w-full md:w-1/2 h-64 md:h-auto bg-cover bg-center order-1 md:order-2"
        style={{
          backgroundImage: `url(${RegisterImage})`,
        }}
      ></div>

      {/* Left side form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center items-center bg-white px-8 md:px-16 py-12 order-2 md:order-1">
        <div className="mb-6">
          <img src={Logo} alt="Homezy Logo" className="w-20 h-20" />
        </div>

        <h2 className="text-2xl font-extrabold text-gray-800 mb-2 text-center">
          Create Your Homezy Account
        </h2>
        <p className="text-gray-500 mb-8 text-center">
          Sign up and book your next stay in just a few clicks.
        </p>

        <form onSubmit={handleRegister} className="w-full max-w-sm">
          {/* First & Last Name side by side */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full sm:w-1/2 px-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-orange-500 outline-none"
              required
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full sm:w-1/2 px-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-orange-500 outline-none"
              required
            />
          </div>

          <input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full mb-4 px-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-orange-500 outline-none"
            required
          />

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
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-4 px-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-orange-500 outline-none"
            required
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full mb-6 px-4 py-3 border border-gray-200 rounded-full focus:ring-2 focus:ring-orange-500 outline-none"
            required
          />

          <button
            type="submit"
            className="w-full bg-orange-500 text-white font-semibold py-3 rounded-full hover:bg-orange-600 transition"
          >
            Sign up
          </button>

          {message && <p className="text-green-600 text-sm mt-4 text-center">{message}</p>}
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
          onClick={handleGoogleSignup}
          className="flex items-center justify-center gap-3 w-full max-w-sm border border-gray-300 rounded-full py-3 hover:bg-gray-100 transition"
        >
          <img src={GoogleIcon} alt="Google" className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Continue with Google</span>
        </button>

        <p className="text-sm text-gray-600 mt-6 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-orange-500 font-medium hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
