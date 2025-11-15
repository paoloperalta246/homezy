import React, { useState, useEffect, useRef } from "react";
import logo from "./homezy-logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  doc,
  orderBy,
} from "firebase/firestore";
import defaultProfile from "./images/default-profile.png";
import { User, Calendar, Heart, LogOut, MessageCircle, Bell, History, Star } from "lucide-react";

const TransactionHistory = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Navbar dropdown refs
  const dropdownButtonRef = useRef(null);
  const dropdownMenuRef = useRef(null);

  // Guest dropdown ref
  const guestRef = useRef(null);

  // Date dropdown ref
  const dateRef = useRef(null);

  // Location dropdown ref
  const locationRef = useRef(null);

  const [reviews, setReviews] = useState([]);

  const [locations, setLocations] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [wishlist, setWishlist] = useState([]);

  const [allListings, setAllListings] = useState([]);
  const [userBookings, setUserBookings] = useState([]);
  const [suggestedListings, setSuggestedListings] = useState([]);

  const [searchLocation, setSearchLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState(""); // only one date
  const [guests, setGuests] = useState({
    adults: 0,
    children: 0,
    infants: 0,
    pets: 0,
  });
  const [filteredListings, setFilteredListings] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Helper for date formatting
  function formatDateField(field) {
    if (!field) return "-";
    if (field.seconds) return new Date(field.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return new Date(field).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const DropdownPortal = ({ children }) => {
    return createPortal(
      children,
      document.body // render directly in body
    );
  };

  // Format date display
  const formatDateDisplay = () => {
    if (!selectedDate) return "Add date ▼";
    return `${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ▼`;
  };

  // Handle single date selection
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setDateOpen(false);
  };

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Fetch only home listings
        const q = query(
          collection(db, "listings"),
          where("category", "==", "home")
        );
        const querySnapshot = await getDocs(q);

        // Extract unique locations from home category only
        const locs = Array.from(
          new Set(querySnapshot.docs.map((doc) => doc.data().location).filter(Boolean))
        );

        setLocations(locs); // update state
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    };

    fetchLocations();
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "reviews"));
        const fetchedReviews = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReviews(fetchedReviews);
      } catch (err) {
        console.error("Error fetching reviews:", err);
      }
    };

    fetchReviews();
  }, []);


  const getSearchHeader = () => {
    const parts = [];

    // Date
    if (selectedDate) {
      const formattedDate = new Date(selectedDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      parts.push(`on ${formattedDate}`);
    }

    // Location
    if (searchLocation) {
      parts.push(`in ${searchLocation}`);
    }

    // Guests
    const totalGuests =
      guests.adults + guests.children + guests.infants + guests.pets;
    if (totalGuests > 0) {
      parts.push(`for ${totalGuests} guest${totalGuests !== 1 ? "s" : ""}`);
    }

    if (parts.length === 0) return "All Available Apartments";

    return `Available Apartments ${parts.join(" ")}`;
  };


  // Search handler
  const handleSearch = () => {
    setIsSearching(true);

    const filtered = allListings.filter((item) => {
      // ✅ Location filter (optional now)
      let locationMatch = true;
      if (searchLocation) {
        locationMatch = item.location
          ?.toLowerCase()
          .includes(searchLocation.toLowerCase());
      }

      // ✅ Date filter
      let dateMatch = true;
      if (selectedDate) {
        const start = new Date(item.availabilityStart);
        const end = new Date(item.availabilityEnd);
        const selected = new Date(selectedDate);

        // Check if selected date is within the listing’s available range
        dateMatch = selected >= start && selected <= end;
      }

      // ✅ Guest filter
      let guestMatch = true;
      const totalGuests =
        guests.adults + guests.children + guests.infants + guests.pets;
      if (totalGuests > 0) {
        const maxGuests = parseInt(item.guestSize, 10) || 0;
        guestMatch = totalGuests <= maxGuests;
      }

      return locationMatch && dateMatch && guestMatch;
    });

    setFilteredListings(filtered);
    setGuestOpen(false);
  };


  const handleClearSearch = () => {
    setSearchLocation("");
    setSelectedDate("");
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
      const listings = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllListings(listings); // store everything in one array
    };
    fetchListings();
  }, []);

  // Fetch user's bookings and generate suggestions
  useEffect(() => {
    const fetchUserBookings = async () => {
      if (!user) {
        setUserBookings([]);
        setSuggestedListings([]);
        return;
      }

      try {
        const q = query(
          collection(db, "bookings"),
          where("userId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const bookings = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUserBookings(bookings);

        // Only show suggestions if user has active bookings
        if (bookings.length === 0) {
          setSuggestedListings([]);
          return;
        }

        // Generate suggestions based on bookings
        if (allListings.length > 0) {
          const bookedListingIds = bookings.map(b => b.listingId);

          // Extract locations from bookings (with fallback to empty array)
          const bookedLocations = [...new Set(
            bookings
              .map(b => b.location)
              .filter(loc => loc && loc.trim() !== "")
          )];

          // Extract prices (prefer finalPrice, fallback to price)
          const bookedPrices = bookings
            .map(b => b.finalPrice || b.price || 0)
            .filter(price => price > 0);

          // Calculate average price only if we have valid prices
          const avgPrice = bookedPrices.length > 0
            ? bookedPrices.reduce((a, b) => a + b, 0) / bookedPrices.length
            : 0;

          // Number of suggestions = number of bookings (1 booking = 1 suggestion, etc.)
          const suggestionsCount = bookings.length;

          // Filter suggestions based on user history
          let suggestions = allListings.filter(listing => {
            // Don't suggest already booked listings
            if (bookedListingIds.includes(listing.id)) return false;

            // Check location match
            const locationMatch = bookedLocations.length > 0 && bookedLocations.some(loc =>
              listing.location?.toLowerCase().includes(loc?.toLowerCase())
            );

            // Check price match (±30% range) - only if we have average price
            const priceMatch = avgPrice > 0 &&
              listing.price >= avgPrice * 0.7 &&
              listing.price <= avgPrice * 1.3;

            // Return true if either location or price matches
            if (bookedLocations.length > 0 && avgPrice > 0) {
              return locationMatch || priceMatch;
            } else if (bookedLocations.length > 0) {
              return locationMatch;
            } else if (avgPrice > 0) {
              return priceMatch;
            }

            // If no filtering criteria, include this listing
            return true;
          });

          // If not enough personalized suggestions, add random ones to fill the gap
          if (suggestions.length < suggestionsCount) {
            const availableListings = allListings.filter(listing =>
              !bookedListingIds.includes(listing.id) &&
              !suggestions.find(s => s.id === listing.id)
            );

            const randomSuggestions = availableListings
              .sort(() => Math.random() - 0.5)
              .slice(0, suggestionsCount - suggestions.length);

            suggestions = [...suggestions, ...randomSuggestions];
          }

          // Limit to exact number of bookings
          suggestions = suggestions.slice(0, suggestionsCount);

          setSuggestedListings(suggestions);
        } else {
          setSuggestedListings([]);
        }
      } catch (error) {
        console.error("Error fetching user bookings:", error);
        setSuggestedListings([]);
      }
    };

    fetchUserBookings();
  }, [user, allListings]);


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
    } else {
      const docRef = await addDoc(collection(db, "wishlists"), {
        userId: user.uid,
        name: item.title,
        desc: item.description,
        price: `₱${item.price.toLocaleString()} / night`,
        image: item.imageUrl || (item.images && item.images[0]) || "",
        rating: item.rating || "4.5",
      });
      setWishlist((prev) => [...prev, { id: docRef.id, name: item.title }]);
    }
  };

  const isFavorited = (item) =>
    wishlist.some((fav) => fav.name === item.title);

  const renderCard = (item) => (
    <Link to={`/listing/${item.id}`}>
      <div className="bg-white rounded-2xl shadow-lg hover:-translate-y-1 transition-transform duration-300 text-left w-full max-w-xs sm:w-72 relative">
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
            {/* Dynamic Rating */}
            {(() => {
              const listingReviews = reviews.filter(r => r.listingId === item.id);
              const avgRating =
                listingReviews.length > 0
                  ? (listingReviews.reduce((sum, r) => sum + r.rating, 0) / listingReviews.length).toFixed(1)
                  : item.rating || "No reviews"; // fallback to static rating if no reviews
              return (
                <p className="flex items-center text-yellow-400 font-semibold text-sm">
                  ⭐ <span className="text-gray-700 ml-1">{avgRating}</span>
                  {listingReviews.length > 0 && (
                    <span className="text-gray-500 ml-1 text-xs">({listingReviews.length})</span>
                  )}
                </p>
              );
            })()}
            <p className="font-bold text-gray-800">₱{item.price.toLocaleString()}.00 / night</p>
          </div>
        </div>
      </div>
    </Link>
  );

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (locationRef.current && !locationRef.current.contains(e.target)) {
        setLocationOpen(false);
      }
      if (guestRef.current && !guestRef.current.contains(e.target)) {
        setGuestOpen(false);
      }
      if (dateRef.current && !dateRef.current.contains(e.target)) {
        setDateOpen(false);
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

  // Transaction history state
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);

  // Fetch user's transaction history from 'transactions' collection
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const txSnap = await getDocs(query(
          collection(db, "transactions"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        ));
        const transactions = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTransactions(transactions);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setTransactions([]);
      }
      setLoading(false);
    };
    fetchTransactions();
  }, [user]);

  return (
    <div className="font-sans min-h-screen bg-gradient-to-br from-[#fefefe] via-[#f7f8fa] to-[#f3f4f8]">
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
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0B2545] mb-4">
            Transaction History
          </h1>
          <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
            All your bookings and payments in one place.
          </p>
          <div className="w-20 sm:w-24 h-1 bg-gradient-to-r from-orange-500 to-orange-400 mx-auto mt-6 sm:mt-8 rounded-full"></div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <svg xmlns="http://www.w3.org/2000/svg" className="animate-spin h-12 w-12 text-orange-400 mb-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            <p className="text-center text-gray-500 text-lg font-medium">Loading your transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20 px-4 sm:px-0 flex flex-col items-center">
            <img src="https://assets10.lottiefiles.com/packages/lf20_3rwasyjy.json" alt="No transactions" className="w-40 h-40 mx-auto mb-6" style={{ filter: 'grayscale(0.2)' }} onError={e => e.target.style.display = 'none'} />
            <h3 className="text-3xl font-bold text-gray-700 mb-3">No transactions yet</h3>
            <p className="text-gray-500 mb-8 text-lg max-w-md mx-auto">
              Book a home or experience to see your transaction history here.<br />
              <span className='text-xs text-red-400'>DEBUG: No bookings found for your user. If you believe this is wrong, check your Firestore data and userId.</span>
            </p>
            <Link
              to="/homes"
              className="inline-flex items-center px-7 py-3 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white font-semibold rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-[1.04] active:scale-[0.98] text-lg"
            >
              Start Exploring
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop/tablet table view */}
            <div className="hidden sm:block overflow-x-auto">
              <div className="bg-white/90 rounded-3xl shadow-2xl p-6 sm:p-10">
                <table className="min-w-full rounded-2xl text-base">
                  <thead className="sticky top-0 z-10 bg-gray-100/95 backdrop-blur border-b border-gray-200">
                    <tr className="text-gray-700 text-base">
                      <th className="py-4 px-4 text-left font-semibold">Date</th>
                      <th className="py-4 px-4 text-left font-semibold">Category</th>
                      <th className="py-4 px-4 text-left font-semibold">Listing</th>
                      <th className="py-4 px-4 text-left font-semibold">Check-in</th>
                      <th className="py-4 px-4 text-left font-semibold">Check-out</th>
                      <th className="py-4 px-4 text-left font-semibold">Guests</th>
                      <th className="py-4 px-4 text-left font-semibold">Total Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => {
                      // Icon for category
                      let catIcon = null;
                      const cat = (tx.category || tx.type || "").toLowerCase();
                      if (cat.includes("home")) catIcon = <svg className="inline w-5 h-5 mr-1 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h3m10-11v11a1 1 0 01-1 1h-3m-4 0h4" /></svg>;
                      else if (cat.includes("experience")) catIcon = <svg className="inline w-5 h-5 mr-1 text-pink-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8" /></svg>;
                      else if (cat.includes("service")) catIcon = <svg className="inline w-5 h-5 mr-1 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8" /></svg>;

                      return (
                        <tr key={tx.id} className={`border-b last:border-b-0 transition-all ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/80'} hover:bg-orange-50/60`}>
                          {/* Date */}
                          <td className="py-4 px-4 font-medium text-gray-700">
                            {tx.createdAt && tx.createdAt.seconds
                              ? new Date(tx.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : tx.createdAt
                                ? new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : "-"}
                          </td>
                          {/* Category */}
                          <td className="py-4 px-4 capitalize font-semibold text-gray-800">
                            {catIcon}{tx.category || tx.type || "-"}
                          </td>
                          {/* Listing */}
                          <td className="py-4 px-4">
                            <span className="text-orange-600 font-semibold">
                              {tx.listingTitle || tx.title || "-"}
                            </span>
                          </td>
                          {/* Check-in */}
                          <td className="py-4 px-4">
                            {tx.checkIn && (tx.checkIn.seconds
                              ? new Date(tx.checkIn.seconds * 1000)
                              : new Date(tx.checkIn)
                            ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          {/* Check-out */}
                          <td className="py-4 px-4">
                            {tx.checkOut && (tx.checkOut.seconds
                              ? new Date(tx.checkOut.seconds * 1000)
                              : new Date(tx.checkOut)
                            ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          {/* Guests */}
                          <td className="pl-8">
                            {(() => {
                              if (tx.guests) {
                                const total = (tx.guests.adults || 0) + (tx.guests.children || 0) + (tx.guests.infants || 0) + (tx.guests.pets || 0);
                                return total;
                              } else if (typeof tx.total !== 'undefined') {
                                return tx.total;
                              } else if (typeof tx.guests === 'number') {
                                return tx.guests;
                              } else {
                                return 0;
                              }
                            })()}
                          </td>
                          {/* Total Paid */}
                          <td className="py-4 pl-5 font-bold text-green-600">
                            {typeof tx.finalPrice !== 'undefined' || typeof tx.price !== 'undefined' || typeof tx.amount !== 'undefined'
                              ? `₱${(tx.finalPrice || tx.price || tx.amount || 0).toLocaleString()}.00`
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-6">
              {transactions.map((tx, idx) => {
                let catIcon = null;
                const cat = (tx.category || tx.type || "").toLowerCase();
                if (cat.includes("home")) catIcon = <svg className="inline w-5 h-5 mr-1 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h3m10-11v11a1 1 0 01-1 1h-3m-4 0h4" /></svg>;
                else if (cat.includes("experience")) catIcon = <svg className="inline w-5 h-5 mr-1 text-pink-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8" /></svg>;
                else if (cat.includes("service")) catIcon = <svg className="inline w-5 h-5 mr-1 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8" /></svg>;

                return (
                  <div key={tx.id} className="rounded-2xl shadow-lg bg-white/90 p-5 flex flex-col gap-2 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500">{tx.createdAt && tx.createdAt.seconds
                        ? new Date(tx.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : tx.createdAt
                          ? new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "-"}</span>
                      <span className="capitalize font-semibold text-gray-800 flex items-center gap-1">{catIcon}{tx.category || tx.type || "-"}</span>
                    </div>
                    <div className="text-orange-600 font-semibold text-lg mb-1">{tx.listingTitle || tx.title || "-"}</div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-2">
                      <div><span className="font-semibold text-gray-500">Check-in:</span> {tx.checkIn && (tx.checkIn.seconds
                        ? new Date(tx.checkIn.seconds * 1000)
                        : new Date(tx.checkIn)
                      ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      <div><span className="font-semibold text-gray-500">Check-out:</span> {tx.checkOut && (tx.checkOut.seconds
                        ? new Date(tx.checkOut.seconds * 1000)
                        : new Date(tx.checkOut)
                      ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      <div><span className="font-semibold text-gray-500">Guests:</span> {(() => {
                        if (tx.guests) {
                          const total = (tx.guests.adults || 0) + (tx.guests.children || 0) + (tx.guests.infants || 0) + (tx.guests.pets || 0);
                          return total;
                        } else if (typeof tx.total !== 'undefined') {
                          return tx.total;
                        } else if (typeof tx.guests === 'number') {
                          return tx.guests;
                        } else {
                          return 0;
                        }
                      })()}</div>
                    </div>
                    <div className="font-bold text-green-600 text-lg">{typeof tx.finalPrice !== 'undefined' || typeof tx.price !== 'undefined' || typeof tx.amount !== 'undefined'
                      ? `₱${(tx.finalPrice || tx.price || tx.amount || 0).toLocaleString()}.00`
                      : '-'}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main><br></br>
      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-300 py-10 sm:py-14 px-4 sm:px-6 lg:px-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
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
              {/* Social Icons */}
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
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              <input type="email" placeholder="Your email address" className="px-3 py-2 w-full rounded-md sm:rounded-l-md text-gray-700 focus:outline-none" />
              <button className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-md sm:rounded-r-md text-white font-semibold">Subscribe</button>
            </div>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              * We’ll send you weekly updates for your better tour packages.
            </p>
          </div>
        </div>

        {/* © Bottom Text */}
        <div className="border-t border-gray-700 mt-8 sm:mt-10 pt-5 text-center text-sm text-gray-500">
          © 2025 Homezy | All Rights Reserved
        </div>
      </footer>

    </div>
  );
};

export default TransactionHistory;
