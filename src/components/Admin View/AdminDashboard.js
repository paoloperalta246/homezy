import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "../Host View/images/homezy-logo.png";
import { LayoutDashboard, Users, DollarSign, FileText, Shield, Settings, LogOut, User } from "lucide-react";

const AdminDashboard = () => {
  const [admin, setAdmin] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // Fetch admin data on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Try to fetch from admin collection using UID as document ID
        const adminDocRef = doc(db, "admin", user.uid);
        const adminSnap = await getDoc(adminDocRef);
        
        if (adminSnap.exists()) {
          setAdmin(adminSnap.data());
        } else {
          console.log("No admin data found for this user");
        }
      }
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

  const handleLogout = async () => {
    await signOut(auth);
    setDropdownOpen(false);
    navigate("/login");
  };

  const getNavItem = (path, label, Icon, disabled = false) => {
    const isActive = currentPath === path;
    return (
      <button
        onClick={() => !disabled && navigate(path)}
        disabled={disabled}
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${
          disabled
            ? "text-gray-300 cursor-not-allowed"
            : isActive
            ? "bg-[#FF5A1F] text-white"
            : "text-[#23364A] hover:bg-gray-100"
        }`}
      >
        {Icon && <Icon className="w-5 h-5 text-current" />}
        <span className={`${isActive ? "text-white" : disabled ? "text-gray-300" : "text-[#23364A]"}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans">
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
        className={`fixed top-0 left-0 h-screen bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between w-[260px] z-40 transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-[260px]"
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
            {getNavItem("/admin-dashboard", "Dashboard", LayoutDashboard)}
            <div className="border-t border-gray-300 my-4 mx-6"></div>
            {getNavItem("/admin-bookings", "Bookings", Users, true)}
            {getNavItem("/admin-payments", "Payments", DollarSign, true)}
            {getNavItem("/admin-compliance", "Compliance", Shield, true)}
            {getNavItem("/admin-reports", "Reports", FileText, true)}
            {getNavItem("/admin-settings", "Settings", Settings, true)}
          </nav>
        </div>

        {/* Logout */}
        <div className="flex flex-col items-center gap-4 mb-6 px-4">
          <button
            onClick={handleLogout}
            className="bg-[#B50000] text-white font-medium py-2 w-full rounded-md hover:opacity-90 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
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

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-8 md:px-16 py-6 sm:py-8 md:py-10 pt-16 sm:pt-6 md:pt-10 md:ml-[260px]">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl md:text-[32px] font-bold mb-2 flex items-center gap-2">
            <span className="p-1.5 sm:p-2 rounded-xl bg-orange-500/10 text-orange-600">
              <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
            </span>
            Admin Dashboard
          </h2>
          <p className="text-[#5E6282] text-sm sm:text-base md:text-lg mb-6 sm:mb-8">
            Welcome back! Manage your platform from here.
          </p>
        </div>

        {/* Placeholder content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Total Bookings</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">--</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Service Fees</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">₱ --</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Compliance Reports</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">--</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-orange-100 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600">Generated Reports</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">--</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center">
          <p className="text-gray-400">Admin features coming soon...</p>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
