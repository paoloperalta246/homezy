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
import { User, Calendar, Heart, LogOut, MessageCircle, Shield, FileCheck, AlertTriangle, Lock, Scale, Headphones, Mail, Clock, CheckCircle, Info, FileText, CreditCard, Globe, Eye, Award, Bell } from "lucide-react";

const Compliance = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Navbar dropdown refs
    const dropdownButtonRef = useRef(null);
    const dropdownMenuRef = useRef(null);

    // Guest dropdown ref
    const guestRef = useRef(null);

    // Date dropdown ref
    const dateRef = useRef(null);

    const [reviews, setReviews] = useState([]);

    const [locations, setLocations] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [guestOpen, setGuestOpen] = useState(false);
    const [dateOpen, setDateOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [wishlist, setWishlist] = useState([]);

    const [allListings, setAllListings] = useState([]);

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
                // Fetch all listings
                const querySnapshot = await getDocs(collection(db, "listings"));

                // Extract unique locations
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

                // Check if selected date is within the listing's available range
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

    return (
        <div className="font-sans bg-[#fefefe] min-h-screen flex flex-col">
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
                                                <Heart className="w-4 h-4 text-orange-500" />
                                                Favorites
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
                                        <Heart className="w-4 h-4 text-orange-500" /> Favorites
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

            {/* Compliance & Regulatory Section */}
            <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-16 bg-gradient-to-b from-white via-orange-50/20 to-white">
                {/* Hero Section */}
                <div className="max-w-7xl mx-auto mb-10 sm:mb-14">
                    <div className="flex items-start gap-5">
                        <div className="shrink-0 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-400 text-white p-4 shadow-lg">
                            <Shield className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#0B2545] mb-3">
                                Compliance & Regulatory Standards
                            </h2>
                            <p className="mt-3 text-gray-600 text-base sm:text-lg max-w-4xl leading-relaxed">
                                Your trust is our priority. At Homezy, we uphold the highest standards of privacy, security, and transparency.
                                Our platform operates in full compliance with Philippine laws and international best practices to ensure a safe,
                                fair, and secure experience for all users—whether you're a guest or a host.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Trust Badges */}
                <div className="max-w-7xl mx-auto mb-12">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center shadow-sm hover:shadow-md transition">
                            <Lock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-gray-700">Encrypted Payments</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center shadow-sm hover:shadow-md transition">
                            <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-gray-700">RA 10173 Compliant</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center shadow-sm hover:shadow-md transition">
                            <Eye className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-gray-700">Full Transparency</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center shadow-sm hover:shadow-md transition">
                            <Headphones className="w-8 h-8 text-sky-500 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-gray-700">24/7 Support</p>
                        </div>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Main Content */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* 1. Data Privacy & Security */}
                        <section id="privacy" className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-orange-100 rounded-lg p-2">
                                    <Lock className="w-6 h-6 text-orange-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-[#0B2545]">Data Privacy & Security</h3>
                            </div>
                            <p className="text-gray-600 mb-5 leading-relaxed">
                                Homezy is committed to protecting your personal information in accordance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>.
                                We implement industry-leading security measures to safeguard your data.
                            </p>
                            <ul className="space-y-4 text-gray-700">
                                <li className="flex gap-3 items-start">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Consent-Based Data Sharing:</strong> Your personal data is never sold or shared with third parties without your explicit consent.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">End-to-End Encryption:</strong> All payment transactions and sensitive data are encrypted using SSL/TLS protocols.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Regular Security Audits:</strong> We conduct quarterly security assessments and penetration testing to identify and fix vulnerabilities.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">User Control:</strong> You have the right to access, update, or delete your personal information at any time through your account settings.
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* 2. Terms of Service */}
                        <section id="terms" className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-indigo-100 rounded-lg p-2">
                                    <FileText className="w-6 h-6 text-indigo-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-[#0B2545]">Terms of Service</h3>
                            </div>
                            <p className="text-gray-600 mb-5 leading-relaxed">
                                By using Homezy, you agree to comply with our terms and conditions. These terms govern the relationship between guests, hosts, and the platform.
                            </p>
                            <ul className="space-y-4 text-gray-700">
                                <li className="flex gap-3 items-start">
                                    <Info className="w-5 h-5 text-sky-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">User Eligibility:</strong> Users must be at least 18 years old and possess valid government-issued identification.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Info className="w-5 h-5 text-sky-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your account credentials and all activities under your account.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Info className="w-5 h-5 text-sky-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Prohibited Activities:</strong> Fraudulent bookings, discrimination, harassment, property damage, and illegal activities are strictly prohibited.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Info className="w-5 h-5 text-sky-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Right to Suspend:</strong> Homezy reserves the right to suspend or terminate accounts that violate our policies without prior notice.
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* 3. Platform Regulations */}
                        <section id="regulations" className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-purple-100 rounded-lg p-2">
                                    <Scale className="w-6 h-6 text-purple-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-[#0B2545]">Host & Listing Regulations</h3>
                            </div>
                            <p className="text-gray-600 mb-5 leading-relaxed">
                                All hosts and property listings on Homezy must comply with local, regional, and national regulations to ensure legal and ethical operation.
                            </p>
                            <ul className="space-y-4 text-gray-700">
                                <li className="flex gap-3 items-start">
                                    <Award className="w-5 h-5 text-amber-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Licensing & Permits:</strong> Hosts must obtain all necessary permits, including business permits and DOT accreditation where applicable.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Award className="w-5 h-5 text-amber-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Accurate Listings:</strong> Property descriptions, amenities, pricing, and photos must be truthful and up-to-date to prevent misleading guests.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Award className="w-5 h-5 text-amber-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Tax Compliance:</strong> Hosts are responsible for declaring income and paying applicable taxes in accordance with Philippine tax law.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Award className="w-5 h-5 text-amber-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Anti-Discrimination Policy:</strong> Hosts may not discriminate based on race, religion, nationality, gender, disability, or sexual orientation.
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* 4. Safety & Community Standards */}
                        <section id="safety" className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-rose-100 rounded-lg p-2">
                                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-[#0B2545]">Safety & Community Standards</h3>
                            </div>
                            <p className="text-gray-600 mb-5 leading-relaxed">
                                We prioritize the safety and well-being of our community. All users—guests and hosts—are expected to uphold safety protocols and respectful conduct.
                            </p>
                            <ul className="space-y-4 text-gray-700">
                                <li className="flex gap-3 items-start">
                                    <Shield className="w-5 h-5 text-orange-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Property Safety:</strong> All properties must comply with fire safety codes, have working smoke detectors, and provide emergency contact information.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Shield className="w-5 h-5 text-orange-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Identity Verification:</strong> Both guests and hosts must complete identity verification to prevent fraud and ensure accountability.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Shield className="w-5 h-5 text-orange-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Respectful Communication:</strong> Harassment, hate speech, or abusive language will result in immediate account suspension.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Shield className="w-5 h-5 text-orange-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Violation Consequences:</strong> Repeated violations may lead to permanent removal from the platform and potential legal action.
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* 5. Payment & Refund Policy */}
                        <section id="payments" className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-emerald-100 rounded-lg p-2">
                                    <CreditCard className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-[#0B2545]">Payment & Refund Policy</h3>
                            </div>
                            <p className="text-gray-600 mb-5 leading-relaxed">
                                We use secure third-party payment processors to handle all transactions. Our refund policy ensures fairness for both guests and hosts.
                            </p>
                            <ul className="space-y-4 text-gray-700">
                                <li className="flex gap-3 items-start">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Secure Transactions:</strong> All payments are processed through PayPal with PCI DSS Level 1 compliance.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Cancellation Policy:</strong> Refunds depend on the cancellation timeline—full refunds for cancellations 7+ days before check-in, 50% for 3-6 days, and no refund for less than 48 hours.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Host Payouts:</strong> Hosts receive payment 24 hours after guest check-in to ensure satisfaction.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Dispute Resolution:</strong> In case of payment disputes, Homezy acts as a neutral mediator and may withhold funds pending investigation.
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* 6. Legal Framework */}
                        <section id="legal" className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-slate-100 rounded-lg p-2">
                                    <Globe className="w-6 h-6 text-slate-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-[#0B2545]">Legal Framework & Jurisdiction</h3>
                            </div>
                            <p className="text-gray-600 mb-5 leading-relaxed">
                                Homezy operates under the legal jurisdiction of the Republic of the Philippines and adheres to all applicable laws and regulations.
                            </p>
                            <ul className="space-y-4 text-gray-700">
                                <li className="flex gap-3 items-start">
                                    <FileCheck className="w-5 h-5 text-indigo-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Governing Law:</strong> All agreements are governed by Philippine law, and disputes are subject to the exclusive jurisdiction of Philippine courts.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <FileCheck className="w-5 h-5 text-indigo-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Consumer Protection:</strong> We comply with the Consumer Act of the Philippines (RA 7394) to protect the rights of platform users.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <FileCheck className="w-5 h-5 text-indigo-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Anti-Money Laundering:</strong> Homezy adheres to the Anti-Money Laundering Act (RA 9160) and reports suspicious transactions to the AMLC.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <FileCheck className="w-5 h-5 text-indigo-500 mt-1 shrink-0" />
                                    <div>
                                        <strong className="text-gray-900">Intellectual Property:</strong> All content, trademarks, and branding on Homezy are protected under Philippine intellectual property laws.
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* 7. Reporting & Support */}
                        <section id="reporting" className="bg-gradient-to-br from-orange-500 to-orange-400 rounded-3xl shadow-xl text-white p-8">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-white/20 rounded-lg p-2">
                                    <Headphones className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold">Reporting & 24/7 Support</h3>
                            </div>
                            <p className="mb-5 leading-relaxed text-white/95">
                                If you encounter any issues, violations, or have questions about compliance, our dedicated support team is available around the clock.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex gap-3 items-start">
                                    <AlertTriangle className="w-5 h-5 text-white/90 mt-1 shrink-0" />
                                    <div>
                                        <strong>Report Violations:</strong> If you witness policy violations, suspicious activity, or unsafe conditions, report immediately via email or through the in-app reporting feature.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Clock className="w-5 h-5 text-white/90 mt-1 shrink-0" />
                                    <div>
                                        <strong>24/7 Availability:</strong> Our support team is online 24/7 for urgent safety, security, or regulatory concerns.
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <Mail className="w-5 h-5 text-white/90 mt-1 shrink-0" />
                                    <div>
                                        <strong>Contact Us:</strong> Email <a href="mailto:compliance@homezy.com" className="underline font-semibold">compliance@homezy.com</a> or call our hotline at <strong>+63 917 123 4567</strong>.
                                    </div>
                                </li>
                            </ul>
                        </section>

                    </div>

                    {/* Right: Sidebar */}
                    <aside className="space-y-6">
                        {/* Navigation */}
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sticky top-24">
                            <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-orange-500" />
                                On This Page
                            </h4>
                            <nav className="text-sm text-gray-600">
                                <ul className="space-y-3">
                                    <li><a href="#privacy" className="hover:text-orange-600 transition flex items-center gap-2">
                                        <Lock className="w-3.5 h-3.5" /> Data Privacy & Security
                                    </a></li>
                                    <li><a href="#terms" className="hover:text-orange-600 transition flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5" /> Terms of Service
                                    </a></li>
                                    <li><a href="#regulations" className="hover:text-orange-600 transition flex items-center gap-2">
                                        <Scale className="w-3.5 h-3.5" /> Host Regulations
                                    </a></li>
                                    <li><a href="#safety" className="hover:text-orange-600 transition flex items-center gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5" /> Safety Standards
                                    </a></li>
                                    <li><a href="#payments" className="hover:text-orange-600 transition flex items-center gap-2">
                                        <CreditCard className="w-3.5 h-3.5" /> Payment & Refunds
                                    </a></li>
                                    <li><a href="#legal" className="hover:text-orange-600 transition flex items-center gap-2">
                                        <Globe className="w-3.5 h-3.5" /> Legal Framework
                                    </a></li>
                                    <li><a href="#reporting" className="hover:text-orange-600 transition flex items-center gap-2">
                                        <Headphones className="w-3.5 h-3.5" /> Reporting & Support
                                    </a></li>
                                </ul>
                            </nav>
                        </div>

                        {/* Contact Card */}
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-400 text-white rounded-3xl shadow-lg p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Mail className="w-5 h-5" />
                                <h4 className="text-lg font-bold">Need Help?</h4>
                            </div>
                            <p className="text-white/90 text-sm mb-4 leading-relaxed">
                                Our compliance and legal team is ready to answer your questions about policies, regulations, and account safety.
                            </p>
                            <a
                                href="mailto:compliance@homezy.com"
                                className="inline-flex items-center gap-2 bg-white text-indigo-600 font-semibold px-4 py-2.5 rounded-lg shadow-md hover:shadow-lg transition w-full justify-center"
                            >
                                <Mail className="w-4 h-4" />
                                Contact Compliance Team
                            </a>
                            <div className="mt-5 pt-4 border-t border-white/20">
                                <p className="text-xs text-white/80 mb-1">📞 Hotline: <strong>+63 917 123 4567</strong></p>
                                <p className="text-xs text-white/80">🕒 Available 24/7</p>
                            </div>
                        </div>

                        {/* Last Updated */}
                        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 text-center">
                            <Clock className="w-5 h-5 text-gray-500 mx-auto mb-2" />
                            <p className="text-xs text-gray-600 font-medium">Last Updated</p>
                            <p className="text-sm font-bold text-gray-800">December 15, 2024</p>
                        </div>
                    </aside>
                </div>
            </main>
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
                            * We'll send you weekly updates for your better tour packages.
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

export default Compliance;
