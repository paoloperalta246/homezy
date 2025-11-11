import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { getAuth, applyActionCode, checkActionCode } from "firebase/auth";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import defaultProfile from "./images/default-profile.png";
import logo from "./images/homezy-logo.png";

export default function Verified() {
  const [status, setStatus] = useState("Verifying your email...");
  const [verified, setVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const db = getFirestore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const verifyEmail = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const oobCode = urlParams.get("oobCode");

      if (!oobCode) {
        setStatus("⚠️ Invalid or missing verification code.");
        return;
      }

      try {
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode);
        await auth.currentUser?.reload();

        if (auth.currentUser?.emailVerified) {
          await updateDoc(doc(db, "hosts", auth.currentUser.uid), {
            verified: true,
          });

          setStatus("✅ Email Verified! You can now log in.");
          setVerified(true);
          setTimeout(() => navigate("/login"), 4000);
        } else {
          setStatus("✅ Email Verified! You can now log in.");
        }
      } catch (error) {
        console.warn("Verification error:", error);
        if (error.code === "auth/invalid-action-code") {
          setStatus("✅ Email Verified! You can now log in.");
          setVerified(true);
          setTimeout(() => navigate("/login"), 4000);
        } else {
          setStatus("❌ Invalid or expired verification link.");
        }
      }
    };

    verifyEmail();
  }, [navigate, auth, db]);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fefefe]">

      {/* 🧭 NAVBAR */}
      <header className="sticky top-0 left-0 w-full bg-white shadow-sm z-20">
        <div className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Homezy Logo" className="w-10 h-10 object-contain" />
            <h1 className="text-[#0B2545] text-xl sm:text-2xl font-bold">Homezy</h1>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-4 md:gap-6 text-[#0B2545] font-medium text-sm">
            <Link
              to="/homes"
              className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-300 ${location.pathname === "/homes"
                ? "after:w-full"
                : "after:w-0 hover:after:w-full"
                }`}
            >
              Homes
            </Link>
            <Link
              to="/experiences"
              className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-300 ${location.pathname === "/experiences"
                ? "after:w-full"
                : "after:w-0 hover:after:w-full"
                }`}
            >
              Experiences
            </Link>
            <Link
              to="/services"
              className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-300 ${location.pathname === "/services"
                ? "after:w-full"
                : "after:w-0 hover:after:w-full"
                }`}
            >
              Services
            </Link>

            <button
              onClick={() => navigate("/host-verification")}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-md transition max-w-[180px]"
            >
              Become a Host
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!user) navigate("/login");
                  else setDropdownOpen(!dropdownOpen);
                }}
                className="flex items-center gap-2 bg-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 transition"
              >
                {!user ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 
                  1.79-4 4 1.79 4 4 4zm0 2c-3.31 
                  0-6 2.69-6 6h12c0-3.31-2.69-6-6-6z" />
                    </svg>
                    Log In / Sign Up
                  </>
                ) : (
                  <>
                    <img src={user.photoURL || defaultProfile} alt="profile" className="w-6 h-6 rounded-full object-cover" />
                    {user.displayName || "User"}
                  </>
                )}
              </button>

              {user && dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white shadow-lg rounded-lg overflow-hidden z-40">
                  <button onClick={() => { setDropdownOpen(false); navigate("/edit-profile"); }} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition">Edit Profile</button>
                  <button onClick={() => { setDropdownOpen(false); navigate("/bookings"); }} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition">Bookings</button>
                  <button onClick={() => { setDropdownOpen(false); navigate("/favorites"); }} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition">Favorites</button>
                  <button onClick={async () => { await auth.signOut(); setDropdownOpen(false); navigate("/login"); }} className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-100 transition">Logout</button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Hamburger */}
          <div className="sm:hidden">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-2 rounded-md bg-gray-200 hover:bg-gray-300 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dropdownOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>

            {/* Mobile Menu */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 w-full bg-white shadow-md flex flex-col gap-2 px-4 py-4 z-30">
                <Link to="/homes" className="py-2 border-b border-gray-200">Homes</Link>
                <Link to="/experiences" className="py-2 border-b border-gray-200">Experiences</Link>
                <Link to="/services" className="py-2 border-b border-gray-200">Services</Link>
                <button onClick={() => navigate("/host-verification")} className="bg-orange-500 text-white py-2 rounded-md mt-2">Become a Host</button>
                <button onClick={() => !user ? navigate("/login") : setDropdownOpen(!dropdownOpen)} className="bg-gray-200 py-2 rounded-md mt-2">
                  {!user ? "Log In / Sign Up" : user.displayName || "User"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 🔑 Main content */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 md:px-12 py-12 bg-gradient-to-br from-orange-100 via-white to-orange-50 w-full">

        {/* Verification Box */}
        <div className="relative bg-white/95 backdrop-blur-sm p-6 sm:p-10 rounded-2xl shadow-xl max-w-xs sm:max-w-md w-full text-center border border-orange-100 transition-all duration-300 hover:shadow-orange-200/70">
          <div className="mb-4 sm:mb-6">
            <div className="mx-auto bg-gradient-to-r from-orange-500 to-orange-400 w-16 h-16 flex items-center justify-center rounded-xl shadow-md">
              <span className="text-white text-3xl font-extrabold">H</span>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-2">
            Welcome to <span className="text-orange-500">Homezy</span> 🏠
          </h1>
          <p className="text-gray-600 mb-6 leading-relaxed text-[13px] sm:text-[15px]">{status}</p>

          {verified ? (
            <Link
              to="/login"
              className="inline-block bg-gradient-to-r from-orange-500 to-orange-400 text-white px-6 py-2 sm:px-8 sm:py-3 rounded-full font-semibold shadow-md hover:shadow-lg hover:from-orange-600 hover:to-orange-500 transition-all duration-300 text-sm sm:text-base"
            >
              Go to Login →
            </Link>
          ) : (
            <div className="flex flex-col justify-center items-center space-y-2">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs sm:text-sm text-gray-500">Please wait while we verify your email...</p>
            </div>
          )}
        </div>

        {/* 🦶 Footer */}
        <footer className="mt-10 text-center text-gray-400 text-xs sm:text-sm">
          <p>
            © {new Date().getFullYear()} <span className="text-orange-500 font-semibold">Homezy</span>. All rights reserved.
          </p>
          <p className="mt-1">Made with ❤️ for a cozier online experience.</p>
        </footer>

      </div>
    </div>
  );
}
