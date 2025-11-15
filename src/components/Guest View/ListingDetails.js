import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { doc, getDoc, getDocs, query, collection as fsCollection, where } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { createPortal } from "react-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import defaultProfile from "./images/default-profile.png";
import logo from "./homezy-logo.png";
import {
  BedDouble,
  Bath,
  Wifi,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Minus,
  Star,
  Home,
  Shield,
  Calendar,
  Compass,
  Package,
  Target,
  ShieldAlert,
  Briefcase,
  ClipboardList,
  User,
  Heart,
  LogOut,
  MessageCircle,
  Share2,
  Copy,
  Facebook,
  Twitter,
  Instagram,
  UserCircle,
  Bell,
  History
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DateRange } from "react-date-range";
import emailjs from "@emailjs/browser";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { enUS } from 'date-fns/locale';
// Email endpoint imports removed - not used in this component
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { collection, addDoc, serverTimestamp, updateDoc, doc as fsDoc, getDoc as fsGetDoc } from "firebase/firestore";
import { addPoints } from '../../utils/points';

const ListingDetails = () => {
  const { listingId } = useParams();
  const [listing, setListing] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);
  const DropdownPortal = ({ children }) => {
    return createPortal(
      children,
      document.body // render directly in body
    );
  };

  const [isShareOpen, setIsShareOpen] = useState(false);
  const shareUrl = window.location.href;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const { id } = useParams();

  // booking / date state
  const [selectedDate, setSelectedDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestCount, setGuestCount] = useState(1);

  const [reviews, setReviews] = useState([]);

  // user + dropdowns
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // refs (declared before effects)
  const dropdownButtonRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  // guest dropdown refs
  const guestButtonRef = useRef(null);
  const guestMenuRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  // lightbox + guest UI state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guests, setGuests] = useState({
    adults: 0,
    children: 0,
    infants: 0,
    pets: 0,
  });

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectingCheckIn, setSelectingCheckIn] = useState(true);
  const calendarRef = useRef(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // -----------------------
  // ALL hooks go here (unconditional)
  // -----------------------

  // fetch listing
  useEffect(() => {
    const fetchListing = async () => {
      try {
        const docRef = doc(db, "listings", listingId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // include the Firestore document id so listing.id exists later
          const listingData = { id: docSnap.id, ...docSnap.data() };
          setListing(listingData);
          setCurrentImage(0);
        } else {
          alert("Listing not found!");
          navigate("/homes");
        }
      } catch (err) {
        console.error("Error fetching listing:", err);
        alert("Failed to load listing.");
      }
    };

    fetchListing();

    // Refetch when user returns to page (e.g., after cancelling booking)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchListing();
      }
    };

    const handleFocus = () => {
      fetchListing();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [listingId, navigate]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        if (!listingId) return;

        const reviewsSnapshot = await getDocs(collection(db, "reviews"));
        const allReviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter only reviews for this listing
        const listingReviews = allReviews.filter(rev => rev.listingId === listingId);

        // Sort by newest first
        listingReviews.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);

        setReviews(listingReviews);
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
      }
    };

    fetchReviews();
  }, [listingId]);

  // ✅ Fix default icon issue
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
  });

  const resetBookingFields = () => {
    setCheckIn(null);
    setCheckOut(null);
    setGuests({
      adults: 0,
      children: 0,
      infants: 0,
      pets: 0,
    });
    setCouponCode("");
    setAppliedCoupon(null);
    setCouponError("");
  };


  const formatDateDisplay = () => {
    if (!checkIn && !checkOut) return "Add dates";
    if (checkIn && !checkOut) {
      return `${new Date(checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ?`;
    }
    if (checkIn && checkOut) {
      return `${new Date(checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return "Add dates";
  };

  const handleDateSelect = (selectedDate) => {
    if (selectingCheckIn) {
      setCheckIn(selectedDate);
      setCheckOut("");
      setSelectedDate(selectedDate);
      setSelectingCheckIn(false);
    } else {
      if (selectedDate < checkIn) {
        alert("Check-out date cannot be before check-in date.");
        return;
      }
      setCheckOut(selectedDate);
      setCalendarOpen(false);
      setSelectingCheckIn(true);
    }
  };

  // Coupon validation and application
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }
    if (!listing?.hostId && !listing?.ownerId) {
      setCouponError("Host information not available");
      return;
    }

    setCouponLoading(true);
    setCouponError("");

    try {
      const hostId = listing.hostId || listing.ownerId;
      const q = query(
        fsCollection(db, "coupons"),
        where("code", "==", couponCode.toUpperCase()),
        where("hostId", "==", hostId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setCouponError("Invalid coupon code");
        setCouponLoading(false);
        return;
      }

      const couponDoc = snapshot.docs[0];
      const coupon = { id: couponDoc.id, ...couponDoc.data() };

      // Validate status
      if (coupon.status !== "active") {
        setCouponError("This coupon is no longer active");
        setCouponLoading(false);
        return;
      }

      // Validate usage limits (single-use)
      if (typeof coupon.maxUses === 'number' && typeof coupon.usedCount === 'number') {
        if (coupon.usedCount >= coupon.maxUses) {
          setCouponError("This coupon has already been used");
          setCouponLoading(false);
          return;
        }
      }

      // Validate expiration
      if (coupon.expiresAt) {
        const expiry = coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : new Date(coupon.expiresAt);
        if (expiry < new Date()) {
          setCouponError("This coupon has expired");
          setCouponLoading(false);
          return;
        }
      }

      // Valid coupon!
      setAppliedCoupon(coupon);
      setCouponError("");
      setCouponLoading(false);
    } catch (error) {
      console.error("Coupon validation error:", error);
      setCouponError("Failed to validate coupon");
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  // Calculate final price with coupon
  const calculateFinalPrice = () => {
    if (!listing?.price) return 0;
    const basePrice = listing.price;

    if (!appliedCoupon) return basePrice;

    // enforce single-use pricing logic (if coupon somehow applied after usage)
    if (appliedCoupon.maxUses === 1 && appliedCoupon.usedCount >= 1) {
      return basePrice; // treat as no discount
    }

    if (appliedCoupon.discountType === "percentage") {
      const discount = (basePrice * appliedCoupon.discountValue) / 100;
      return Math.max(0, basePrice - discount);
    } else if (appliedCoupon.discountType === "fixed") {
      return Math.max(0, basePrice - appliedCoupon.discountValue);
    }

    return basePrice;
  };

  const getDiscountAmount = () => {
    if (!listing?.price || !appliedCoupon) return 0;
    return listing.price - calculateFinalPrice();
  };

  // auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // click-outside handler for both dropdowns
  // click-outside handler for both dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      // dropdown
      if (
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(e.target) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }
      // guest dropdown
      if (
        guestMenuRef.current &&
        !guestMenuRef.current.contains(e.target) &&
        guestButtonRef.current &&
        !guestButtonRef.current.contains(e.target)
      ) {
        setGuestOpen(false);
      }
      // calendar dropdown
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false);
        setSelectingCheckIn(true);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // keyboard navigation inside lightbox (must be unconditional)
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e) => {
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen]); // images.length isn't required here for the listener itself

  // -----------------------
  // End hooks
  // -----------------------

  // Now it's safe to conditionally render
  if (!listing)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <p className="text-center text-gray-500 text-lg font-medium">Loading listing…</p>
      </div>
    );

  const images = listing.images && listing.images.length ? listing.images : [listing.imageUrl || "https://via.placeholder.com/1200x800"];

  // image navigation helpers (defined after images)
  const prevImage = () => setCurrentImage((p) => (p === 0 ? images.length - 1 : p - 1));
  const nextImage = () => setCurrentImage((p) => (p === images.length - 1 ? 0 : p + 1));

  // guest increment/decrement helpers
  const changeGuest = (key, delta) => {
    setGuests((prev) => {
      const next = Math.max(0, (prev[key] || 0) + delta);
      if (key === "adults" && next < 1) return { ...prev, adults: 1 }; // at least 1 adult
      return { ...prev, [key]: next };
    });
  };

  // -----------------------
  // Render UI (keeps all your layout + new features)
  // -----------------------
  // Handler for Message Host button
  const handleMessageHost = () => {
    if (!user) {
      alert("Please log in to message the host.");
      navigate("/login");
      return;
    }
    // Pass hostId and hostName via navigation state for direct convo
    const hostId = listing?.hostId || listing?.ownerId;
    const hostName = listing?.hostName || "Host";
    if (hostId) {
      navigate("/guest-messages", { state: { hostId, hostName } });
    } else {
      alert("Host information not available.");
    }
  };

  return (
    <div className="font-sans bg-[#fafafa] min-h-screen">
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

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-6 py-10 sm:py-12 md:py-12">
        {/* Title */}
        <div className="max-w-4xl">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-[#0B2545] mb-2 sm:mb-3 leading-tight tracking-tight ml-2 sm:ml-0">
            {listing.title}
          </h1>

          {/* INFO BAR + SHARE BUTTON */}
          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-6 gap-y-1.5 text-gray-600 mb-4 sm:mb-8">
            {/* Host */}
            <p className="flex items-center gap-1.5 text-sm sm:text-base text-left ml-2 sm:ml-0">
              <UserCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              <span className="text-gray-700">
                Hosted by{" "}
                <span className="font-medium text-[#0B2545] ml-0.5 hover:text-orange-500 cursor-pointer transition-colors">
                  {listing.hostName}
                </span>
              </span>
              {/* Message Host Button */}
              <button
                onClick={handleMessageHost}
                className="ml-3 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full text-xs sm:text-sm font-semibold shadow hover:from-orange-600 hover:to-orange-700 transition-all duration-200"
                style={{ marginLeft: 12 }}
              >
                Message Host
              </button>
            </p>

            {/* Reviews */}
            <p className="flex items-center gap-1 before:content-['|'] before:mr-3 before:text-gray-300 text-sm sm:text-base">
              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400" />
              <span className="font-medium">
                {reviews.length > 0
                  ? (reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviews.length).toFixed(1)
                  : "—"}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500 hover:text-[#0B2545] cursor-pointer transition-colors">
                {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </span>
            </p>

            {/* SHARE BUTTON */}
            <span className="text-gray-400 hidden sm:inline">|</span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsShareOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1 sm:py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-full shadow-sm hover:shadow-md transition-all duration-300 text-xs sm:text-base ml-2 sm:ml-0"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Share
            </motion.button>
          </div>

          {/* SHARE MODAL */}
          <AnimatePresence>
            {isShareOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-3 sm:px-4"
              >
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="relative bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md p-5 sm:p-6 text-center"
                >
                  {/* Close */}
                  <button
                    onClick={() => setIsShareOpen(false)}
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  {/* Header */}
                  <div className="mb-3 sm:mb-4">
                    <h2 className="text-lg sm:text-2xl font-semibold text-[#0B2545]">
                      Share this listing
                    </h2>
                    <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
                      Spread the word — share with friends!
                    </p>
                  </div>

                  {/* Social Buttons */}
                  <div className="flex justify-center gap-3 sm:gap-5 mb-5 sm:mb-6">
                    <motion.a
                      whileHover={{ scale: 1.15 }}
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 sm:p-4 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      <Facebook className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.a>

                    <motion.a
                      whileHover={{ scale: 1.15 }}
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 sm:p-4 rounded-full bg-gradient-to-br from-sky-500 to-sky-400 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      <Twitter className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.a>

                    <motion.a
                      whileHover={{ scale: 1.15 }}
                      href="https://www.instagram.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 sm:p-4 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.a>
                  </div>

                  {/* Copy Link */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 sm:p-3 flex justify-between items-center shadow-inner text-xs sm:text-sm">
                    <span className="text-gray-600 truncate w-[130px] sm:w-[200px]">{shareUrl}</span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all text-xs sm:text-sm"
                    >
                      <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {copied ? "Copied!" : "Copy"}
                    </motion.button>
                  </div>

                  {copied && (
                    <motion.p
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="text-green-600 text-xs sm:text-sm mt-2"
                    >
                      Link copied to clipboard!
                    </motion.p>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* IMAGE GALLERY */}
        <div className="mt-6 sm:mt-8">
          <motion.div
            className="relative w-full h-64 sm:h-96 md:h-[520px] rounded-2xl overflow-hidden shadow-xl mb-4 group"
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <motion.img
              key={images[currentImage]}
              src={images[currentImage]}
              alt={listing.title}
              initial={{ opacity: 0.8, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full object-cover cursor-zoom-in transform transition-transform duration-700 group-hover:scale-105"
              onClick={() => setLightboxOpen(true)}
            />

            {/* Overlay gradients */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  aria-label="Previous photo"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2.5 sm:p-3.5 rounded-full text-gray-800 shadow-lg transform -translate-x-8 sm:-translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                  onClick={nextImage}
                  aria-label="Next photo"
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2.5 sm:p-3.5 rounded-full text-gray-800 shadow-lg transform translate-x-8 sm:translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </>
            )}

            {/* Image counter */}
            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 bg-black/60 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full text-white text-xs sm:text-sm font-medium">
              {currentImage + 1} / {images.length}
            </div>
          </motion.div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex justify-center items-center gap-2 sm:gap-3 overflow-x-auto pb-2">
              <div className="flex gap-2 sm:gap-3">
                {images.map((img, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => setCurrentImage(idx)}
                    className={`flex-shrink-0 rounded-xl overflow-hidden border-2 ${idx === currentImage
                      ? "border-orange-500 shadow-lg"
                      : "border-transparent hover:border-gray-300"
                      } focus:outline-none transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img
                      src={img}
                      alt={`thumb-${idx}`}
                      className={`w-20 sm:w-28 h-16 sm:h-20 object-cover transition-transform duration-500 ${idx === currentImage ? "scale-110" : "scale-100"
                        }`}
                    />
                  </motion.button>
                ))}
                <motion.button
                  onClick={() => setLightboxOpen(true)}
                  className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl border border-gray-200 bg-white/90 backdrop-blur-sm text-sm sm:text-base font-medium shadow-sm hover:shadow-md flex-shrink-0 transition-all duration-200 transform hover:-translate-y-0.5"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  View all photos
                </motion.button>
              </div>
            </div>
          )}
        </div>

        {/* LIGHTBOX */}
        <AnimatePresence>
          {lightboxOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-2 sm:px-6"
            >
              <div className="absolute inset-0" onClick={() => setLightboxOpen(false)} />
              <div className="relative w-full h-full max-w-6xl max-h-[90vh] mx-auto">
                <button
                  onClick={() => setLightboxOpen(false)}
                  className="absolute top-4 sm:top-6 right-4 sm:right-6 z-50 bg-black/40 hover:bg-black/60 text-white p-2.5 sm:p-3 rounded-full"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <div className="h-full flex items-center justify-center relative">
                  <button
                    onClick={prevImage}
                    className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 p-2.5 sm:p-4 rounded-full text-white z-50"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>

                  <motion.img
                    key={images[currentImage]}
                    src={images[currentImage]}
                    alt={`lightbox-${currentImage}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="max-h-[80vh] object-contain mx-auto"
                  />

                  <button
                    onClick={nextImage}
                    className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 p-2.5 sm:p-4 rounded-full text-white z-50"
                    aria-label="Next"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                {/* Lightbox thumbnails */}
                <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 flex justify-center gap-2 sm:gap-3 px-2 overflow-auto">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImage(idx)}
                      className={`rounded-md overflow-hidden border-2 ${idx === currentImage ? "border-white" : "border-transparent hover:border-gray-300"
                        } focus:outline-none`}
                    >
                      <img src={img} alt={`light-thumb-${idx}`} className="w-20 sm:w-24 h-12 sm:h-16 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DETAILS + BOOKING */}
        <div className="flex flex-col md:grid md:grid-cols-3 gap-6 sm:gap-10 mt-6 sm:mt-8">
          {/* LEFT COLUMN */}
          <div className="md:col-span-2 space-y-6 sm:space-y-10">
            {/* DESCRIPTION */}
            <section className="px-0 sm:px-0 py-4 sm:py-0">
              <h2 className="text-lg sm:text-2xl font-semibold mb-3 text-[#0B2545]">
                About this {listing.category}
              </h2>
              <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                {listing.description || "No description provided."}
              </p>
            </section>


            {/* CATEGORY DETAILS */}
            {listing.category === "home" && (
              <section className="space-y-4 px-4 sm:px-0">
                <h2 className="text-lg sm:text-2xl font-semibold text-[#0B2545]">Property Details</h2>

                {/* Property Type */}
                <p className="flex items-center gap-2 text-gray-700 text-sm sm:text-base">
                  <Home className="w-5 h-5 text-orange-500" />
                  <strong>Type:</strong> {listing.propertyType}
                </p>

                {/* Bedrooms, Beds, Bathrooms */}
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-6 text-gray-700 text-sm sm:text-base">
                  <span className="flex items-center gap-1 w-full sm:w-auto">
                    <BedDouble className="w-5 h-5 text-orange-500" /> {listing.bedrooms} Bedrooms
                  </span>
                  <span className="flex items-center gap-1 w-full sm:w-auto">
                    <Users className="w-5 h-5 text-orange-500" /> {listing.beds} Beds
                  </span>
                  <span className="flex items-center gap-1 w-full sm:w-auto">
                    <Bath className="w-5 h-5 text-orange-500" /> {listing.bathrooms} Bathrooms
                  </span>
                </div>

                {/* Guest Size */}
                <p className="flex items-center gap-2 text-gray-700 text-sm sm:text-base">
                  <Users className="w-5 h-5 text-orange-500" />
                  <strong>Guest Size Limit:</strong> {listing.guestSize}
                </p>

                {/* Amenities */}
                <p className="flex items-start gap-2 text-gray-700 text-sm sm:text-base">
                  <Wifi className="w-5 h-5 text-orange-500 mt-1" />
                  <span>
                    <strong>Amenities:</strong>{" "}
                    {Array.isArray(listing.amenities)
                      ? listing.amenities.join(", ")
                      : listing.amenities || "None"}
                  </span>
                </p>

                {/* House Rules */}
                <p className="flex items-start gap-2 text-gray-700 text-sm sm:text-base">
                  <Shield className="w-5 h-5 text-orange-500 mt-1" />
                  <span>
                    <strong>House Rules:</strong> {listing.houseRules}
                  </span>
                </p>

                {/* Calendar Availability */}
                <p className="flex items-start gap-2 text-gray-700 text-sm sm:text-base">
                  <Calendar className="w-5 h-5 text-orange-500 mt-1" />
                  <span>
                    <strong>Calendar Availability:</strong>{" "}
                    {listing.availabilityStart && listing.availabilityEnd
                      ? `${new Date(listing.availabilityStart).toLocaleDateString()} - ${new Date(listing.availabilityEnd).toLocaleDateString()}`
                      : "Dates not specified"}
                  </span>
                </p>
              </section>
            )}

            {/* CATEGORY DETAILS */}
            {listing.category === "experience" && (
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold text-[#0B2545]">Experience Details</h2>

                {/* Type / Duration / Group Size */}
                <p className="flex items-center gap-2 text-gray-700">
                  <Compass className="w-5 h-5 text-orange-500" />
                  <strong>Type:</strong> {listing.experienceType}
                </p>
                <p className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <strong>Duration:</strong> {listing.duration}
                </p>
                <p className="flex items-center gap-2 text-gray-700">
                  <Users className="w-5 h-5 text-orange-500" />
                  <strong>Guest Size Limit:</strong> {listing.guestSize}
                </p>
                <p className="flex items-center gap-2 text-gray-700">
                  <Package className="w-5 h-5 text-orange-500" />
                  <strong>What's Included:</strong> {listing.includes}
                </p>
                <p className="flex items-center gap-2 text-gray-700">
                  <Target className="w-5 h-5 text-orange-500" />
                  <strong>Skill Level / Age Range:</strong> {listing.skillLevel}
                </p>
                <p className="flex items-center gap-2 text-gray-700">
                  <ShieldAlert className="w-5 h-5 text-orange-500" />
                  <strong>Safety Notes:</strong> {listing.safetyNotes}
                </p>

                {/* Amenities */}
                <p className="flex items-center gap-2 text-gray-700 mt-4">
                  <Wifi className="w-5 h-5 text-orange-500" />
                  <strong>Amenities:</strong>{" "}
                  {Array.isArray(listing.amenities)
                    ? listing.amenities.join(", ")
                    : listing.amenities || "None"}
                </p>

                {/* Calendar Availability */}
                <p className="flex items-center gap-2 text-gray-700 mt-4">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  <strong>Calendar Availability:</strong>{" "}
                  {listing.availabilityStart && listing.availabilityEnd
                    ? `${new Date(listing.availabilityStart).toLocaleDateString()} - ${new Date(listing.availabilityEnd).toLocaleDateString()}`
                    : "Dates not specified"}
                </p>
              </section>
            )}


            {/* SERVICE DETAILS */}
            {listing.category === "service" && (
              <section className="space-y-3">
                <h2 className="text-2xl font-semibold text-[#0B2545]">Service Details</h2>

                {/* 🧰 Service Type */}
                <p className="flex items-center gap-2 text-gray-700">
                  <Briefcase className="w-5 h-5 text-orange-500" />
                  <strong>Type:</strong> {listing.serviceType}
                </p>

                {/* ⏱️ Duration */}
                <p className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <strong>Duration / Session:</strong> {listing.duration}
                </p>

                <p className="flex items-center gap-2 text-gray-700">
                  <Users className="w-5 h-5 text-orange-500" />
                  <strong>Guest Size Limit:</strong> {listing.guestSize}
                </p>

                {/* 🧾 Materials */}
                <p className="flex items-center gap-2 text-gray-700">
                  <ClipboardList className="w-5 h-5 text-orange-500" />
                  <strong>Materials / Requirements:</strong> {listing.materials}
                </p>

                {/* 🏡 Amenities */}
                <p className="flex items-center gap-2 text-gray-700 mt-4">
                  <Wifi className="w-5 h-5 text-orange-500" />
                  <strong>Amenities:</strong>{" "}
                  {Array.isArray(listing.amenities)
                    ? listing.amenities.join(", ")
                    : listing.amenities || "None"}
                </p>

                {/* 🗓️ Availability */}
                <p className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  <strong>Calendar Availability:</strong>{" "}
                  {listing.availabilityStart && listing.availabilityEnd
                    ? `${new Date(listing.availabilityStart).toLocaleDateString()} - ${new Date(listing.availabilityEnd).toLocaleDateString()}`
                    : "Dates not specified"}
                </p>
              </section>
            )}

            {/* 📍 Location Field */}
            <h2 className="text-lg sm:text-2xl font-semibold text-[#0B2545] mt-6 px-0 sm:px-0">
              Location
            </h2>


            {/* Location Info */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 px-4 sm:px-4 py-2 sm:py-3 rounded-xl border border-gray-200 shadow-sm mb-3 text-sm sm:text-base mx-1 sm:mx-0">
              <MapPin className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <span className="truncate">{listing.location || "Location not specified"}</span>
            </div>

            {/* Map */}
            <div className="w-full h-56 sm:h-80 border border-gray-300 rounded-lg overflow-hidden mx-1 sm:mx-0">
              <MapContainer
                center={listing.latLng || [14.6760, 121.0437]} // default: Quezon City
                zoom={13}
                scrollWheelZoom={false}
                className="w-full h-full"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
                />

                {/* 📍 Marker */}
                {listing.latLng && (
                  <Marker position={listing.latLng}>
                    <Popup>{listing.location || "Listing Location"}</Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>

            {/* REVIEWS SECTION */}
            <section className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3 sm:gap-0">
                <h2 className="text-lg sm:text-2xl font-semibold text-[#0B2545]">Guest Reviews</h2>
                <div className="flex items-center gap-2 text-sm sm:text-base">
                  <Star className="w-5 h-5 fill-current text-yellow-400" />
                  <span className="font-semibold text-[#0B2545]">
                    {reviews.length > 0
                      ? (reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviews.length).toFixed(1)
                      : "—"}
                  </span>
                  <span className="text-gray-500">
                    ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
                  </span>
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = reviews.filter((r) => r.rating === rating).length;
                    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={rating} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 w-3">{rating}</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-gray-500 w-8">{count}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 text-sm sm:text-base">
                  <h3 className="font-medium text-[#0B2545]">Rating Breakdown</h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-gray-50 p-2 sm:p-3 rounded-lg text-center">
                      <div className="text-lg sm:text-xl font-semibold text-[#0B2545]">
                        {reviews.filter((r) => r.rating >= 4).length}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">Excellent Reviews</div>
                    </div>
                    <div className="bg-gray-50 p-2 sm:p-3 rounded-lg text-center">
                      <div className="text-lg sm:text-xl font-semibold text-[#0B2545]">
                        {reviews.length > 0
                          ? Math.round((reviews.filter((r) => r.rating >= 4).length / reviews.length) * 100)
                          : 0}%
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">Satisfaction Rate</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reviews Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {reviews.length > 0 ? (
                  reviews.map((review, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 rounded-xl p-4 sm:p-5 border border-gray-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2 sm:mb-3 gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm sm:text-base">
                            {review.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-[#0B2545] text-sm sm:text-base">{review.name}</p>
                            <p className="text-xs sm:text-sm text-gray-500">
                              {review.timestamp
                                ? new Date(review.timestamp.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : "No date"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center bg-white px-2 py-1 rounded-lg border border-gray-100">
                          <Star className="w-4 h-4 text-yellow-400" />
                          <span className="ml-1 text-xs sm:text-sm font-medium text-[#0B2545]">{review.rating}</span>
                        </div>
                      </div>
                      <p className="text-gray-700 leading-relaxed text-sm sm:text-base">{review.comment}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center col-span-full text-sm sm:text-base">
                    No reviews yet. Be the first to leave a review!
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN - BOOKING */}
          <div className="bg-white border rounded-2xl shadow-xl p-4 sm:p-6 h-fit hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-baseline gap-1 mb-4 sm:mb-6">
              <p className="text-xl sm:text-2xl font-bold text-[#0B2545]">
                ₱{listing.price.toLocaleString()}.00
              </p>
              <span className="text-gray-500 text-sm sm:text-base">
                {listing.category === "home"
                  ? "/ night"
                  : listing.category === "experience"
                    ? "/ person"
                    : listing.category === "service"
                      ? "/ session"
                      : ""}
              </span>
            </div>

            {/* 📅 Check-in / Check-out (Single DateRange Picker) */}
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 text-center sm:text-left">
                Add Check-In and Check-Out Dates
              </label>

              <div className="flex justify-center">
                <div className="w-full max-w-lg sm:max-w-none sm:w-auto">
                  <DateRange
                    editableDateInputs={true}
                    moveRangeOnFirstSelection={false}
                    onChange={(item) => {
                      const start = item.selection.startDate;
                      const end = item.selection.endDate;
                      setCheckIn(start);
                      setCheckOut(end);
                    }}
                    ranges={[
                      {
                        startDate: checkIn || new Date(),
                        endDate: checkOut || new Date(),
                        key: "selection",
                      },
                    ]}
                    locale={enUS}
                    className="border border-gray-200 rounded-xl shadow-sm mx-auto w-full sm:w-auto"
                    direction="vertical" // vertical on small screens
                  />
                </div>
              </div>
            </div>

            {/* Guest selector */}
            <div className="relative mb-5">
              <button
                ref={guestButtonRef}
                onClick={() => setGuestOpen((v) => !v)}
                className="w-full text-left bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 flex justify-between items-center hover:border-gray-400 transition-colors duration-200"
              >
                <div>
                  <div className="text-xs sm:text-sm font-medium text-gray-700">Guests</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    {guests.adults + guests.children + guests.infants + guests.pets} guests
                  </div>
                </div>
                <div
                  className={`text-gray-400 transition-transform duration-200 ${guestOpen ? "rotate-180" : ""}`}
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-90" />
                </div>
              </button>

              {guestOpen && (
                <div
                  ref={guestMenuRef}
                  className="absolute left-0 mt-2 w-full bg-white border rounded-xl shadow-lg p-3 sm:p-4 z-[9999]"
                >
                  {[
                    { key: "adults", label: "Adults", note: "Ages 13+" },
                    { key: "children", label: "Children", note: "Ages 2–12" },
                    { key: "infants", label: "Infants", note: "Under 2" },
                    { key: "pets", label: "Pets", note: "Brings pets?" },
                  ].map(({ key, label, note }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-2 first:pt-0 last:pb-0 border-b last:border-0 border-gray-100"
                    >
                      <div>
                        <div className="font-medium text-gray-700 text-sm sm:text-base">{label}</div>
                        <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{note}</div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => changeGuest(key, -1)}
                          className={`p-1.5 sm:p-2 rounded-full border ${guests[key] === 0
                            ? "border-gray-200 text-gray-300 cursor-not-allowed"
                            : "border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                            } transition-all duration-200`}
                          disabled={guests[key] === 0}
                          aria-label={`Decrease ${label}`}
                        >
                          <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                        <div className="w-6 sm:w-8 text-center font-medium text-sm sm:text-base">{guests[key]}</div>
                        <button
                          onClick={() => changeGuest(key, 1)}
                          className="p-1.5 sm:p-2 rounded-full border border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
                          aria-label={`Increase ${label}`}
                        >
                          <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coupon Code Input */}
            <div className="mb-5">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Have a coupon code?
              </label>
              {!appliedCoupon ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={couponLoading}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    {couponLoading ? "..." : "Apply"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">{appliedCoupon.code}</p>
                      <p className="text-xs text-green-600">
                        {appliedCoupon.discountType === "percentage"
                          ? `${appliedCoupon.discountValue}% off`
                          : `₱${appliedCoupon.discountValue} off`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              )}
              {couponError && (
                <p className="text-xs text-red-500 mt-1">{couponError}</p>
              )}
            </div>

            {/* Price Summary */}
            {appliedCoupon && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Original Price:</span>
                  <span>₱{listing.price.toLocaleString()}.00</span>
                </div>
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Discount:</span>
                  <span>-₱{getDiscountAmount().toLocaleString()}.00</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-[#0B2545] border-t pt-2">
                  <span>Total:</span>
                  <span>₱{calculateFinalPrice().toLocaleString()}.00</span>
                </div>
              </div>
            )}

            {/* 🔹 PayPal Checkout Section */}
            <div className="relative z-10 mt-3 sm:mt-4">
              <PayPalScriptProvider
                options={{
                  "client-id": "AWUL2gT-UI3zhd5TNRY_gz-yxK-xvBlYMqnfG2ULdCNkgwtqAN4zWX0uuDYf1tWpEl0ymrAa6z9MXGi3",
                  currency: "PHP",
                }}
              >
                <PayPalButtons
                  style={{
                    layout: "vertical",
                    color: "gold",
                    shape: "rect",
                    label: "pay",
                  }}
                  onClick={(data, actions) => {
                    if (!auth.currentUser) {
                      alert("❌ Please log in first!");
                      navigate("/login");
                      return actions.reject();
                    }
                    return actions.resolve();
                  }}
                  createOrder={(data, actions) => {
                    const finalPrice = calculateFinalPrice();
                    return actions.order.create({
                      purchase_units: [
                        {
                          description: listing?.title || "Booking",
                          amount: {
                            value: finalPrice.toFixed(2),
                            currency_code: "PHP",
                          },
                        },
                      ],
                    });
                  }}

                  onApprove={async (data, actions) => {
                    try {
                      const details = await actions.order.capture();
                      console.log("✅ PayPal Payment Details:", details);

                      const safeCheckIn = checkIn
                        ? new Date(checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "Not specified";

                      const safeCheckOut = checkOut
                        ? new Date(checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "Not specified";

                      const totalGuests =
                        (guests?.adults || 0) +
                        (guests?.children || 0) +
                        (guests?.infants || 0) +
                        (guests?.pets || 0) || 1;

                      const finalPrice = calculateFinalPrice();
                      const discount = getDiscountAmount();
                      const hostId = listing?.hostId || listing?.ownerId || "";

                      // ✅ Add booking to Firestore as confirmed immediately
                      const bookingRef = await addDoc(collection(db, "bookings"), {
                        listingId: listing?.id || id || "unknown",
                        listingTitle: listing?.title || "Untitled Listing",
                        listingImage: listing?.imageUrl || listing?.images?.[0] || "",
                        location: listing?.location || "",
                        category: listing?.category || "",
                        hostId,
                        userId: auth.currentUser.uid,
                        guestName: auth.currentUser.displayName || "Guest",
                        guestEmail: auth.currentUser.email || "",
                        price: listing?.price || 0,
                        finalPrice: finalPrice,
                        discount: discount,
                        couponUsed: appliedCoupon ? {
                          code: appliedCoupon.code,
                          discountType: appliedCoupon.discountType,
                          discountValue: appliedCoupon.discountValue,
                          maxUses: appliedCoupon.maxUses ?? null,
                          usedCountAtBooking: appliedCoupon.usedCount ?? 0,
                        } : null,
                        checkIn: checkIn ? new Date(checkIn) : null,
                        checkOut: checkOut ? new Date(checkOut) : null,
                        guests: { ...guests, total: totalGuests },
                        paymentId: details.id,
                        paymentStatus:
                          details.status ||
                          details?.purchase_units?.[0]?.payments?.captures?.[0]?.status ||
                          "completed",
                        status: "pending", // ⏳ Awaiting host approval
                        createdAt: serverTimestamp(),
                      });

                      // ✅ Add a notification for the host
                      await addDoc(collection(db, "notifications"), {
                        hostId: hostId,
                        bookingId: bookingRef.id,
                        type: "pending-booking",
                        message: `New booking request from ${auth.currentUser.displayName || "Guest"} for ${listing?.title || "your listing"}`,
                        listingTitle: listing?.title || "Untitled Listing",
                        guestName: auth.currentUser.displayName || "Guest",
                        guestEmail: auth.currentUser.email || "",
                        checkIn: checkIn ? new Date(checkIn) : null,
                        checkOut: checkOut ? new Date(checkOut) : null,
                        guests: totalGuests,
                        finalPrice: finalPrice || 0,
                        read: false,
                        timestamp: serverTimestamp(),
                      });

                      // Reserve listing dates
                      if (listing?.id && checkIn && checkOut) {
                        try {
                          const datesToReserve = [];
                          const start = new Date(checkIn);
                          const end = new Date(checkOut);
                          let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());

                          while (cursor < end) {
                            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
                            datesToReserve.push(key);
                            cursor.setDate(cursor.getDate() + 1);
                          }

                          const listingRef = fsDoc(db, 'listings', listing.id);
                          const listingSnap = await fsGetDoc(listingRef);
                          if (listingSnap.exists()) {
                            const currentReserved = listingSnap.data().reservedDates || [];
                            const mergedReserved = [...new Set([...currentReserved, ...datesToReserve])];
                            await updateDoc(listingRef, { reservedDates: mergedReserved });
                          }
                        } catch (reserveErr) {
                          console.error('❌ Failed to reserve dates on listing:', reserveErr);
                        }
                      }

                      // Award points to host
                      if (hostId) {
                        try {
                          await addPoints(hostId, 100, 'booking', {
                            bookingId: bookingRef.id,
                            listingTitle: listing?.title || 'Booking',
                            amount: listing?.price || 0
                          });
                        } catch (pointsErr) {
                          console.error('❌ Failed to award points:', pointsErr);
                        }
                      }

                      // Increment coupon usage
                      if (appliedCoupon) {
                        try {
                          const couponRef = fsDoc(db, 'coupons', appliedCoupon.id);
                          const freshSnap = await fsGetDoc(couponRef);
                          if (freshSnap.exists()) {
                            const current = freshSnap.data();
                            const newUsedCount = (current.usedCount || 0) + 1;
                            const updates = { usedCount: newUsedCount };
                            if (typeof current.maxUses === 'number' && newUsedCount >= current.maxUses) {
                              updates.status = 'inactive';
                            }
                            await updateDoc(couponRef, updates);
                            await addDoc(collection(db, 'couponUsages'), {
                              couponId: appliedCoupon.id,
                              code: appliedCoupon.code,
                              bookingId: bookingRef.id,
                              userId: auth.currentUser.uid,
                              discountApplied: discount,
                              finalPrice,
                              createdAt: serverTimestamp(),
                            });
                          }
                        } catch (couponUseErr) {
                          console.error('❌ Failed to record coupon usage:', couponUseErr);
                        }
                      }
                      resetBookingFields();
                      setPaymentSuccess(true); // show green "Booking confirmed!" message
                      setShowSuccessModal(true); // show modal

                      // ✅ Send booking receipt AFTER confirmation is shown
                      // try {
                      //   const response = await fetch("http://localhost:4000/send-receipt", {
                      //     method: "POST",
                      //     headers: { "Content-Type": "application/json" },
                      //     body: JSON.stringify({
                      //       email: auth.currentUser.email,
                      //       fullName: auth.currentUser.displayName || "Guest",
                      //       listingTitle: listing?.title || "Booking",
                      //       checkIn: safeCheckIn,
                      //       checkOut: safeCheckOut,
                      //       guests: totalGuests,
                      //       price: finalPrice,
                      //     }),
                      //   });

                      //   const result = await response.json();
                      //   if (response.ok) {
                      //     console.log("✅ Booking receipt sent successfully!", result);
                      //   } else {
                      //     console.error("❌ Failed to send booking receipt:", result);
                      //   }

                      // } catch (emailErr) {
                      //   console.error("❌ Error sending booking receipt:", emailErr);
                      // }

                    } catch (error) {
                      console.error("❌ Payment/Booking Error:", error);
                      alert("❌ Payment processed but failed to save booking or send receipt. Contact support.");
                    }
                  }}

                  onError={(err) => {
                    console.error("PayPal Error:", err);
                    alert("❌ Payment failed. Please try again.");
                  }}
                />

                {showSuccessModal && (
                  <div className="w-full flex justify-center mt-8">
                    <div className="bg-green-50 border border-green-300 rounded-xl px-6 py-4 flex flex-col items-center shadow-md max-w-lg w-full">
                      <div className="flex items-center mb-2">
                        <svg className="w-8 h-8 text-green-500 mr-2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="#22c55e" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12l2.5 2.5L16 9" stroke="#fff" />
                        </svg>
                        <span className="text-xl font-bold text-green-600">Success!</span>
                      </div>
                      <p className="text-base text-gray-700 font-medium mb-1">Booking awaiting <span className="text-green-600 font-bold">host approval</span>.</p>
                      <div className="text-xs text-gray-500">You’ll get an email once your host responds.</div>
                    </div>
                  </div>
                )}
              </PayPalScriptProvider><br></br>
            </div>

            <div className="mt-3 flex items-start gap-2 text-gray-600 text-[13px] sm:text-base">
              <CheckCircle className="w-5 h-5 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <p className="font-medium text-[13px] sm:text-base">
                  Secure checkout — no extra fees
                </p>
                <p className="text-gray-500 text-[13px] sm:text-base">
                  Your payment is protected by our secure payment system
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

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

        <div className="border-t border-gray-700 mt-10 pt-5 text-center text-sm text-gray-500">
          © 2025 Homezy | All Rights Reserved
        </div>
      </footer>
    </div>
  );
};

export default ListingDetails;
