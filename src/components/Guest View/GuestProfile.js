import React, { useState, useEffect, useRef } from "react";
import logo from "./homezy-logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import defaultProfile from "./images/default-profile.png";
import { User, Calendar, Heart, LogOut, MessageCircle, Bell, History, Star } from "lucide-react";

const GuestProfile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const dropdownMenuRef = useRef(null);
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(null);
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownButtonRef = useRef(null);

  const DropdownPortal = ({ children }) => {
    return createPortal(
      children,
      document.body // render directly in body
    );
  };

  // 👇 add this after your other useEffects
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownOpen &&
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(e.target) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);


  // Track user login + fetch guest profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, "guests", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setGuest(docSnap.data());
      } else {
        setGuest(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Cloudinary upload
  const uploadImageToCloudinary = async () => {
    if (!profilePicFile) return guest?.photoURL || "";
    const formData = new FormData();
    formData.append("file", profilePicFile);
    formData.append("upload_preset", "homezy_unsigned"); // replace with your preset

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dnpimmfrn/image/upload", // replace with your Cloudinary cloud name
      { method: "POST", body: formData }
    );
    const data = await res.json();
    return data.secure_url;
  };

  // Save profile changes
  const handleSaveChanges = async () => {
    if (!guest || !user) return;
    setSaving(true);
    try {
      let photoURL = guest.photoURL || "";

      if (profilePicFile) {
        const uploadedURL = await uploadImageToCloudinary();
        if (uploadedURL) photoURL = uploadedURL;
      }

      const docRef = doc(db, "guests", user.uid);
      await updateDoc(docRef, {
        firstName: guest.firstName,
        lastName: guest.lastName,
        fullName: guest.fullName,
        email: guest.email,
        phone: guest.phone || "",
        photoURL,
        timestamp: serverTimestamp(),
      });

      await updateProfile(user, {
        photoURL,
        displayName: guest.fullName,
      });

      alert("Profile updated successfully ✅");
    } catch (error) {
      console.error(error);
      alert("Failed to update profile ❌");
    }
    setSaving(false);
  };

  return (
    <div className="font-sans bg-[#fefefe] min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 left-0 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm z-50">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between px-4 sm:px-12 py-4">
          {/* 🏠 Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
          >
            <img src={logo} alt="Homezy Logo" className="w-10 h-10 object-contain" />
            <h1 className="text-[#0B2545] text-2xl font-bold tracking-tight">
              Homezy
            </h1>
          </Link>

          {/* 🍔 Hamburger (mobile only) */}
          <button
            className="sm:hidden flex items-center justify-center p-2 rounded-md text-gray-700 hover:bg-gray-100 transition"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={
                  mobileMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
              />
            </svg>
          </button>

          {/* 🧭 Desktop Navigation */}
          <div className="hidden sm:flex sm:items-center sm:gap-8 text-[#0B2545] font-medium text-sm">
            {/* Navigation Links */}
            <div className="flex items-center gap-6">
              <Link
                to="/homes"
                className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-gradient-to-r after:from-orange-500 after:to-orange-400 after:transition-all duration-300 ${location.pathname === "/homes"
                  ? "after:w-full"
                  : "after:w-0 hover:after:w-full"
                  }`}
              >
                Homes
              </Link>

              <Link
                to="/experiences"
                className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-gradient-to-r after:from-orange-500 after:to-orange-400 after:transition-all duration-300 ${location.pathname === "/experiences"
                  ? "after:w-full"
                  : "after:w-0 hover:after:w-full"
                  }`}
              >
                Experiences
              </Link>

              <Link
                to="/services"
                className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-gradient-to-r after:from-orange-500 after:to-orange-400 after:transition-all duration-300 ${location.pathname === "/services"
                  ? "after:w-full"
                  : "after:w-0 hover:after:w-full"
                  }`}
              >
                Services
              </Link>
            </div>

            {/* ✨ Become a Host */}
            <button
              onClick={() => navigate("/host-verification")}
              className="bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Become a Host
            </button>

            {/* 🔔 Notifications Bell */}
            {user && (
              <button
                onClick={() => navigate("/guest-notifications")}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-700" />
              </button>
            )}

            {/* 👤 User Dropdown */}
            <div className="relative">
              <button
                ref={dropdownButtonRef}
                onClick={() => {
                  if (!user) navigate("/login");
                  else setDropdownOpen(!dropdownOpen);
                }}
                className="flex items-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium hover:bg-gray-300 transition"
              >
                {!user ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 
                             1.79-4 4 1.79 4 4 4zm0 2c-3.31 
                             0-6 2.69-6 6h12c0-3.31-2.69-6-6-6z" />
                    </svg>
                    <span>Log In / Sign Up</span>
                  </>
                ) : (
                  <>
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="profile"
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{user.displayName || "User"}</span>
                  </>
                )}
              </button>

              {user && dropdownOpen && (
                <DropdownPortal>
                  <div
                    ref={dropdownMenuRef}
                    className="absolute w-56 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 z-[99999]"
                    style={{
                      top: dropdownButtonRef.current
                        ? dropdownButtonRef.current.getBoundingClientRect().bottom + window.scrollY
                        : undefined,
                      left: dropdownButtonRef.current
                        ? dropdownButtonRef.current.getBoundingClientRect().left + window.scrollX
                        : undefined,
                    }}
                  >
                    <div className="p-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt="profile"
                            className="w-10 h-10 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg border border-gray-200 flex-shrink-0">
                            {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-gray-800 font-semibold text-sm">
                            {user.displayName || "Guest User"}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="py-2 text-sm text-gray-700">
                      <Link
                        to="/guest-profile"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-4 h-4 text-orange-500" />
                        Profile Settings
                      </Link>
                      <Link
                        to="/transaction-history"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <History className="w-4 h-4 text-orange-500" />
                        Transaction History
                      </Link>
                      <Link
                        to="/bookings"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <Calendar className="w-4 h-4 text-orange-500" />
                        Bookings
                      </Link>
                      <Link
                        to="/guest-messages"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4 text-orange-500" />
                        Messages
                      </Link>
                      <Link
                        to="/favorites"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <Star className="w-4 h-4 text-orange-500" />
                        Favorites
                      </Link>
                      <Link
                        to="/guest-wishlist"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <Heart className="w-4 h-4 text-orange-500" />
                        Wishlist
                      </Link>
                    </div>

                    <div className="border-t border-gray-100 py-2">
                      <button
                        onClick={async () => {
                          await signOut(auth);
                          setDropdownOpen(false);
                          navigate("/login");
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 w-full text-left transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-red-600" />
                        Logout
                      </button>
                    </div>
                  </div>
                </DropdownPortal>
              )}
            </div>
          </div>
        </div>

        {/* 📱 Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-white border-t border-gray-100 shadow-md">
            <div className="flex flex-col items-center gap-4 py-6 text-[#0B2545] font-medium text-sm">
              <Link
                to="/homes"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-orange-500 transition"
              >
                Homes
              </Link>
              <Link
                to="/experiences"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-orange-500 transition"
              >
                Experiences
              </Link>
              <Link
                to="/services"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-orange-500 transition"
              >
                Services
              </Link>

              <button
                onClick={() => {
                  navigate("/host-verification");
                  setMobileMenuOpen(false);
                }}
                className="bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Become a Host
              </button>

              {user ? (
                <>
                  <Link
                    to="/guest-notifications"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <Bell className="w-4 h-4 text-orange-500" /> Notifications
                  </Link>
                  <Link
                    to="/guest-profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <User className="w-4 h-4 text-orange-500" /> Profile Settings
                  </Link>
                  <Link
                    to="/transaction-history"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <History className="w-4 h-4 text-orange-500" /> Transaction History
                  </Link>
                  <Link
                    to="/bookings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <Calendar className="w-4 h-4 text-orange-500" /> Bookings
                  </Link>
                  <Link
                    to="/guest-messages"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <MessageCircle className="w-4 h-4 text-orange-500" /> Messages
                  </Link>
                  <Link
                    to="/favorites"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <Star className="w-4 h-4 text-orange-500" /> Favorites
                  </Link>
                  <Link
                    to="/guest-wishlist"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <Heart className="w-4 h-4 text-orange-500" /> Wishlist
                  </Link>
                  <button
                    onClick={async () => {
                      await signOut(auth);
                      setMobileMenuOpen(false);
                      navigate("/login");
                    }}
                    className="flex items-center gap-2 text-red-500 hover:text-red-600"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/login");
                  }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-medium transition"
                >
                  Log In / Sign Up
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* PROFILE SETTINGS CONTAINER */}
      <main className="py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 rounded-3xl shadow-xl border border-gray-200">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center sm:text-left">
            Profile Settings
          </h2>
          <p className="text-gray-500 mb-8 text-center sm:text-left text-sm sm:text-base">
            Update your personal information and account preferences.
          </p>

          {guest && (
            <div className="flex flex-col gap-8">
              {/* Profile Picture */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start sm:gap-6 gap-4 text-center sm:text-left">
                <div className="relative">
                  {profilePicFile ? (
                    <img
                      src={URL.createObjectURL(profilePicFile)}
                      alt="profile"
                      className="w-28 h-28 rounded-full object-cover border-2 border-gray-300 mx-auto sm:mx-0"
                    />
                  ) : guest.photoURL ? (
                    <img
                      src={guest.photoURL}
                      alt="profile"
                      className="w-28 h-28 rounded-full object-cover border-2 border-gray-300 mx-auto sm:mx-0"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-4xl border-2 border-gray-300 mx-auto sm:mx-0 flex-shrink-0">
                      {(guest.fullName || guest.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label
                    htmlFor="profilePic"
                    className="absolute bottom-0 right-0 bg-[#FF5A1F] text-white rounded-full p-2 cursor-pointer hover:opacity-90 shadow-md"
                  >
                    ✏️
                  </label>
                  <input
                    id="profilePic"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProfilePicFile(e.target.files[0])}
                    className="hidden"
                  />
                </div>
                {/* Center Name & Email vertically */}
                <div className="flex flex-col justify-center mt-0 md:mt-4">
                  <p className="text-lg font-semibold">{guest.fullName}</p>
                  <p className="text-gray-400 break-all">{guest.email}</p>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col relative">
                  <input
                    type="text"
                    value={guest.firstName}
                    onChange={(e) =>
                      setGuest({
                        ...guest,
                        firstName: e.target.value,
                        fullName: `${e.target.value} ${guest.lastName}`,
                      })
                    }
                    className="border border-gray-300 px-4 pt-5 pb-2 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none peer"
                  />
                  <label className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-focus:top-1 peer-focus:text-xs peer-focus:text-[#FF5A1F]">
                    First Name
                  </label>
                </div>

                <div className="flex flex-col relative">
                  <input
                    type="text"
                    value={guest.lastName}
                    onChange={(e) =>
                      setGuest({
                        ...guest,
                        lastName: e.target.value,
                        fullName: `${guest.firstName} ${e.target.value}`,
                      })
                    }
                    className="border border-gray-300 px-4 pt-5 pb-2 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none peer"
                  />
                  <label className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-focus:top-1 peer-focus:text-xs peer-focus:text-[#FF5A1F]">
                    Last Name
                  </label>
                </div>
              </div>

              <div className="flex flex-col relative">
                <input
                  type="email"
                  value={guest.email}
                  onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                  className="border border-gray-300 px-4 pt-5 pb-2 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none peer"
                />
                <label className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-focus:top-1 peer-focus:text-xs peer-focus:text-[#FF5A1F]">
                  Email
                </label>
              </div>

              <div className="flex flex-col relative">
                <input
                  type="text"
                  value={guest.phone || ""}
                  onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                  className="border border-gray-300 px-4 pt-5 pb-2 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none peer"
                />
                <label className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-focus:top-1 peer-focus:text-xs peer-focus:text-[#FF5A1F]">
                  Phone Number
                </label>
              </div>

              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="bg-[#FF5A1F] text-white font-semibold py-3 rounded-lg hover:opacity-90 transition"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </main>


      {/* 🦶 FOOTER */}
      <footer className="bg-gray-900 text-gray-300 py-14 px-8 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* 🏠 Brand Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src={logo} alt="Homezy" className="w-8 h-8" />
              <h1 className="text-white text-lg font-bold">Homezy</h1>
            </div>
            <p className="text-sm mb-4 leading-relaxed">
              Helping travelers feel at home, anywhere.
            </p>

            {/* 🌐 Social Media Icons */}
            <div className="flex gap-3">
              {/* Facebook */}
              <a
                href="https://www.facebook.com/paoloperalta246"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-full flex items-center justify-center transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-white"
                >
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 
                  6.48 2 12c0 4.99 3.66 9.12 8.44 
                  9.88v-6.99H8.9v-2.89h1.54V9.8c0-1.52.9-2.36 
                  2.28-2.36.66 0 1.35.12 1.35.12v1.48h-.76c-.75 
                  0-.98.47-.98.95v1.14h1.67l-.27 2.89h-1.4v6.99C18.34 
                  21.12 22 16.99 22 12z" />
                </svg>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com/onlysuhi_/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-full flex items-center justify-center transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-white"
                >
                  <path d="M7.5 2C4.47 2 2 4.47 2 
                  7.5v9C2 19.53 4.47 22 7.5 22h9c3.03 
                  0 5.5-2.47 5.5-5.5v-9C22 4.47 19.53 
                  2 16.5 2h-9zM12 8.5A3.5 3.5 0 1 1 8.5 
                  12 3.5 3.5 0 0 1 12 8.5zm5.25-.75a.75.75 
                  0 1 1-.75-.75.75.75 0 0 1 .75.75zM12 
                  10a2 2 0 1 0 2 2 2 2 0 0 0-2-2z" />
                </svg>
              </a>

              {/* Twitter/X */}
              <a
                href="https://twitter.com/onlysuhi_"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-full flex items-center justify-center transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-white"
                >
                  <path d="M22.46 6c-.77.35-1.6.58-2.46.69a4.27 
                  4.27 0 0 0 1.88-2.37 8.58 8.58 0 0 1-2.72 
                  1.04 4.26 4.26 0 0 0-7.26 3.88A12.1 
                  12.1 0 0 1 3.15 4.6a4.25 4.25 0 0 0 
                  1.32 5.68 4.27 4.27 0 0 1-1.93-.54v.05a4.26 
                  4.26 0 0 0 3.42 4.18 4.27 4.27 0 0 1-1.92.07 
                  4.26 4.26 0 0 0 3.97 2.95A8.54 8.54 0 0 1 2 
                  19.54a12.07 12.07 0 0 0 6.56 1.92c7.88 
                  0 12.2-6.53 12.2-12.2 0-.19 0-.37-.01-.56A8.74 
                  8.74 0 0 0 22.46 6z" />
                </svg>
              </a>
            </div>
          </div>

          {/* 📦 Company */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>About Us</li>
              <li>Careers</li>
              <li>Blog</li>
              <li>Pricing</li>
            </ul>
          </div>

          {/* 🗺️ Destinations */}
          <div>
            <h3 className="text-white font-semibold mb-4">Destinations</h3>
            <ul className="space-y-2 text-sm">
              <li>Maldives</li>
              <li>Los Angeles</li>
              <li>Las Vegas</li>
              <li>Toronto</li>
            </ul>
          </div>

          {/* 📰 Newsletter */}
          <div>
            <h3 className="text-white font-semibold mb-4">Join Our Newsletter</h3>
            <div className="flex">
              <input
                type="email"
                placeholder="Your email address"
                className="px-3 py-2 w-full rounded-l-md text-gray-700 focus:outline-none"
              />
              <button className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-r-md text-white font-semibold">
                Subscribe
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              * We’ll send you weekly updates for your better tour packages.
            </p>
          </div>
        </div>

        {/* © Bottom Text */}
        <div className="border-t border-gray-700 mt-10 pt-5 text-center text-sm text-gray-500">
          © 2025 Homezy | All Rights Reserved
        </div>
      </footer>
    </div>
  );
};

export default GuestProfile;
