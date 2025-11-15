import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase"; // ✅ Import your Firebase config
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png"; // ✅ Add this image
import { Home, Clipboard, User, Gift, MessageSquare, Calendar, Ticket, Users, CreditCard, XCircle, DollarSign, Bell, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("today");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState(null); // ✅ Host data
  const [dropdownOpen, setDropdownOpen] = useState(false); // ✅ Added
  const dropdownRef = useRef(null); // ✅ Added
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const currentPath = location.pathname;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // normalize the booking date
    return d;
  };


  // Match Bookings.js logic for today and upcoming
  const todayBookings = bookings.filter(
    (b) =>
      b.status === 'confirmed' &&
      normalizeDate(b.checkIn) <= today &&
      normalizeDate(b.checkOut) >= today
  );

  const upcomingBookings = bookings.filter(
    (b) =>
      b.status === 'confirmed' &&
      normalizeDate(b.checkIn) > today
  );

  // All bookings (only confirmed, matching Bookings.js summary)
  const allBookings = bookings.filter(b => b.status === 'confirmed');

  // Calculate dashboard metrics
  const thisMonth = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const thisMonthBookings = bookings.filter(b => {
    const bookingDate = b.createdAt?.seconds
      ? new Date(b.createdAt.seconds * 1000)
      : b.createdAt ? new Date(b.createdAt) : null;
    if (!bookingDate) return false;
    return bookingDate.getMonth() === thisMonth.getMonth() &&
      bookingDate.getFullYear() === thisMonth.getFullYear();
  });

  const lastMonthBookings = bookings.filter(b => {
    const bookingDate = b.createdAt?.seconds
      ? new Date(b.createdAt.seconds * 1000)
      : b.createdAt ? new Date(b.createdAt) : null;
    if (!bookingDate) return false;
    return bookingDate.getMonth() === lastMonth.getMonth() &&
      bookingDate.getFullYear() === lastMonth.getFullYear();
  });

  const bookingGrowth = lastMonthBookings.length > 0
    ? (((thisMonthBookings.length - lastMonthBookings.length) / lastMonthBookings.length) * 100).toFixed(1)
    : thisMonthBookings.length > 0 ? 100 : 0;

  const occupancyRate = bookings.length > 0
    ? ((todayBookings.length / bookings.length) * 100).toFixed(1)
    : 0;

  const upcomingRate = bookings.length > 0
    ? ((upcomingBookings.length / bookings.length) * 100).toFixed(1)
    : 0;

  const totalRevenue = bookings.reduce((sum, b) => sum + (b.finalPrice || b.price || 0), 0);
  const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + (b.finalPrice || b.price || 0), 0);
  const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + (b.finalPrice || b.price || 0), 0);

  const revenueGrowth = lastMonthRevenue > 0
    ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
    : thisMonthRevenue > 0 ? 100 : 0;

  // Calculate total guests
  const totalGuests = bookings.reduce((sum, b) => {
    const guests = b.guests || {};
    return sum + (guests.adults || 0) + (guests.children || 0) + (guests.infants || 0) + (guests.pets || 0);
  }, 0);

  const thisMonthGuests = thisMonthBookings.reduce((sum, b) => {
    const guests = b.guests || {};
    return sum + (guests.adults || 0) + (guests.children || 0) + (guests.infants || 0) + (guests.pets || 0);
  }, 0);

  const lastMonthGuests = lastMonthBookings.reduce((sum, b) => {
    const guests = b.guests || {};
    return sum + (guests.adults || 0) + (guests.children || 0) + (guests.infants || 0) + (guests.pets || 0);
  }, 0);

  const guestGrowth = lastMonthGuests > 0
    ? (((thisMonthGuests - lastMonthGuests) / lastMonthGuests) * 100).toFixed(1)
    : thisMonthGuests > 0 ? 100 : 0;

  // Get recent reservations (last 5 bookings sorted by creation date)
  const recentReservations = [...bookings]
    .sort((a, b) => {
      const dateA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
      const dateB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  const BookingCard = ({ booking }) => (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden w-full group">
      {/* Thumbnail */}
      <div className="relative h-64 w-full overflow-hidden">
        <img
          src={booking.listingImage || "/default-listing.png"}
          alt={booking.listingTitle}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
      </div>

      {/* Info Section */}
      <div className="p-6">
        <h3 className="font-bold text-gray-800 text-xl mb-4 line-clamp-1">
          {booking.listingTitle}
        </h3>

        {/* Date Info */}
        <div className="space-y-3 mb-5">
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0 text-orange-500" />
            <div className="flex-1">
              <p className="font-semibold text-gray-700 mb-1">Check-in</p>
              <p>
                {booking.checkIn
                  ? new Date(
                    booking.checkIn.seconds
                      ? booking.checkIn.seconds * 1000
                      : booking.checkIn
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                  : "Not specified"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-sm text-gray-600">
            <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0 text-orange-500" />
            <div className="flex-1">
              <p className="font-semibold text-gray-700 mb-1">Check-out</p>
              <p>
                {booking.checkOut
                  ? new Date(
                    booking.checkOut.seconds
                      ? booking.checkOut.seconds * 1000
                      : booking.checkOut
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                  : "Not specified"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Users className="w-5 h-5 flex-shrink-0 text-orange-500" />
            <span className="font-semibold text-gray-700">Guests:</span>
            <span>
              {(booking.guests?.adults || 0) +
                (booking.guests?.children || 0) +
                (booking.guests?.infants || 0) +
                (booking.guests?.pets || 0)}
            </span>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <div className="text-right">
            {booking.couponUsed && booking.discount > 0 ? (
              <>
                <p className="text-sm text-gray-400 line-through">
                  ₱{booking.price.toLocaleString()}.00
                </p>
                <p className="font-bold text-gray-800 text-2xl">
                  ₱{(booking.finalPrice || booking.price).toLocaleString()}.00
                </p>
                <p className="text-xs text-green-600 font-medium">
                  Guest saved ₱{booking.discount.toLocaleString()} with {booking.couponUsed.code}
                </p>
              </>
            ) : (
              <p className="font-bold text-gray-800 text-2xl">
                ₱{booking.price.toLocaleString()}.00
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // 🔥 Track logged-in user and fetch their Firestore data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "hosts", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setHost(docSnap.data());
        } else {
          console.log("No host data found for this user");
        }
      } // <-- close the if(user) block
    }); // <-- close onAuthStateChanged callback

    return () => unsubscribe();
  }, []);


  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigation = (path) => {
    navigate(path);
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

  useEffect(() => {
    const fetchBookings = async () => {
      if (!auth.currentUser) return;
      setLoading(true);

      try {
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("hostId", "==", auth.currentUser.uid)
        );

        const snapshot = await getDocs(bookingsQuery); // ✅ use getDocs
        const fetchedBookings = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            checkIn: data.checkIn?.toDate ? data.checkIn.toDate() : data.checkIn ? new Date(data.checkIn) : null,
            checkOut: data.checkOut?.toDate ? data.checkOut.toDate() : data.checkOut ? new Date(data.checkOut) : null,
          };
        });

        console.log("Fetched bookings:", fetchedBookings);
        console.log("Total guests calculation:", fetchedBookings.reduce((sum, b) => {
          const guests = b.guests || {};
          const count = (guests.adults || 0) + (guests.children || 0) + (guests.infants || 0) + (guests.pets || 0);
          console.log(`Booking ${b.id}:`, b.guests, "Count:", count);
          return sum + count;
        }, 0));

        setBookings(fetchedBookings);
      } catch (err) {
        console.error("Failed to fetch bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans relative">
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
          className={`fixed top-0 left-0 h-screen bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between w-[80vw] max-w-[260px] z-40 transition-transform duration-300 md:w-[260px] md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-[80vw] md:translate-x-0"}`}
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
              {getNavItem("/host-notifications", "Notifications", Bell)}
              <div className="border-t border-gray-300 my-4 mx-6"></div>
              {getNavItem("/dashboard", "Dashboard", Home)}
              {getNavItem("/listings", "My Listings", Clipboard)}
              {getNavItem("/host-messages", "Messages", MessageSquare)}
              {getNavItem("/calendar", "Calendar", Calendar)}
              {getNavItem("/points-rewards", "Points & Rewards", Gift)}
              {getNavItem("/earnings", "Earnings", DollarSign)}
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
              {host?.photoURL ? (
                <img
                  src={host.photoURL}
                  alt="profile"
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {(host?.firstName || host?.email || "H").charAt(0).toUpperCase()}
                </div>
              )}
              <span>{host?.firstName || "Host"}</span>
            </button>

            {host && dropdownOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden z-50">
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {host.photoURL ? (
                      <img
                        src={host.photoURL}
                        alt="profile"
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg border border-gray-200 flex-shrink-0">
                        {(host.firstName || host.email || "H").charAt(0).toUpperCase()}
                      </div>
                    )}
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
      </>

      {/* ===== Main Content ===== */}
      <main className="flex-1 px-2 xs:px-4 sm:px-8 md:px-16 py-4 xs:py-6 sm:py-8 md:py-10 pt-16 sm:pt-6 md:pt-10 md:ml-[260px] transition-all max-w-full overflow-x-hidden">
        {/* Page Heading */}
        <div className="mb-4 xs:mb-6 sm:mb-8">
          <h2 className="text-lg xs:text-xl sm:text-2xl md:text-[32px] font-bold mb-2 flex items-center gap-2">
            <span className="p-1 sm:p-1.5 md:p-2 rounded-xl bg-orange-500/10 text-orange-600">
              <Home className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
            </span>
            Dashboard
          </h2>
          <p className="text-[#5E6282] text-xs xs:text-sm sm:text-base md:text-lg mb-4 xs:mb-6 sm:mb-8">Welcome back! Here's your property overview.</p>
        </div>

        {/* Stats Cards */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 xs:gap-3 sm:gap-4 mb-4 xs:mb-6 sm:mb-8 w-full max-w-full">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-5 md:p-6 hover:shadow-lg transition-shadow text-white w-full max-w-full min-w-0">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="bg-white/20 p-2 sm:p-2.5 md:p-3 rounded-lg">
                  <DollarSign className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-white" />
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${parseFloat(revenueGrowth) >= 0
                    ? 'bg-green-400/30 text-green-100'
                    : 'bg-red-400/30 text-red-100'
                  }`}>
                  {parseFloat(revenueGrowth) >= 0 ? '↑' : '↓'} {Math.abs(revenueGrowth)}%
                </div>
              </div>
              <p className="text-sm text-blue-100 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-white">₱{totalRevenue.toLocaleString()}.00</p>
              <p className="text-xs text-blue-200 mt-2">
                ₱{thisMonthRevenue.toLocaleString()}.00 this month
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 sm:p-5 md:p-6 hover:shadow-lg transition-shadow text-white w-full max-w-full min-w-0">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="bg-white/20 p-2 sm:p-2.5 md:p-3 rounded-lg">
                  <Calendar className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-bold bg-white/20 text-green-100">
                  {todayBookings.length}
                </div>
              </div>
              <p className="text-xs sm:text-sm text-green-100 mb-1">Active Today</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{todayBookings.length}</p>
              <p className="text-xs text-green-200 mt-1 sm:mt-2">
                Bookings happening today
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 sm:p-5 md:p-6 hover:shadow-lg transition-shadow text-white w-full max-w-full min-w-0">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="bg-white/20 p-2 sm:p-2.5 md:p-3 rounded-lg">
                  <Home className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-bold bg-white/20 text-orange-100">
                  {upcomingBookings.length}
                </div>
              </div>
              <p className="text-xs sm:text-sm text-orange-100 mb-1">Upcoming Bookings</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{upcomingBookings.length}</p>
              <p className="text-xs text-orange-200 mt-1 sm:mt-2">
                Future reservations scheduled
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 sm:p-5 md:p-6 hover:shadow-lg transition-shadow text-white w-full max-w-full min-w-0">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-white/20 p-3 rounded-lg">
                  <Clipboard className="w-6 h-6 text-white" />
                </div>
                <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 text-purple-100">
                  {allBookings.length}
                </div>
              </div>
              <p className="text-sm text-purple-100 mb-1">All Bookings</p>
              <p className="text-2xl font-bold text-white">{allBookings.length}</p>
              <p className="text-xs text-purple-200 mt-2">
                Includes all bookings (today, upcoming, and past)
              </p>
            </div>
          </div>
        )}

        {/* Performance Overview */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 xs:gap-3 sm:gap-4 mb-4 xs:mb-6 sm:mb-8 w-full max-w-full">
            <div className="bg-white border border-gray-200 rounded-xl p-3 xs:p-4 sm:p-5 md:p-6 shadow-sm w-full max-w-full min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-orange-500 rounded"></div>
                Monthly Performance
              </h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between p-2.5 sm:p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-blue-100 p-1.5 sm:p-2 rounded-lg">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">This Month Revenue</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800">₱{thisMonthRevenue.toLocaleString()}.00</p>
                    </div>
                  </div>
                  <div className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${parseFloat(revenueGrowth) >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                    {parseFloat(revenueGrowth) >= 0 ? '+' : ''}{revenueGrowth}%
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 sm:p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-purple-100 p-1.5 sm:p-2 rounded-lg">
                      <Clipboard className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">New Bookings</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800">{thisMonthBookings.length}</p>
                    </div>
                  </div>
                  <div className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${parseFloat(bookingGrowth) >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                    {parseFloat(bookingGrowth) >= 0 ? '+' : ''}{bookingGrowth}%
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 sm:p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-green-100 p-1.5 sm:p-2 rounded-lg">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Average Booking Value</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800">
                        ₱{bookings.length > 0 ? (totalRevenue / bookings.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) + '.00' : '0.00'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3 xs:p-4 sm:p-5 md:p-6 shadow-sm w-full max-w-full min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <div className="w-1 h-4 sm:h-5 bg-orange-500 rounded"></div>
                Quick Actions
              </h3>
              <div className="space-y-2 sm:space-y-3">
                <button
                  onClick={() => navigate("/listings")}
                  className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all group w-full"
                >
                  <div className="bg-blue-100 p-2 sm:p-2.5 rounded-lg group-hover:bg-blue-200 transition">
                    <Clipboard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-sm sm:text-base text-gray-800">My Listings</p>
                    <p className="text-xs text-gray-600">Manage your properties</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/calendar")}
                  className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 border-2 border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-400 transition-all group w-full"
                >
                  <div className="bg-purple-100 p-2 sm:p-2.5 rounded-lg group-hover:bg-purple-200 transition">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-sm sm:text-base text-gray-800">Calendar</p>
                    <p className="text-xs text-gray-600">View your schedule</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/earnings")}
                  className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 border-2 border-green-200 rounded-lg hover:bg-green-50 hover:border-green-400 transition-all group w-full"
                >
                  <div className="bg-green-100 p-2 sm:p-2.5 rounded-lg group-hover:bg-green-200 transition">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-sm sm:text-base text-gray-800">Earnings</p>
                    <p className="text-xs text-gray-600">Track your revenue</p>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/host-messages")}
                  className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 border-2 border-orange-200 rounded-lg hover:bg-orange-50 hover:border-orange-400 transition-all group w-full"
                >
                  <div className="bg-orange-100 p-2 sm:p-2.5 rounded-lg group-hover:bg-orange-200 transition">
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-sm sm:text-base text-gray-800">Messages</p>
                    <p className="text-xs text-gray-600">Chat with guests</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Reservations */}
        {!loading && recentReservations.length > 0 && (
          <div className="mb-4 xs:mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-xl bg-orange-500/10">
                  <Clipboard className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                </div>
                <span className="hidden sm:inline">Recent Reservations</span>
                <span className="sm:hidden">Recent</span>
              </h3>
              <button
                onClick={() => navigate("/host-bookings")}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-1 sm:gap-2"
              >
                View All
                <span>→</span>
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md overflow-x-auto w-full max-w-full">
              <div className="w-full max-w-full">
                <table className="w-full max-w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-orange-200">
                    <tr>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Property
                      </th>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Guest
                      </th>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Check-in
                      </th>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Check-out
                      </th>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Guests
                      </th>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentReservations.map((booking) => (
                      <tr key={booking.id} className="hover:bg-orange-50/30 transition-all duration-200">
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="relative">
                              <img
                                src={booking.listingImage || "/default-listing.png"}
                                alt={booking.listingTitle}
                                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl object-cover ring-2 ring-gray-100"
                              />
                              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 text-xs sm:text-sm line-clamp-1">
                                {booking.listingTitle}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                Booked {booking.createdAt?.seconds
                                  ? new Date(booking.createdAt.seconds * 1000).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                              {(booking.guestName || "G").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 text-xs sm:text-sm">
                                {booking.guestName || "Guest"}
                              </p>
                              <p className="text-xs text-gray-500 truncate max-w-[100px] sm:max-w-[150px]">
                                {booking.guestEmail || ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                            </div>
                            <p className="text-xs sm:text-sm text-gray-800 font-medium">
                              {booking.checkIn
                                ? new Date(
                                    booking.checkIn.seconds
                                      ? booking.checkIn.seconds * 1000
                                      : booking.checkIn
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                            </div>
                            <p className="text-xs sm:text-sm text-gray-800 font-medium">
                              {booking.checkOut
                                ? new Date(
                                    booking.checkOut.seconds
                                      ? booking.checkOut.seconds * 1000
                                      : booking.checkOut
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center">
                              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                            </div>
                            <span className="text-xs sm:text-sm font-semibold text-gray-800">
                              {(booking.guests?.adults || 0) +
                                (booking.guests?.children || 0) +
                                (booking.guests?.infants || 0) +
                                (booking.guests?.pets || 0)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                          <div>
                            <p className="font-bold text-gray-800 text-sm sm:text-base">
                              ₱{(booking.finalPrice || booking.price || 0).toLocaleString()}.00
                            </p>
                            {booking.couponUsed && (
                              <p className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                                <Ticket className="w-3 h-3" />
                                Saved ₱{(booking.discount || 0).toLocaleString()}.00
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                          <span className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                            booking.status === "confirmed" || booking.status === "approved"
                              ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                              : booking.status === "pending"
                              ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900"
                              : booking.status === "rejected" || booking.status === "cancelled"
                              ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                              : "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                          }`}>
                            {booking.status === "confirmed" ? "Approved" : booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


      </main>
    </div>
  );
};

export default Dashboard;
