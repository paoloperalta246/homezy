
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png";
import {
  Home, Clipboard, User, Gift, MessageSquare, Calendar,
  DollarSign, TrendingUp, AlertCircle, Banknote, Ticket,
  Bell, LogOut
} from "lucide-react";

// Helper: Format price, no trailing .00 for whole numbers
function formatPrice(val) {
  if (val === undefined || val === null || isNaN(val)) return '-';
  const num = parseFloat(val);
  if (Number.isNaN(num)) return '-';
  return `₱${num.toLocaleString(undefined, {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

const Earnings = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // Earnings calculations - exclude cancelled bookings
  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  
  const totalEarnings = activeBookings.reduce((sum, b) => sum + (b.finalPrice || b.price || 0), 0);
  const thisMonthEarnings = activeBookings
    .filter(b => {
      const bookingDate = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
      const now = new Date();
      return bookingDate.getMonth() === now.getMonth() && bookingDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + (b.finalPrice || b.price || 0), 0);

  const thisYearEarnings = activeBookings
    .filter(b => {
      const bookingDate = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
      const now = new Date();
      return bookingDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + (b.finalPrice || b.price || 0), 0);

  const totalBookings = activeBookings.length;

  // Calculate average earnings per booking
  const avgEarningsPerBooking = totalBookings > 0 ? totalEarnings / totalBookings : 0;

  // Auth and data fetching
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "hosts", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setHost(docSnap.data());
          }
        } catch (err) {
          console.error("Error fetching host:", err);
        }

        // Fetch bookings
        try {
          const listingsSnapshot = await getDocs(
            query(collection(db, "listings"), where("hostId", "==", user.uid))
          );
          const listingIds = listingsSnapshot.docs.map((doc) => doc.id);

          if (listingIds.length > 0) {
            const bookingsSnapshot = await getDocs(collection(db, "bookings"));
            const allBookings = bookingsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            const hostBookings = allBookings.filter((booking) =>
              listingIds.includes(booking.listingId)
            );

            setBookings(hostBookings);
          }
        } catch (err) {
          console.error("Error fetching bookings:", err);
        }
        finally {
          setLoading(false);
        }
      } else {
        setHost(null);
        setLoading(false);
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

  // Match Dashboard style: button-based nav with solid accent when active
  const handleNavigation = (path) => navigate(path);
  const getNavItem = (path, label, Icon) => {
    const isActive = currentPath === path;
    return (
      <button
        onClick={() => handleNavigation(path)}
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${
          isActive ? "bg-[#FF5A1F] text-white" : "text-[#23364A] hover:bg-gray-100"
        }`}
      >
        {Icon && <Icon className="w-5 h-5 text-current" />}
        <span className={isActive ? "text-white" : "text-[#23364A]"}>{label}</span>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans">
      {/* Mobile Hamburger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 bg-white rounded-md shadow-md">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-screen bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between w-[260px] z-40 transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-[260px]'}`}>
        <div>
          <div className="flex items-center gap-2 px-6 py-6 pl-10 pt-10 w-full max-w-[210px]">
            <img src={homezyLogo} alt="Homezy Logo" className="w-11 h-11 object-contain flex-shrink-0" />
            <div className="flex flex-col items-start min-w-0">
              <h1 className="text-[26px] font-bold text-[#23364A] leading-tight truncate">Homezy</h1>
              <span className="mt-1 px-2 py-[2px] rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold shadow border border-white/70 align-middle tracking-wider" style={{letterSpacing: '0.5px', maxWidth: '70px', whiteSpace: 'nowrap'}}>Host</span>
            </div>
          </div>
          <nav className="flex flex-col mt-4">
            {getNavItem("/host-notifications", "Notifications", Bell)}
              <div className="border-t border-gray-300 my-4 mx-6"></div>
            {getNavItem('/dashboard','Dashboard',Home)}
            {getNavItem('/listings','My Listings',Clipboard)}
            {getNavItem('/host-messages','Messages',MessageSquare)}
            {getNavItem('/calendar','Calendar',Calendar)}
            {getNavItem('/points-rewards','Points & Rewards',Gift)}
            {getNavItem('/earnings','Earnings',DollarSign)}
          </nav>
        </div>
        {/* Profile + Logout (simplified) */}
        <div className="flex flex-col items-center gap-4 mb-6 relative px-4" ref={dropdownRef}>
          <button onClick={() => !host ? navigate('/login') : setDropdownOpen(!dropdownOpen)} className="flex items-center justify-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium hover:bg-gray-300 transition w-full">
            {host?.photoURL ? (
              <img src={host.photoURL} alt="profile" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {(host?.firstName || host?.email || "H").charAt(0).toUpperCase()}
              </div>
            )}
            <span>{host?.firstName || 'Host'}</span>
          </button>
          {host && dropdownOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden z-50">
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {host.photoURL ? (
                    <img src={host.photoURL} alt="profile" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg border border-gray-200 flex-shrink-0">
                      {(host.firstName || host.email || "H").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-gray-800 font-semibold text-sm">{host.firstName || 'Host'}</p>
                    <p className="text-xs text-gray-500">{host.email || 'host@example.com'}</p>
                  </div>
                </div>
              </div>
              <div className="py-2 text-sm text-gray-700">
                <button onClick={() => { setDropdownOpen(false); navigate('/profile'); }} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left">
                  <User className="w-4 h-4 text-orange-500" /> Profile Settings
                </button>
                <button onClick={() => { setDropdownOpen(false); navigate('/host-bookings'); }} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left">
                  <Calendar className="w-4 h-4 text-orange-500" /> Bookings
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
          <button onClick={handleLogout} className="bg-[#B50000] text-white font-medium py-2 w-full rounded-md hover:opacity-90 flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-8 md:px-16 py-6 md:py-10 md:ml-[260px]">
        {/* Page Heading */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-[32px] font-bold mb-2 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
              <DollarSign className="w-7 h-7" />
            </span>
            Earnings Overview
          </h2>
          <p className="text-[#5E6282] text-base sm:text-lg mb-8">Track your earnings performance and booking history.</p>
        </div>
        {/* Tab Switcher */}
        <div className="mb-8">
          <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
            <button 
              onClick={() => setActiveTab('overview')} 
              className={`px-6 py-2.5 rounded-md font-semibold transition-all ${
                activeTab === 'overview' 
                  ? 'bg-white text-[#FF5A1F] shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('history')} 
              className={`px-6 py-2.5 rounded-md font-semibold transition-all ${
                activeTab === 'history' 
                  ? 'bg-white text-[#FF5A1F] shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Earnings History
            </button>
          </div>
        </div>
        <div className="min-h-[300px]">
          {/* Existing content area retained below */}
          <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading earnings data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-8">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="bg-white border-2 border-green-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-green-100 p-3 rounded-lg">
                          <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">Total Earnings</p>
                      <p className="text-2xl font-bold text-gray-900">{formatPrice(totalEarnings)}</p>
                      <p className="text-xs text-gray-500 mt-1">All time</p>
                    </div>

                    <div className="bg-white border-2 border-blue-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <Calendar className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">This Month</p>
                      <p className="text-2xl font-bold text-gray-900">{formatPrice(thisMonthEarnings)}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                    </div>

                    <div className="bg-white border-2 border-purple-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-purple-100 p-3 rounded-lg">
                          <TrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">This Year</p>
                      <p className="text-2xl font-bold text-gray-900">{formatPrice(thisYearEarnings)}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date().getFullYear()}</p>
                    </div>

                    <div className="bg-white border-2 border-orange-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-orange-100 p-3 rounded-lg">
                          <Clipboard className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">Total Bookings</p>
                      <p className="text-2xl font-bold text-gray-900">{totalBookings}</p>
                      <p className="text-xs text-gray-500 mt-1">Completed</p>
                    </div>
                  </div>

                  {/* Additional Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-white/20 p-3 rounded-lg">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <TrendingUp className="w-5 h-5 opacity-80" />
                      </div>
                      <p className="text-sm opacity-90 mb-1">Average Per Booking</p>
                      <p className="text-2xl font-bold">{formatPrice(avgEarningsPerBooking)}</p>
                      <p className="text-xs opacity-75 mt-1">Based on {totalBookings} bookings</p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-white/20 p-3 rounded-lg">
                          <Banknote className="w-6 h-6" />
                        </div>
                        <Calendar className="w-5 h-5 opacity-80" />
                      </div>
                      <p className="text-sm opacity-90 mb-1">Monthly Average</p>
                      <p className="text-2xl font-bold">{formatPrice(thisYearEarnings / (new Date().getMonth() + 1))}</p>
                      <p className="text-xs opacity-75 mt-1">Year-to-date average</p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <div className="w-1 h-5 bg-orange-500 rounded"></div>
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => setActiveTab("history")}
                        className="flex items-center gap-4 p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all group"
                      >
                        <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition">
                          <Banknote className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800">View History</p>
                          <p className="text-xs text-gray-600">All earnings</p>
                        </div>
                      </button>
                      <button
                        onClick={() => navigate("/dashboard")}
                        className="flex items-center gap-4 p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-400 transition-all group"
                      >
                        <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition">
                          <Home className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800">Dashboard</p>
                          <p className="text-xs text-gray-600">View bookings</p>
                        </div>
                      </button>
                      <button
                        onClick={() => navigate("/host-bookings")}
                        className="flex items-center gap-4 p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 hover:border-green-400 transition-all group"
                      >
                        <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition">
                          <Clipboard className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800">Bookings</p>
                          <p className="text-xs text-gray-600">Manage bookings</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Earnings Information */}
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-5 rounded-r-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-900">About Your Earnings</p>
                        <p className="text-sm text-blue-800 mt-1">
                          Your earnings are calculated from completed bookings. Earnings from active bookings are shown here and updated in real-time. Check the Earnings History tab to see detailed transaction records.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Earnings History Tab */}
              {activeTab === "history" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <div className="w-1 h-5 bg-orange-500 rounded"></div>
                      Earnings History
                    </h3>
                    
                    {activeBookings.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Banknote className="w-10 h-10 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium text-lg">No earnings yet</p>
                        <p className="text-sm text-gray-500 mt-2">Your earnings from bookings will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Summary Stats */}
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-5 mb-6 border border-green-200">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-xs text-gray-600">Total Earnings</p>
                              <p className="text-2xl font-bold text-green-600">{formatPrice(totalEarnings)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Total Bookings</p>
                              <p className="text-2xl font-bold text-blue-600">{totalBookings}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Avg. per Booking</p>
                              <p className="text-2xl font-bold text-purple-600">{formatPrice(avgEarningsPerBooking)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Earnings List */}
                        <div className="space-y-3">
                          {activeBookings
                            .sort((a, b) => {
                              const dateA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt);
                              const dateB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
                              return dateB - dateA;
                            })
                            .map((booking) => {
                              const earnings = booking.finalPrice || booking.price || 0;
                              const discount = booking.discount || 0;
                              const originalPrice = booking.price || 0;
                              const bookingDate = new Date(
                                booking.createdAt?.seconds 
                                  ? booking.createdAt.seconds * 1000 
                                  : booking.createdAt
                              );
                              const checkInDate = new Date(
                                booking.checkIn?.seconds 
                                  ? booking.checkIn.seconds * 1000 
                                  : booking.checkIn
                              );
                              
                              return (
                                <div
                                  key={booking.id}
                                  className="p-5 bg-gradient-to-r from-green-50 to-white rounded-xl border-2 border-green-200 hover:shadow-md transition-all"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <h3 className="font-bold text-gray-900 text-lg">{booking.listingTitle}</h3>
                                        {booking.couponUsed && (
                                          <span className="px-2.5 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                                            COUPON APPLIED
                                          </span>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 mb-3">
                                        <p className="flex items-center gap-2">
                                          <span className="font-semibold text-gray-800">📅 Booked:</span>
                                          {bookingDate.toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric"
                                          })}
                                        </p>
                                        <p className="flex items-center gap-2">
                                          <span className="font-semibold text-gray-800">🏠 Check-in:</span>
                                          {checkInDate.toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric"
                                          })}
                                        </p>
                                        <p className="flex items-center gap-2">
                                          <span className="font-semibold text-gray-800">👥 Guests:</span>
                                          {(booking.guests?.adults || 0) +
                                            (booking.guests?.children || 0) +
                                            (booking.guests?.infants || 0) +
                                            (booking.guests?.pets || 0)}
                                        </p>
                                        <p className="flex items-center gap-2">
                                          <span className="font-semibold text-gray-800">📋 Status:</span>
                                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                                            {booking.status || 'Completed'}
                                          </span>
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      {discount > 0 ? (
                                        <>
                                          <p className="text-sm text-gray-400 line-through">
                                            {formatPrice(originalPrice)}
                                          </p>
                                          <p className="text-2xl font-bold text-green-600">
                                            {formatPrice(earnings)}
                                          </p>
                                          <p className="text-xs text-gray-600 mt-1 bg-orange-100 px-2 py-1 rounded">
                                            -{formatPrice(discount)} discount
                                          </p>
                                        </>
                                        ) : (
                                          <span className="text-lg font-bold text-green-600">
                                          {formatPrice(earnings)}
                                        </span>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Earnings;
