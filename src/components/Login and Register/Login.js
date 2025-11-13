import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { auth } from "../../firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import LoginBackground from "./images/login-background-image.jpg";
import Logo from "./images/homezy-logo.png";
import GoogleIcon from "./images/google-icon.png";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getEmailEndpoint } from "../../utils/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();
  const db = getFirestore();

  const provider = new GoogleAuthProvider();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      let user = userCredential.user;

      console.log("🔐 Initial login - emailVerified:", user.emailVerified);

      // Small initial delay to allow Firebase backend to sync
      await new Promise(r => setTimeout(r, 500));

      // CRITICAL FIX: Force multiple token refreshes and reloads
      // This ensures Firebase syncs the verification status from the server
      for (let i = 0; i < 5; i++) {
        await user.getIdToken(true); // Force refresh token
        await user.reload(); // Reload user data
        user = auth.currentUser;
        console.log(`🔄 Reload attempt ${i + 1}/5 - emailVerified:`, user.emailVerified);

        if (user.emailVerified) {
          console.log("✅ Email verified detected early!");
          break;
        }

        // Wait a bit between attempts
        await new Promise(r => setTimeout(r, 800));
      }

      // Extended polling for verification (helps when user just clicked the link)
      if (!user.emailVerified) {
        console.log("⏳ Starting extended verification polling...");
        const maxAttempts = 10; // ~10 * 1.5s ≈ 15s total wait time
        let attempt = 0;

        while (!user.emailVerified && attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 1500));
          await user.getIdToken(true); // Force refresh each time
          await user.reload();
          user = auth.currentUser;
          attempt++;
          console.log(`⏳ Verification check attempt ${attempt}/${maxAttempts}:`, user.emailVerified);

          if (user.emailVerified) {
            console.log("✅ Email verified during polling!");
            break;
          }
        }
      }

      console.log("✅ Final emailVerified status:", user.emailVerified);

      // 🧠 Check if this user is admin first
      // const adminQuery = query(collection(db, "admin"), where("email", "==", user.email));
      // const adminSnapshot = await getDocs(adminQuery);

      // if (!adminSnapshot.empty) {
      //   // Admin found → skip email verification
      //   alert("Welcome, Admin! 🧡");
      //   navigate("/admin-dashboard");
      //   return; // Stop here, skip host/guest logic
      // }

      // Then check email verification for normal users
      if (!user.emailVerified) {
        console.log("❌ Email not verified - blocking login");
        setError("⚠️ Please verify your email before logging in.");
        setInfo("Check your inbox for the verification email. If you just clicked the link, please wait a moment and try again.");
        await auth.signOut();
        return;
      }

      console.log("🎉 Email verified! Proceeding with login...");

      // Email is verified - now check if user is a host or guest
      let isHost = false;
      try {
        const hostRef = doc(db, 'hosts', user.uid);
        const hostSnap = await getDoc(hostRef);
        isHost = hostSnap.exists();

        console.log("🏠 Is host:", isHost);

        // Update Firestore verified flag if not already set
        if (isHost && !hostSnap.data().verified) {
          await updateDoc(hostRef, { verified: true });
          console.log('Updated host verified flag in Firestore');
        }
      } catch (err) {
        console.warn('Host check failed:', err.message);
      }

      // If not a host, update guest document
      if (!isHost) {
        try {
          const guestRef = doc(db, 'guests', user.uid);
          const guestSnap = await getDoc(guestRef);
          if (guestSnap.exists() && !guestSnap.data().verified) {
            await updateDoc(guestRef, { verified: true });
            console.log('Updated guest verified flag in Firestore');
          }
        } catch (err) {
          console.warn('Guest update failed:', err.message);
        }
      }

      // Login successful - redirect based on user type
      if (isHost) {
        alert("Login Successful! Welcome, Host! 🧡");
        navigate("/dashboard");
      } else {
        alert("Login Successful! Welcome, User! 🧡");
        navigate("/");
      }
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError("❌ Invalid email or password. Please try again.");
      } else if (err.code === 'auth/user-not-found') {
        setError("❌ No account found with this email. Please register first.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("❌ Too many failed login attempts. Please try again later.");
      } else {
        setError(err.message);
      }
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

  const handleResend = async () => {
    if (!auth.currentUser) {
      setError('Please log in first.');
      return;
    }
    if (auth.currentUser.emailVerified) {
      setInfo('✅ Your email is already verified. You can log in now.');
      return;
    }
    setSending(true);
    setError('');
    try {
      // Use local server directly
      const response = await fetch(getEmailEndpoint('verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: auth.currentUser.email,
          fullName: auth.currentUser.displayName || '',
          force: true // allow resend explicitly from login screen
        }),
      });

      const result = await response.json();

      if (result.success) {
        setInfo('📩 Verification email resent. Check your inbox/spam.');
      } else {
        throw new Error(result.error || 'Failed to send');
      }
    } catch (err) {
      setError('❌ Failed to resend verification email. Make sure server.js is running.');
      console.error(err);
    } finally {
      setSending(false);
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
          {info && <p className="text-orange-600 text-xs mt-2 text-center">{info}</p>}
          {error.includes('verify your email') && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="px-5 py-2 rounded-full border border-orange-500 text-orange-600 hover:bg-orange-50 disabled:opacity-50 text-sm font-semibold transition"
              >
                {sending ? 'Sending…' : 'Resend Verification Email'}
              </button>
            </div>
          )}
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
