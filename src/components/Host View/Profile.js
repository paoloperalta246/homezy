import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut, updateEmail } from "firebase/auth";
import {
  collection,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png";
import { Home, Clipboard, MessageSquare, Calendar, User, Gift, Ticket } from "lucide-react";

const Profile = () => {
  const [host, setHost] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch logged-in host data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "hosts", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setHost(docSnap.data());
        else console.log("No host data found");
      } else setHost(null);
    });

    return () => unsubscribe();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Upload image to Cloudinary
  const uploadImageToCloudinary = async () => {
    if (!profilePicFile) return host?.photoURL || "";
    const formData = new FormData();
    formData.append("file", profilePicFile);
    formData.append("upload_preset", "homezy_unsigned");

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dnpimmfrn/image/upload",
      { method: "POST", body: formData }
    );
    const data = await res.json();
    return data.secure_url;
  };

  // ✅ Update all listings hostName
  const updateListingsHostName = async (newFirstName) => {
    try {
      const listingsRef = collection(db, "listings");
      const q = query(listingsRef, where("hostId", "==", auth.currentUser.uid));
      const querySnapshot = await getDocs(q);

      const updatePromises = querySnapshot.docs.map((docSnap) => {
        const docRef = doc(db, "listings", docSnap.id);
        return updateDoc(docRef, { hostName: newFirstName });
      });

      await Promise.all(updatePromises);
      console.log("All listings updated with new hostName!");
    } catch (error) {
      console.error("Error updating listings:", error);
    }
  };

  // Save profile changes
  const handleSaveChanges = async () => {
    if (!host) return;
    setSaving(true);

    try {
      let updatedData = { ...host };

      // Upload new profile picture if changed
      if (profilePicFile) {
        const imageUrl = await uploadImageToCloudinary();
        updatedData.photoURL = imageUrl;
      }

      // Update Firestore host doc
      const docRef = doc(db, "hosts", auth.currentUser.uid);
      updatedData.timestamp = serverTimestamp();
      await updateDoc(docRef, updatedData);

      // Update email in Firebase Auth if changed
      if (host.email !== updatedData.email) {
        await updateEmail(auth.currentUser, updatedData.email);
      }

      // ✅ Update all listings hostName
      await updateListingsHostName(updatedData.firstName);

      alert("✅ Profile Updated Successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDropdownOpen(false);
    navigate("/login");
  };

  const getNavItem = (path, label, Icon) => {
    const isActive = currentPath === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${isActive ? "bg-[#FF5A1F] text-white" : "text-[#23364A] hover:bg-gray-100"
          }`}
      >
        {Icon && <Icon className="w-5 h-5 text-current" />}
        <span className={`${isActive ? "text-white" : "text-[#23364A]"}`}>{label}</span>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans">
      {/* Sidebar */}
      <>
        {/* Mobile Hamburger */}
        <div className="md:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 bg-white rounded-md shadow-md"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 h-screen bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between w-[260px] z-40 transition-transform duration-300 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-[260px]"
            }`}
        >
          <div>
            <div className="flex items-center gap-2 px-6 py-6 pl-10 pt-10">
              <img
                src={homezyLogo}
                alt="Homezy Logo"
                className="w-11 h-11 object-contain"
              />
              <h1 className="text-[30px] font-bold text-[#23364A]">Homezy</h1>
            </div>
            <nav className="flex flex-col mt-4">
              {getNavItem("/dashboard", "Dashboard", Home)}
              {getNavItem("/listings", "My Listings", Clipboard)}
              {getNavItem("/host-messages", "Messages", MessageSquare)}
              {getNavItem("/calendar", "Calendar", Calendar)}
              {getNavItem("/points-rewards", "Points & Rewards", Gift)}
            </nav>
          </div>

          {/* Profile + Logout */}
          <div
            className="flex flex-col items-center gap-4 mb-6 relative px-4"
            ref={dropdownRef}
          >
            <button
              onClick={() =>
                !host ? navigate("/login") : setDropdownOpen(!dropdownOpen)
              }
              className="flex items-center justify-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium hover:bg-gray-300 transition w-full"
            >
              <img
                src={host?.photoURL || defaultProfile}
                alt="profile"
                className="w-6 h-6 rounded-full object-cover"
              />
              <span>{host?.firstName || "Host"}</span>
            </button>

            {host && dropdownOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden z-50">
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <img
                      src={host.photoURL || defaultProfile}
                      alt="profile"
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                    <div>
                      <p className="text-gray-800 font-semibold text-sm">
                        {host.firstName || "Host"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {host.email || "host@example.com"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="py-2 text-sm text-gray-700">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/profile");
                    }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <User className="w-4 h-4 text-orange-500" />
                    Profile Settings
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/host-bookings");
                    }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <Calendar className="w-4 h-4 text-orange-500" />
                    Bookings
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/coupons");
                    }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <Ticket className="w-4 h-4 text-orange-500" />
                    Coupons
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="bg-[#B50000] text-white font-medium py-2 w-full rounded-md hover:opacity-90"
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </>

      {/* Main Content */}
<main className="flex-1 px-4 sm:px-8 md:px-16 py-12 md:ml-[260px]">
  <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 rounded-3xl shadow-xl border border-gray-200">
    <h2 className="text-2xl sm:text-3xl font-bold mb-2">Profile Settings</h2>
    <p className="text-gray-500 mb-8 text-sm sm:text-base">
      Update your personal information and account preferences.
    </p>

    {host && (
      <div className="flex flex-col gap-8">
        {/* Profile Picture */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative">
            <img
              src={profilePicFile ? URL.createObjectURL(profilePicFile) : host.photoURL || defaultProfile}
              alt="profile"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-gray-300"
            />
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
          <div className="text-center sm:text-left">
            <p className="text-lg font-semibold">{host.fullName}</p>
            <p className="text-gray-400 text-sm sm:text-base">{host.email}</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col relative">
            <input
              type="text"
              value={host.firstName}
              onChange={(e) =>
                setHost({
                  ...host,
                  firstName: e.target.value,
                  fullName: `${e.target.value} ${host.lastName}`,
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
              value={host.lastName}
              onChange={(e) =>
                setHost({
                  ...host,
                  lastName: e.target.value,
                  fullName: `${host.firstName} ${e.target.value}`,
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
            value={host.email}
            onChange={(e) => setHost({ ...host, email: e.target.value })}
            className="border border-gray-300 px-4 pt-5 pb-2 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none peer"
          />
          <label className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-focus:top-1 peer-focus:text-xs peer-focus:text-[#FF5A1F]">
            Email
          </label>
        </div>

        <div className="flex flex-col relative">
          <input
            type="text"
            value={host.phone}
            onChange={(e) => setHost({ ...host, phone: e.target.value })}
            className="border border-gray-300 px-4 pt-5 pb-2 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none peer"
          />
          <label className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-focus:top-1 peer-focus:text-xs peer-focus:text-[#FF5A1F]">
            Phone Number
          </label>
        </div>

        {/* Save Button */}
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

    </div>
  );
};

export default Profile;
