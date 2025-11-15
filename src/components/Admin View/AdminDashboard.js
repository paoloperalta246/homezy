import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "../Host View/images/homezy-logo.png";
import { LayoutDashboard, Users, DollarSign, FileText, Shield, Settings, LogOut, User } from "lucide-react";

const AdminDashboard = () => {
  const [admin, setAdmin] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [serviceFeesTotal, setServiceFeesTotal] = useState(null);
  const [guestWishlists, setGuestWishlists] = useState([]);
  // Derived: recent bookings (last 5, sorted by createdAt desc)
  const recentBookings = [...bookings]
    .sort((a, b) => {
      const dateA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
      const dateB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  // Total confirmed bookings (like Host Dashboard)
  const totalConfirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const [reviews, setReviews] = useState([]);
  const [commentModal, setCommentModal] = useState({ open: false, comment: '', guest: '', property: '' });
  const [loadingData, setLoadingData] = useState(true);
  const [hostCount, setHostCount] = useState(null);
  const [guestCount, setGuestCount] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  // Fetch all bookings and reviews for dynamic sections
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        // Fetch bookings
        const bookingsSnap = await getDocs(collection(db, "bookings"));
        const bookingsList = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBookings(bookingsList);

        // Fetch reviews
        const reviewsSnap = await getDocs(collection(db, "reviews"));
        const reviewsList = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setReviews(reviewsList);

        // Fetch hosts count (only those with non-empty email)
        const hostsSnap = await getDocs(query(collection(db, "hosts"), where("email", ">", "")));
        setHostCount(hostsSnap.size);

        // Fetch guests count (only those with non-empty email)
        const guestsSnap = await getDocs(query(collection(db, "guests"), where("email", ">", "")));
        setGuestCount(guestsSnap.size);

        // Fetch total service fees (all paid)
        const feesSnap = await getDocs(query(collection(db, "serviceFees"), where("status", "==", "paid")));
        const totalFees = feesSnap.docs.reduce((sum, doc) => {
          const data = doc.data();
          return sum + (typeof data.amount === 'number' ? data.amount : 0);
        }, 0);
        setServiceFeesTotal(totalFees);

        // Fetch guest wishlists
        const wishlistsSnap = await getDocs(collection(db, "guestWishlist"));
        const wishlistsList = wishlistsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGuestWishlists(wishlistsList);
      } catch (e) {
        console.error("Failed to fetch bookings, reviews, hosts, guests, service fees, or wishlists", e);
        setServiceFeesTotal(null);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

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
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${disabled
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

  // Helper: Map listingId to booking image
  const listingImageMap = {};
  bookings.forEach(b => {
    if (b.listingId) listingImageMap[b.listingId] = b.listingImage;
  });

  return (
    <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans flex-col md:flex-row">
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
        className={`fixed top-0 left-0 h-screen bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between w-[85vw] max-w-[260px] z-40 transition-transform duration-300 md:w-[260px] md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-[85vw] md:translate-x-0"}`}
        style={{ minWidth: 0 }}
      >
        <div>
          <div className="flex items-center gap-2 px-6 py-6 pl-10 pt-10 w-full max-w-[210px]">
            <img
              src={homezyLogo}
              alt="Homezy Logo"
              className="w-11 h-11 object-contain flex-shrink-0"
            />
            <div className="flex flex-col items-start min-w-0">
              <h1 className="text-[26px] font-bold text-[#23364A] leading-tight truncate whitespace-nowrap">Homezy</h1>
              <span className="mt-1 px-2 py-[2px] rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold shadow border border-white/70 align-middle tracking-wider" style={{ letterSpacing: '0.5px', maxWidth: '70px', whiteSpace: 'nowrap' }}>Admin</span>
            </div>
          </div>
          <nav className="flex flex-col mt-4">
            {getNavItem("/admin-dashboard", "Dashboard", LayoutDashboard)}
            {/* <div className="border-t border-gray-300 my-4 mx-6"></div> */}
            {getNavItem("/guests-hosts", "Guests & Hosts", Users)}
            {getNavItem("/service-fees", "Service Fees", DollarSign)}
            {getNavItem("/admin-compliance", "Compliance", Shield)}
            {getNavItem("/admin-reports", "Reports", FileText)}
            {getNavItem("/admin-settings", "Settings", Settings)}
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
      <main className="flex-1 px-2 sm:px-8 md:px-16 py-6 sm:py-8 md:py-10 pt-16 sm:pt-6 md:pt-10 md:ml-[260px] w-full max-w-full overflow-x-hidden">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl md:text-[32px] font-bold mb-2 flex items-center gap-2 truncate whitespace-nowrap">
            <span className="p-1.5 sm:p-2 rounded-xl bg-orange-500/10 text-orange-600">
              <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
            </span>
            <span className="truncate whitespace-nowrap">Dashboard</span>
          </h2>
          <p className="text-[#5E6282] text-sm sm:text-base md:text-lg mb-6 sm:mb-8 truncate whitespace-nowrap max-w-full">
            Quick insights into users, bookings, and trends.
          </p>
        </div>

        {/* Placeholder content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
          {/* Total Bookings */}
          <div className="relative bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 rounded-2xl p-4 sm:p-7 shadow-lg overflow-hidden border border-blue-100 hover:shadow-2xl transition-all group min-w-0">
            <div className="absolute right-4 top-4 opacity-10 text-blue-400 text-7xl pointer-events-none select-none">
              <Users className="w-20 h-20" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-4 rounded-xl shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-blue-700">Total Bookings</span>
            </div>
            <p className="text-4xl font-extrabold text-blue-900 mb-1">{loadingData ? '--' : totalConfirmedBookings}</p>
            <p className="text-sm text-blue-500 font-medium">Confirmed bookings</p>
          </div>

          {/* Service Fees */}
          <div className="relative bg-gradient-to-br from-green-50 via-green-100 to-green-200 rounded-2xl p-4 sm:p-7 shadow-lg overflow-hidden border border-green-100 hover:shadow-2xl transition-all group min-w-0">
            <div className="absolute right-4 top-4 opacity-10 text-green-400 text-7xl pointer-events-none select-none">
              <DollarSign className="w-20 h-20" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-green-500 to-green-700 p-4 rounded-xl shadow-lg">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-green-700">Service Fees</span>
            </div>
            <p className="text-4xl font-extrabold text-green-900 mb-1">
              {loadingData || serviceFeesTotal === null ? '₱ --' : `₱${serviceFeesTotal.toLocaleString()}`}
            </p>
            <p className="text-sm text-green-500 font-medium">Total platform fees</p>
          </div>


          {/* Total Hosts */}
          <div className="relative bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 rounded-2xl p-4 sm:p-7 shadow-lg overflow-hidden border border-purple-100 hover:shadow-2xl transition-all group min-w-0">
            <div className="absolute right-4 top-4 opacity-10 text-purple-400 text-7xl pointer-events-none select-none">
              <User className="w-20 h-20" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-4 rounded-xl shadow-lg">
                <User className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-purple-700">Total Hosts</span>
            </div>
            <p className="text-4xl font-extrabold text-purple-900 mb-1">{loadingData || hostCount === null ? '--' : hostCount}</p>
            <p className="text-sm text-purple-500 font-medium">Registered hosts</p>
          </div>


          {/* Total Guests */}
          <div className="relative bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 rounded-2xl p-4 sm:p-7 shadow-lg overflow-hidden border border-orange-100 hover:shadow-2xl transition-all group min-w-0">
            <div className="absolute right-4 top-4 opacity-10 text-orange-400 text-7xl pointer-events-none select-none">
              <Users className="w-20 h-20" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-4 rounded-xl shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-orange-700">Total Guests</span>
            </div>
            <p className="text-4xl font-extrabold text-orange-900 mb-1">{loadingData || guestCount === null ? '--' : guestCount}</p>
            <p className="text-sm text-orange-500 font-medium">Registered guests</p>
          </div>
        </div>

        {/* Guest Wishlists Table */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-pink-500/10">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-pink-600" />
              </div>
              <span>Guest Wishlists</span>
            </h3>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md w-full max-w-full overflow-x-auto">
            {/* Desktop/tablet table */}
            <table className="w-full max-w-full hidden sm:table table-fixed">
              <thead className="bg-gradient-to-r from-pink-50 to-pink-100 border-b-2 border-pink-200">
                <tr>
                  <th className="w-1/4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guest</th>
                  <th className="w-1/4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="w-1/4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Wishlist</th>
                  <th className="w-1/4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date Added</th>
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr>
                    <td className="px-3 sm:px-4 md:px-6 py-4 text-pink-400 italic" colSpan={4}>
                      Loading wishlists...
                    </td>
                  </tr>
                ) : guestWishlists.length === 0 ? (
                  <tr>
                    <td className="px-3 sm:px-4 md:px-6 py-4 text-gray-400 italic" colSpan={4}>
                      No wishlists found.
                    </td>
                  </tr>
                ) : (
                  guestWishlists.map((w) => (
                    <tr key={w.id} className="hover:bg-pink-50/30 transition-all duration-200">
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                          {w.guestPhoto ? (
                            <img src={w.guestPhoto} alt={w.guestName || 'Guest'} className="w-8 h-8 rounded-full object-cover border border-pink-200 shadow" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold text-xs">
                              {(w.guestName || w.guestEmail || 'G').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800 text-xs sm:text-sm">
                              {w.guestName || 'Guest'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">{w.guestEmail || ''}</td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">{w.text || w.itemName || w.title || w.name || '—'}</td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">{w.createdAt?.seconds
                        ? new Date(w.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {/* Mobile stacked cards */}
            <div className="flex flex-col gap-3 sm:hidden p-1">
              {loadingData ? (
                <div className="text-pink-400 italic text-center py-4 bg-pink-50 rounded-lg">Loading wishlists...</div>
              ) : guestWishlists.length === 0 ? (
                <div className="text-gray-400 italic text-center py-4 bg-pink-50 rounded-lg">No wishlists found.</div>
              ) : (
                guestWishlists.map((w) => (
                  <div key={w.id} className="bg-white border border-pink-100 rounded-xl shadow-sm p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-3 mb-1">
                      {w.guestPhoto ? (
                        <img src={w.guestPhoto} alt={w.guestName || 'Guest'} className="w-10 h-10 rounded-full object-cover border border-pink-200 shadow" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold text-base">
                          {(w.guestName || w.guestEmail || 'G').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{w.guestName || 'Guest'}</p>
                        <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[120px]">{w.guestEmail || ''}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-700 truncate whitespace-nowrap max-w-[180px]"><span className="font-semibold">Wishlist:</span> {w.text || w.itemName || w.title || w.name || '—'}</div>
                    <div className="text-xs text-gray-700 truncate whitespace-nowrap max-w-[180px]"><span className="font-semibold">Date Added:</span> {w.createdAt?.seconds
                      ? new Date(w.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {/* Recent Bookings Section - like Host Recent Reservations */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/10">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <span>Recent Bookings</span>
            </h3>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md overflow-x-auto w-full max-w-full">
            {loadingData ? (
              <p className="text-blue-400 p-6">Loading bookings...</p>
            ) : recentBookings.length === 0 ? (
              <p className="text-blue-400 p-6">No bookings found.</p>
            ) : (
              <table className="w-full max-w-full text-xs sm:text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-blue-200">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Property</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guest</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Check-in</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Check-out</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-blue-50/30 transition-all duration-200">
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="relative">
                            <img
                              src={b.listingImage || "/default-listing.png"}
                              alt={b.listingTitle}
                              className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl object-cover ring-2 ring-gray-100"
                            />
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[120px]">
                              {b.listingTitle || '—'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate whitespace-nowrap max-w-[120px]">
                              ID: {b.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {(b.guestName || b.guestEmail || 'G').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[100px]">
                              {b.guestName || 'Guest'}
                            </p>
                            <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[100px] sm:max-w-[150px]">
                              {b.guestEmail || ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap max-w-[140px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex items-center justify-center">📅</span>
                          </div>
                          <span className="text-xs sm:text-sm text-gray-800 font-medium truncate whitespace-nowrap block">
                            {b.checkIn?.seconds
                              ? new Date(b.checkIn.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : b.checkIn ? new Date(b.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap max-w-[140px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex items-center justify-center">📅</span>
                          </div>
                          <span className="text-xs sm:text-sm text-gray-800 font-medium truncate whitespace-nowrap block">
                            {b.checkOut?.seconds
                              ? new Date(b.checkOut.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : b.checkOut ? new Date(b.checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div>
                          <p className="font-bold text-gray-800 text-sm sm:text-base">
                            ₱{(b.finalPrice || b.price || 0).toLocaleString()}.00
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Best Reviewed Bookings Section - Redesigned */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-green-500/10">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <span>Best Reviewed Bookings</span>
            </h3>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md overflow-x-auto w-full max-w-full">
            {loadingData ? (
              <p className="text-green-400 p-6">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="text-green-400 p-6">No reviews found.</p>
            ) : (
              <table className="w-full max-w-full text-xs sm:text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-green-200">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Property</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guest</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rating</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reviews
                    .filter(r => typeof r.rating === 'number')
                    .sort((a, b) => b.rating - a.rating)
                    .slice(0, 5)
                    .map((r) => {
                      const img = (r.listingId && listingImageMap[r.listingId]) || "/default-listing.png";
                      return (
                        <tr key={r.id} className="hover:bg-green-50/30 transition-all duration-200">
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="relative">
                                <img
                                  src={img}
                                  alt={r.listingName || r.listingTitle}
                                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl object-cover ring-2 ring-gray-100"
                                />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[120px]">
                                  {r.listingName || r.listingTitle || '—'}
                                </p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate whitespace-nowrap max-w-[120px]">
                                  ID: {r.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                {(r.name || r.email || 'G').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[100px]">
                                  {r.name || 'Guest'}
                                </p>
                                <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[100px] sm:max-w-[150px]">
                                  {r.email || ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold shadow-sm bg-gradient-to-r from-green-500 to-green-600 text-white">
                              {r.rating} <span className="ml-1 text-yellow-300">★</span>
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 max-w-xs truncate">
                            <div className="flex items-center gap-2">
                              <span className="truncate block whitespace-nowrap max-w-[120px] sm:max-w-[180px] md:max-w-[220px]">
                                {r.comment || '—'}
                              </span>
                              {r.comment && r.comment.length > 40 && (
                                <button
                                  className="ml-1 px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold shadow-sm hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition"
                                  onClick={() => setCommentModal({ open: true, comment: r.comment, guest: r.name || r.email || 'Guest', property: r.listingName || r.listingTitle || 'Property' })}
                                  type="button"
                                >
                                  VIEW ALL
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Lowest Reviewed Bookings Section - Redesigned */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-red-500/10">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
              <span>Lowest Reviewed Bookings</span>
            </h3>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md overflow-x-auto w-full max-w-full">
            {loadingData ? (
              <p className="text-red-400 p-6">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="text-red-400 p-6">No reviews found.</p>
            ) : (
              <table className="w-full max-w-full text-xs sm:text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-red-200">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Property</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guest</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rating</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reviews
                    .filter(r => typeof r.rating === 'number')
                    .sort((a, b) => a.rating - b.rating)
                    .slice(0, 5)
                    .map((r) => {
                      const img = (r.listingId && listingImageMap[r.listingId]) || "/default-listing.png";
                      return (
                        <tr key={r.id} className="hover:bg-red-50/30 transition-all duration-200">
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="relative">
                                <img
                                  src={img}
                                  alt={r.listingName || r.listingTitle}
                                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl object-cover ring-2 ring-gray-100"
                                />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[120px]">
                                  {r.listingName || r.listingTitle || '—'}
                                </p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate whitespace-nowrap max-w-[120px]">
                                  ID: {r.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                {(r.name || r.email || 'G').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[100px]">
                                  {r.name || 'Guest'}
                                </p>
                                <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[100px] sm:max-w-[150px]">
                                  {r.email || ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold shadow-sm bg-gradient-to-r from-red-500 to-red-600 text-white">
                              {r.rating} <span className="ml-1 text-yellow-300">★</span>
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 max-w-xs truncate">
                            <div className="flex items-center gap-2">
                              <span className="truncate block whitespace-nowrap max-w-[120px] sm:max-w-[180px] md:max-w-[220px]">
                                {r.comment || '—'}
                              </span>
                              {r.comment && r.comment.length > 40 && (
                                <button
                                  className="ml-1 px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold shadow-sm hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition"
                                  onClick={() => setCommentModal({ open: true, comment: r.comment, guest: r.name || r.email || 'Guest', property: r.listingName || r.listingTitle || 'Property' })}
                                  type="button"
                                >
                                  VIEW ALL
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
      {/* Comment Modal */}
      {commentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
              <h3 className="text-lg sm:text-xl font-semibold text-[#23364A] flex items-center gap-2">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 mr-1" />
                Review Comment
              </h3>
              <button
                className="p-2 rounded-full hover:bg-gray-100 transition"
                onClick={() => setCommentModal({ open: false, comment: '', guest: '', property: '' })}
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-4 sm:px-6 pt-3 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500">Guest:</span>
                <span className="text-xs sm:text-sm font-semibold text-blue-700 break-all">{commentModal.guest}</span>
                <span className="hidden sm:inline text-gray-300">|</span>
                <span className="text-xs font-medium text-gray-500">Property:</span>
                <span className="text-xs sm:text-sm font-semibold text-green-700 break-all">{commentModal.property}</span>
              </div>
            </div>
            <div className="px-4 sm:px-6 pb-6 flex-1 overflow-y-auto">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 text-gray-900 whitespace-pre-line text-sm sm:text-base shadow-inner break-words min-h-[60px]">
                {commentModal.comment}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
