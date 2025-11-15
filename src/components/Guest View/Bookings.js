import { useState, useEffect, useRef } from "react";
import logo from "./homezy-logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getEmailEndpoint } from '../../utils/api';
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import defaultProfile from "./images/default-profile.png";
import { User, Calendar, Heart, LogOut, MessageCircle, Users, CreditCard, XCircle, Star, Bell, History } from "lucide-react";

const Bookings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const DropdownPortal = ({ children }) => {
    return createPortal(
      children,
      document.body // render directly in body
    );
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Navbar dropdown refs
  const dropdownButtonRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  // Guest dropdown ref
  const guestRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);
  const [wishlist, setWishlist] = useState([]);
  const [quezonCityListings, setQuezonCityListings] = useState([]);
  const [metroManilaListings, setMetroManilaListings] = useState([]);
  const [searchLocation, setSearchLocation] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState({
    adults: 0,
    children: 0,
    infants: 0,
    pets: 0,
  });
  const [filteredListings, setFilteredListings] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelBookingId, setCancelBookingId] = useState(null);
  const [pendingCancellations, setPendingCancellations] = useState(new Set());
  const [reviews, setReviews] = useState([]);
  const [leaveReviewBookingId, setLeaveReviewBookingId] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [deleteReviewId, setDeleteReviewId] = useState(null);

  // Search handler
  const handleSearch = () => {
    if (!searchLocation) {
      alert("Please select a location before searching.");
      return;
    }
    if (checkIn && checkOut && checkOut < checkIn) {
      alert("Check-out date cannot be before check-in date.");
      return;
    }
    setIsSearching(true);
    const allListings = [...quezonCityListings, ...metroManilaListings];
    const filtered = allListings.filter(
      (item) => item.location === searchLocation
    );
    setFilteredListings(filtered);
    setGuestOpen(false);
  };

  const handleClearSearch = () => {
    setSearchLocation("");
    setCheckIn("");
    setCheckOut("");
    setGuests({ adults: 0, children: 0, infants: 0, pets: 0 });
    setIsSearching(false);
  };

  // Track user login + fetch wishlist
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(
          collection(db, "wishlists"),
          where("userId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const fetched = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setWishlist(fetched);
      } else {
        setWishlist([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch listings
  useEffect(() => {
    const fetchListings = async () => {
      const q = query(
        collection(db, "listings"),
        where("status", "==", "published"),
        where("category", "==", "home"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const allListings = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setQuezonCityListings(
        allListings.filter((item) => item.location === "Quezon City")
      );
      setMetroManilaListings(
        allListings.filter((item) => item.location === "Metro Manila")
      );
    };
    fetchListings();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchBookings = async () => {
      try {
        const q = query(
          collection(db, "bookings"),
          where("userId", "==", user.uid),
          where("status", "in", ["confirmed", "approved", "accepted"]) // ✅ Only show confirmed/approved/accepted
        );
        const querySnapshot = await getDocs(q);
        const fetchedBookings = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("Fetched bookings:", fetchedBookings);
        setBookings(fetchedBookings);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching bookings:", err);
        setLoading(false);
      }
    };
    fetchBookings();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchReviews = async () => {
      try {
        const q = query(collection(db, "reviews"), where("guestId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const userReviews = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReviews(userReviews);
      } catch (err) {
        console.error("Error fetching reviews:", err);
      }
    };

    fetchReviews();
  }, [user]);


  // Wishlist handler
  const handleWishlist = async (item) => {
    if (!user) {
      alert("Please log in to add to favorites!");
      navigate("/login");
      return;
    }
    const existing = wishlist.find((fav) => fav.name === item.title);
    if (existing) {
      await deleteDoc(doc(db, "wishlists", existing.id));
      setWishlist(wishlist.filter((fav) => fav.id !== existing.id));
      alert("Removed from favorites 💔");
    } else {
      const docRef = await addDoc(collection(db, "wishlists"), {
        userId: user.uid,
        name: item.title,
        desc: item.description,
        price: `₱${item.price.toLocaleString()} / night`,
        image: item.imageUrl,
        rating: item.rating || "4.5",
      });
      setWishlist([...wishlist, { id: docRef.id, ...item }]);
      alert("Added to favorites ❤️");
    }
  };

  const isFavorited = (item) =>
    wishlist.some((fav) => fav.name === item.title);

  const renderCard = (item) => (
    <Link to={`/listing/${item.id}`}>
      <div className="bg-white rounded-2xl shadow-lg hover:-translate-y-1 transition-transform duration-300 text-left w-72 relative">
        {/* Wishlist button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            handleWishlist(item);
          }}
          className="absolute top-3 right-3 text-2xl z-[9999] pointer-events-auto"
        >
          {isFavorited(item) ? "🧡" : "🤍"}
        </button>
        {/* Image */}
        <div className="w-full h-44 rounded-t-2xl overflow-hidden">
          <img
            src={item.images ? item.images[0] : item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>
        {/* Info */}
        <div className="p-5">
          <h3 className="font-bold text-gray-800 text-lg mb-1">{item.title}</h3>
          <p className="text-sm text-gray-500 mb-3 leading-relaxed">{item.description}</p>
          <div className="flex justify-between items-center">
            <p className="flex items-center text-yellow-400 font-semibold text-sm">
              ⭐ <span className="text-gray-700 ml-1">{item.rating || "4.6"}</span>
            </p>
            <p className="font-bold text-gray-800">₱{item.price.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (guestRef.current && !guestRef.current.contains(e.target)) {
        setGuestOpen(false);
      }
      if (
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(e.target) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="font-sans bg-[#fefefe] min-h-screen flex flex-col">
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

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0B2545] mb-4">
            Your Bookings
          </h1>
          <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
            View and manage all your upcoming stays, past trips, and current reservations.
          </p>
          <div className="w-20 sm:w-24 h-1 bg-gradient-to-r from-orange-500 to-orange-400 mx-auto mt-6 sm:mt-8 rounded-full"></div>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-16 text-lg">Loading your bookings...</p>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 px-4 sm:px-0">
            <div className="mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-700 mb-3">No bookings yet</h3>
            <p className="text-gray-500 mb-8 text-lg">
              Ready to start your next adventure? Browse our selection of homes and experiences.
            </p>
            <Link
              to="/homes"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white font-semibold rounded-xl shadow-md transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Start Exploring
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden w-full group"
                >
                  {/* Thumbnail with enhanced overlay */}
                  <Link to={`/listing/${booking.listingId}`}>
                    <div className="relative h-64 w-full overflow-hidden">
                      <img
                        src={booking.listingImage || "/default-listing.png"}
                        alt={booking.listingTitle}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>

                      {/* Status Badge */}
                      <span
                        className={`absolute top-3 right-3 px-3 py-1.5 text-xs font-bold rounded-full backdrop-blur-sm border shadow-lg ${booking.paymentStatus.toLowerCase() === "completed"
                          ? "bg-green-500/90 text-white border-green-300"
                          : booking.paymentStatus.toLowerCase() === "pending"
                            ? "bg-yellow-500/90 text-white border-yellow-300"
                            : "bg-red-500/90 text-white border-red-300"
                          }`}
                      >
                        {booking.paymentStatus}
                      </span>
                    </div>
                  </Link>

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
                          {booking.guests.adults +
                            booking.guests.children +
                            booking.guests.infants +
                            booking.guests.pets}
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
                              Saved ₱{booking.discount.toLocaleString()} with {booking.couponUsed.code}
                            </p>
                          </>
                        ) : (
                          <p className="font-bold text-gray-800 text-2xl">
                            ₱{booking.price.toLocaleString()}.00
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 mt-2">
                      {(() => {
                        const existingReview = reviews.find(r => r.listingId === booking.listingId && r.guestId === user?.uid);

                        if (existingReview) {
                          // 🔴 If review exists, show Delete button
                          return (
                            <button
                              onClick={() => setDeleteReviewId({ reviewId: existingReview.id, bookingId: booking.id })}
                              className="w-auto px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
                            >
                              <XCircle className="w-5 h-5" />
                              Delete Review
                            </button>

                          );
                        } else {
                          // 🟡 If no review exists, show Leave a Review button
                          return (
                            <button
                              onClick={() => setLeaveReviewBookingId(booking.id)}
                              className="w-auto px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap"
                            >
                              <Star className="w-4 h-4" />
                              Leave a Review
                            </button>
                          );
                        }
                      })()}

                      {booking.paymentStatus.toLowerCase() === "completed" && (
                        <>
                          {booking.cancellationStatus === 'pending' ? (
                            <div className="px-4 py-2.5 bg-yellow-100 border border-yellow-400 text-yellow-800 text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                              <span className="animate-pulse">⏳</span>
                              Awaiting Host Approval
                            </div>
                          ) : booking.cancellationStatus === 'rejected' ? (
                            <button
                              onClick={() => setCancelBookingId(booking.id)}
                              className="w-auto px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
                            >
                              <XCircle className="w-5 h-5" />
                              Request Cancellation Again
                            </button>
                          ) : (
                            <button
                              onClick={() => setCancelBookingId(booking.id)}
                              className="w-auto px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
                            >
                              <XCircle className="w-5 h-5" />
                              Cancel Booking
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cancel Confirmation Modal */}
            {cancelBookingId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center transform animate-in zoom-in duration-200">
                  {/* Warning Icon */}
                  <div className="mb-6 flex justify-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-gray-800 mb-3">Cancel This Booking?</h2>
                  <p className="text-gray-600 mb-8 leading-relaxed">
                    Are you absolutely sure you want to cancel this booking? <br />
                    <span className="text-red-500 font-semibold">This action cannot be undone.</span>
                  </p>

                  <div className="flex gap-4">
                    {/* NO button */}
                    <button
                      onClick={() => setCancelBookingId(null)}
                      className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Keep Booking
                    </button>

                    {/* YES button */}
                    <button
                      onClick={async () => {
                        try {
                          const cancelledBooking = bookings.find((b) => b.id === cancelBookingId);
                          if (!cancelledBooking) throw new Error("Booking not found");

                          // If host has approved cancellation, remove booking immediately (no guest action needed)
                          if (cancelledBooking.cancellationStatus === 'approved') {
                            // Remove from UI only
                            setBookings(bookings.filter((b) => b.id !== cancelBookingId));
                            setCancelBookingId(null);
                            alert("✅ Host approved cancellation. Your booking has been removed.");
                            return;
                          } else {
                            // Send cancellation request to host
                            await updateDoc(doc(db, "bookings", cancelBookingId), {
                              cancellationRequested: true,
                              cancellationStatus: 'pending',
                              cancellationRequestedAt: serverTimestamp()
                            });

                            // Calculate total guests
                            const totalGuests = cancelledBooking.guests
                              ? (cancelledBooking.guests.adults || 0) +
                              (cancelledBooking.guests.children || 0) +
                              (cancelledBooking.guests.infants || 0) +
                              (cancelledBooking.guests.pets || 0)
                              : 1;

                            // Create notification for host
                            const hostNotifData = {
                              hostId: cancelledBooking.hostId,
                              type: "cancellation_request",
                              title: "Cancellation Request",
                              message: `${cancelledBooking.guestName} has requested to cancel their booking for "${cancelledBooking.listingTitle}".`,
                              guestName: cancelledBooking.guestName,
                              guestEmail: cancelledBooking.guestEmail,
                              listingTitle: cancelledBooking.listingTitle,
                              bookingId: cancelBookingId,
                              checkIn: cancelledBooking.checkIn,
                              checkOut: cancelledBooking.checkOut,
                              guests: totalGuests,
                              finalPrice: cancelledBooking.price || cancelledBooking.finalPrice || 0,
                              read: false,
                              processed: false,
                              timestamp: serverTimestamp(),
                            };
                            await addDoc(collection(db, "notifications"), hostNotifData);

                            // Update local state
                            setPendingCancellations(prev => new Set([...prev, cancelBookingId]));
                            setCancelBookingId(null);
                            alert("✅ Cancellation request sent! Awaiting host approval.");
                          }
                        } catch (err) {
                          console.error("❌ Failed to process cancellation:", err);
                          alert("❌ Failed to process cancellation. Try again later.");
                        }
                      }}
                      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Yes, Cancel It
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Review Confirmation Modal */}
            {deleteReviewId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center transform animate-in zoom-in duration-200">
                  {/* Warning Icon */}
                  <div className="mb-6 flex justify-center">
                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                      <XCircle className="w-10 h-10 text-teal-600" />
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-gray-800 mb-3">Delete Your Review?</h2>
                  <p className="text-gray-600 mb-8 leading-relaxed">
                    Are you sure you want to delete this review? <br />
                    <span className="text-teal-600 font-semibold">This action cannot be undone.</span>
                  </p>

                  <div className="flex gap-4">
                    {/* Cancel button */}
                    <button
                      onClick={() => setDeleteReviewId(null)}
                      className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Keep Review
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={async () => {
                        try {
                          const booking = bookings.find(b => b.id === deleteReviewId.bookingId);
                          if (!booking) throw new Error("Booking not found");

                          // Fetch listing to get hostId before deleting review
                          const listingDoc = await getDoc(doc(db, "listings", booking.listingId));
                          const listingData = listingDoc.exists() ? listingDoc.data() : {};
                          const hostId = listingData.hostId;

                          await deleteDoc(doc(db, "reviews", deleteReviewId.reviewId));
                          setReviews(reviews.filter(r => r.id !== deleteReviewId.reviewId));

                          // ✅ Deduct points from host when review is deleted
                          if (hostId) {
                            try {
                              const { addPoints } = await import('../../utils/points');
                              const pointsDeducted = -50; // Deduct 50 points
                              await addPoints(hostId, pointsDeducted, 'review_deleted', {
                                listingId: booking.listingId,
                                listingName: listingData.title || "Unknown Listing",
                                guestId: user.uid,
                              });
                              console.log(`✅ Deducted 50 points from host ${hostId} for review deletion`);
                            } catch (pointsError) {
                              console.error("Failed to deduct points from host:", pointsError);
                              // Don't fail the review deletion if points fail
                            }
                          }

                          setDeleteReviewId(null);
                          alert("✅ Review Deleted Successfully!");
                        } catch (err) {
                          console.error("Error deleting review:", err);
                          alert("❌ Failed to delete review.");
                          setDeleteReviewId(null);
                        }
                      }}
                      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold hover:from-teal-600 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Yes, Delete It
                    </button>
                  </div>
                </div>
              </div>
            )}

            {leaveReviewBookingId && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center shadow-2xl animate-in zoom-in duration-200">
                  <h3 className="text-2xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-2">
                    <div className="w-6 h-6 text-yellow-400" /> Leave a Review
                  </h3>
                  <p className="text-gray-600 mb-4">Share your experience about this stay.</p>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-8 h-8 cursor-pointer ${star <= reviewRating ? "text-yellow-400" : "text-gray-300"}`}
                        onClick={() => setReviewRating(star)}
                      />
                    ))}
                  </div>

                  {/* Review Textarea */}
                  <textarea
                    className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    rows={4}
                    placeholder="Write your review..."
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={() => setLeaveReviewBookingId(null)}
                      className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          if (!reviewText.trim()) {
                            alert("Please write a review before submitting.");
                            return;
                          }

                          // Get guest info
                          const userDoc = await getDoc(doc(db, "guests", user.uid));
                          const guestData = userDoc.exists() ? userDoc.data() : {};
                          const guestName = guestData.fullName || "Guest";
                          const guestEmail = guestData.email || "";

                          // Get booking info
                          const booking = bookings.find(b => b.id === leaveReviewBookingId);
                          if (!booking) throw new Error("Booking not found");

                          // ✅ Fetch listing info to get the name/title and hostId
                          const listingDoc = await getDoc(doc(db, "listings", booking.listingId));
                          const listingData = listingDoc.exists() ? listingDoc.data() : {};
                          const listingName = listingData.title || "Unknown Listing";
                          const hostId = listingData.hostId;

                          // Add review to Firestore
                          await addDoc(collection(db, "reviews"), {
                            listingId: booking.listingId,
                            listingName, // ✅ added listing name
                            guestId: user.uid,
                            name: guestName,
                            email: guestEmail,
                            rating: reviewRating,
                            comment: reviewText,
                            timestamp: serverTimestamp(), // proper timestamp for sorting
                          });

                          // ✅ Award points to the host for receiving a review
                          if (hostId) {
                            try {
                              const { addPoints } = await import('../../utils/points');
                              const pointsAwarded = 50; // 50 points per review
                              await addPoints(hostId, pointsAwarded, 'review_received', {
                                listingId: booking.listingId,
                                listingName,
                                guestId: user.uid,
                                guestName,
                                rating: reviewRating,
                              });
                              console.log(`✅ Awarded ${pointsAwarded} points to host ${hostId} for receiving a review`);
                            } catch (pointsError) {
                              console.error("Failed to award points to host:", pointsError);
                              // Don't fail the review submission if points fail
                            }
                          }

                          alert("✅ Review Submitted Successfully!");

                          // Reset state
                          setReviewText("");
                          setReviewRating(5);
                          setLeaveReviewBookingId(null);

                          // Update local reviews UI
                          setReviews([
                            ...reviews,
                            {
                              id: "temp-" + Date.now(),
                              listingId: booking.listingId,
                              listingName, // ✅ added listing name here too
                              guestId: user.uid,
                              rating: reviewRating,
                              comment: reviewText,
                              name: guestName,
                              email: guestEmail,
                              timestamp: new Date(),
                            },
                          ]);

                        } catch (err) {
                          console.error("Failed to submit review:", err);
                          alert("❌ Failed to submit review.");
                        }
                      }}
                      className="flex-1 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-white font-semibold rounded-xl transition-all duration-200 whitespace-nowrap"
                    >
                      Submit Review
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main><br></br>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-300 py-14 px-8 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src={logo} alt="Homezy" className="w-8 h-8" />
              <h1 className="text-white text-lg font-bold">Homezy</h1>
            </div>
            <p className="text-sm mb-4 leading-relaxed">
              Helping travelers feel at home, anywhere.
            </p>

            <div className="flex gap-3">
              {/* facebook */}
              <a href="https://www.facebook.com/paoloperalta246" target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-full flex items-center justify-center transition">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-white">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 
                  6.48 2 12c0 4.99 3.66 9.12 8.44 
                  9.88v-6.99H8.9v-2.89h1.54V9.8c0-1.52.9-2.36 
                  2.28-2.36.66 0 1.35.12 1.35.12v1.48h-.76c-.75 
                  0-.98.47-.98.95v1.14h1.67l-.27 2.89h-1.4v6.99C18.34 
                  21.12 22 16.99 22 12z" />
                </svg>
              </a>

              {/* instagram */}
              <a href="https://www.instagram.com/onlysuhi_/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-full flex items-center justify-center transition">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-white">
                  <path d="M7.5 2C4.47 2 2 4.47 2 
                  7.5v9C2 19.53 4.47 22 7.5 22h9c3.03 
                  0 5.5-2.47 5.5-5.5v-9C22 4.47 19.53 
                  2 16.5 2h-9zM12 8.5A3.5 3.5 0 1 1 8.5 
                  12 3.5 3.5 0 0 1 12 8.5zm5.25-.75a.75.75 
                  0 1 1-.75-.75.75.75 0 0 1 .75.75zM12 
                  10a2 2 0 1 0 2 2 2 2 0 0 0-2-2z" />
                </svg>
              </a>

              {/* twitter */}
              <a href="https://twitter.com/onlysuhi_" target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-full flex items-center justify-center transition">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-white">
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

          {/* Company */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>About Us</li>
              <li>Careers</li>
              <li>Blog</li>
              <li>Pricing</li>
            </ul>
          </div>

          {/* Destinations */}
          <div>
            <h3 className="text-white font-semibold mb-4">Destinations</h3>
            <ul className="space-y-2 text-sm">
              <li>Maldives</li>
              <li>Los Angeles</li>
              <li>Las Vegas</li>
              <li>Toronto</li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-white font-semibold mb-4">Join Our Newsletter</h3>
            <div className="flex">
              <input type="email" placeholder="Your email address" className="px-3 py-2 w-full rounded-l-md text-gray-700 focus:outline-none" />
              <button className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-r-md text-white font-semibold">Subscribe</button>
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

export default Bookings;
