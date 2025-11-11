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
import { User, Calendar, Heart, LogOut, MessageCircle, Shield, FileCheck, AlertTriangle, Lock, Scale, Headphones, Mail, Clock } from "lucide-react";

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
                                        <img
                                            src={user.photoURL || defaultProfile}
                                            alt="profile"
                                            className="w-6 h-6 rounded-full object-cover"
                                        />
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
                                                <img
                                                    src={user.photoURL || defaultProfile}
                                                    alt="profile"
                                                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                                />
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
            <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-16 bg-gradient-to-b from-white to-orange-50/30">
                {/* Hero */}
                <div className="max-w-6xl mx-auto mb-8 sm:mb-12">
                    <div className="flex items-start gap-4">
                        <div className="shrink-0 rounded-2xl bg-orange-100 text-orange-600 p-3">
                            <Shield className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0B2545]">
                                Compliance & Regulatory
                            </h2>
                            <p className="mt-2 text-gray-600 text-base sm:text-lg max-w-3xl">
                                We’re committed to privacy, safety, and transparency. Review our standards and policies to ensure a secure and trustworthy experience on Homezy.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                    {/* Left: Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        <section id="privacy" className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-3">
                                <Lock className="w-5 h-5 text-orange-500" />
                                <h3 className="text-xl font-semibold text-[#0B2545]">1. Data Privacy & Security</h3>
                            </div>
                            <ul className="space-y-3 text-gray-700">
                                <li className="flex gap-3">
                                    <FileCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
                                    <span>Your personal data is protected under the Data Privacy Act of 2012 (RA 10173) and is never shared without your consent.</span>
                                </li>
                                <li className="flex gap-3">
                                    <Shield className="w-5 h-5 text-orange-500 mt-0.5" />
                                    <span>All payment transactions are encrypted and processed securely.</span>
                                </li>
                                <li className="flex gap-3">
                                    <Scale className="w-5 h-5 text-indigo-500 mt-0.5" />
                                    <span>We regularly audit our systems to ensure the safety and confidentiality of your information.</span>
                                </li>
                            </ul>
                        </section>

                        <section id="regulations" className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-3">
                                <FileCheck className="w-5 h-5 text-orange-500" />
                                <h3 className="text-xl font-semibold text-[#0B2545]">2. Platform Regulations</h3>
                            </div>
                            <ul className="space-y-3 text-gray-700">
                                <li className="flex gap-3">
                                    <Scale className="w-5 h-5 text-indigo-500 mt-0.5" />
                                    <span>All listings and hosts must comply with local government regulations and licensing requirements.</span>
                                </li>
                                <li className="flex gap-3">
                                    <FileCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
                                    <span>Guests and hosts are required to provide accurate information and valid identification.</span>
                                </li>
                                <li className="flex gap-3">
                                    <Shield className="w-5 h-5 text-orange-500 mt-0.5" />
                                    <span>We prohibit discrimination of any kind and promote inclusivity for all users.</span>
                                </li>
                            </ul>
                        </section>

                        <section id="safety" className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                <h3 className="text-xl font-semibold text-[#0B2545]">3. Safety & Community Standards</h3>
                            </div>
                            <ul className="space-y-3 text-gray-700">
                                <li className="flex gap-3">
                                    <Shield className="w-5 h-5 text-orange-500 mt-0.5" />
                                    <span>All properties must meet safety standards, including fire safety and emergency protocols.</span>
                                </li>
                                <li className="flex gap-3">
                                    <User className="w-5 h-5 text-sky-600 mt-0.5" />
                                    <span>We encourage respectful communication and responsible behavior from all members.</span>
                                </li>
                                <li className="flex gap-3">
                                    <FileCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
                                    <span>Violations of our community guidelines may result in suspension or removal from the platform.</span>
                                </li>
                            </ul>
                        </section>

                        <section id="reporting" className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-3">
                                <Headphones className="w-5 h-5 text-orange-500" />
                                <h3 className="text-xl font-semibold text-[#0B2545]">4. Reporting & Support</h3>
                            </div>
                            <ul className="space-y-3 text-gray-700">
                                <li className="flex gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                                    <span>If you encounter any suspicious activity or have compliance concerns, please contact our support team immediately.</span>
                                </li>
                                <li className="flex gap-3">
                                    <Clock className="w-5 h-5 text-indigo-500 mt-0.5" />
                                    <span>We offer 24/7 support for urgent regulatory or safety issues.</span>
                                </li>
                                <li className="flex gap-3">
                                    <Mail className="w-5 h-5 text-emerald-600 mt-0.5" />
                                    <span>Contact us at <a href="mailto:support@homezy.com" className="text-orange-600 underline">support@homezy.com</a>.</span>
                                </li>
                            </ul>
                        </section>
                    </div>

                    {/* Right: Sidebar */}
                    <aside className="space-y-6">
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">On this page</h4>
                            <nav className="text-sm text-gray-600">
                                <ul className="space-y-2">
                                    <li><a href="#privacy" className="hover:text-orange-600">Data Privacy & Security</a></li>
                                    <li><a href="#regulations" className="hover:text-orange-600">Platform Regulations</a></li>
                                    <li><a href="#safety" className="hover:text-orange-600">Safety & Community</a></li>
                                    <li><a href="#reporting" className="hover:text-orange-600">Reporting & Support</a></li>
                                </ul>
                            </nav>
                        </div>
                        <div className="bg-gradient-to-br from-orange-500 to-orange-400 text-white rounded-3xl shadow-lg p-6">
                            <h4 className="text-lg font-semibold mb-2">Need help?</h4>
                            <p className="text-white/90 text-sm mb-4">Our compliance team is here to assist you with safety, reporting, and account concerns.</p>
                            <a href="mailto:support@homezy.com" className="inline-flex items-center gap-2 bg-white text-orange-600 font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow transition">
                                <Mail className="w-4 h-4" />
                                Email Support
                            </a>
                            <div className="mt-4 text-xs text-white/80">
                                Last updated: November 11, 2025
                            </div>
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

export default Compliance;
