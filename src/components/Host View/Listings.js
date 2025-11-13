import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png";
import { Home, Clipboard, Gift, User, MessageSquare, Calendar, Ticket, DollarSign, Bell, LogOut } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { DateRange } from "react-date-range";
import "react-date-range/dist/styles.css"; // main styles
import "react-date-range/dist/theme/default.css"; // theme
import { enUS } from 'date-fns/locale';

const Listings = () => {
  delete L.Icon.Default.prototype._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
    iconUrl: require("leaflet/dist/images/marker-icon.png"),
    shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
  });

  const [host, setHost] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [listingType, setListingType] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [listings, setListings] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [uploadingDraft, setUploadingDraft] = useState(false);
  const [uploadingAdd, setUploadingAdd] = useState(false);
  const [activeTab, setActiveTab] = useState("listings");
  const [editingListing, setEditingListing] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingImageFiles, setEditingImageFiles] = useState([]); // for multiple images
  const [mobileOpen, setMobileOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    location: "",
    price: "",
    discount: "",
    promos: "",
    duration: "",
    description: "",
    amenities: "",
    guestSize: "",
    latLng: null, // <-- new
    location: "", // human-readable address
  });

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  // Track logged-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "hosts", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setHost(docSnap.data());
      } else setHost(null);
    });
    return () => unsubscribe();
  }, []);

  function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }


  // Fetch listings
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "listings"),
      where("hostId", "==", auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setListings(data);
    });
    return () => unsubscribe();
  }, []);

  function LocationPicker({ formData, setFormData }) {
    const [position, setPosition] = useState(formData.latLng || [14.6760, 121.0437]); // Default QC

    useMapEvents({
      click: async (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        setPosition([lat, lng]);
        setFormData({ ...formData, latLng: [lat, lng] });

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          const data = await response.json();
          setFormData((prev) => ({
            ...prev,
            location: data.display_name || "",
          }));
        } catch (error) {
          console.error("Error fetching address:", error);
        }
      },
    });

    return position === null ? null : <Marker position={position}></Marker>;
  }

  // Close dropdown{}
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigation = (path) => navigate(path);

  const handleLogout = async () => {
    await signOut(auth);
    setDropdownOpen(false);
    navigate("/login");
  };

  const handleAddListingClick = () => setShowTypeModal(true);

  const handleChooseType = (type) => {
    setListingType(type);
    setShowTypeModal(false);
    setShowFormModal(true);
  };

  const uploadImagesToCloudinary = async (files) => {
    if (!files || files.length === 0) return [];
    const uploadedUrls = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "homezy_unsigned");

      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dnpimmfrn/image/upload",
        { method: "POST", body: formData }
      );
      const data = await res.json();
      uploadedUrls.push(data.secure_url);
    }
    return uploadedUrls;
  };

  const handleSubmit = async (e, status = "published") => {
    e.preventDefault();
    if (status === "draft") setUploadingDraft(true);
    else setUploadingAdd(true);

    try {
      const imageUrls = await uploadImagesToCloudinary(imageFiles);

      await addDoc(collection(db, "listings"), {
        category: listingType,
        ...formData,
        price: Number(formData.price),
        hostId: auth.currentUser.uid,
        hostName: host?.firstName || "Unknown",
        images: imageUrls, // multiple images
        createdAt: serverTimestamp(),
        status,
      });

      alert(status === "draft" ? "✅ Draft Saved!" : "✅ Listing Added!");

      // Reset form
      setShowFormModal(false);
      setListingType(null);
      setFormData({
        title: "",
        location: "",
        price: "",
        duration: "",
        description: "",
        amenities: "",
        guestSize: "",
        latLng: null, // <-- new
        location: "", // human-readable address
      });
      setImageFiles([]);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to add listing.");
    } finally {
      setUploadingDraft(false);
      setUploadingAdd(false);
    }
  };

  const handleDeleteListing = async (id) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) return;
    try {
      await deleteDoc(doc(db, "listings", id));
      alert("✅ Listing Deleted!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateListing = async (e, id) => {
    e.preventDefault();
    try {
      let newImages = editingListing.images || [];

      // Upload new images if selected
      if (editingImageFiles.length > 0) {
        const uploaded = await uploadImagesToCloudinary(editingImageFiles);
        newImages = [...newImages, ...uploaded]; // append new images
      }

      const docRef = doc(db, "listings", id);
      await updateDoc(docRef, {
        ...editingListing,
        price: Number(editingListing.price),
        images: newImages,
      });

      alert("✅ Listing Updated!");
      setShowEditModal(false);
      setEditingListing(null);
      setEditingImageFiles([]);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update listing.");
    }
  };

  const handlePublishListing = async (id) => {
    if (!window.confirm("Publish this draft?")) return;
    try {
      const docRef = doc(db, "listings", id);
      await updateDoc(docRef, { status: "published" });
      alert("✅ Draft Published!");
    } catch (err) {
      console.error(err);
    }
  };

  const getNavItem = (path, label, Icon) => {
    const isActive = location.pathname === path;
    return (
      <button
        onClick={() => handleNavigation(path)}
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${isActive
          ? "bg-[#FF5A1F] text-white"
          : "text-[#23364A] hover:bg-gray-100"
          }`}
      >
        {Icon && <Icon className="w-5 h-5 text-current" />}
        <span>{label}</span>
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

      {/* Main Content */}
      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-8 md:px-16 py-6 md:py-10 md:ml-[260px]">
        {/* Tab Switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex gap-2 p-1.5 bg-gray-100 rounded-xl shadow-sm">
            <button
              onClick={() => setActiveTab("listings")}
              className={`px-6 sm:px-8 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                activeTab === "listings" 
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200" 
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <Clipboard className="w-4 h-4" />
                Listings
              </span>
            </button>
            <button
              onClick={() => setActiveTab("drafts")}
              className={`px-6 sm:px-8 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                activeTab === "drafts" 
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200" 
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Drafts
              </span>
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-[32px] font-bold mb-2 flex items-center gap-2">
                <span className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                  <Clipboard className="w-7 h-7" />
                </span>
                {activeTab === "listings" ? "Your Listings" : "Your Drafts"}
              </h2>
              <p className="text-[#5E6282] text-base sm:text-lg mb-8">
                {activeTab === "listings"
                  ? "Manage and view all your listings here."
                  : "View and edit your draft listings here."}
              </p>
            </div>
            {activeTab === "listings" && (
              <button
                onClick={handleAddListingClick}
                className="bg-[#FF5A1F] text-white px-4 sm:px-5 py-2 rounded-md hover:opacity-90 transition mt-2 md:mt-0 w-full sm:w-auto"
              >
                + Add Listing
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 mt-2 w-full justify-end">
            <input
              type="text"
              placeholder="Search listings by title or name..."
              className="border border-gray-300 px-3 sm:px-4 py-2 rounded-lg w-full sm:w-64 focus:ring-2 focus:ring-[#FF5A1F] outline-none text-sm sm:text-base"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearchTerm(searchInput.trim()); }}
            />
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setSearchTerm(searchInput.trim())}
                className="bg-[#FF5A1F] text-white px-3 sm:px-4 py-2 rounded-lg font-medium hover:opacity-90 transition w-full sm:w-auto text-sm sm:text-base"
              >
                Search
              </button>
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(""); setSearchInput(""); }}
                  className="text-gray-500 hover:text-[#FF5A1F] px-2 py-2 rounded w-full sm:w-auto text-sm sm:text-base"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Results for: ... */}
          {searchTerm && (
            <div className="mt-2 text-[#FF5A1F] font-bold text-xl sm:text-2xl text-left w-full truncate">
              Results for: <span className="font-extrabold">{searchTerm}</span>
            </div>
          )}
        </div>

        {/* Listings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {listings
            .filter((listing) =>
              activeTab === "listings"
                ? listing.status === "published"
                : listing.status === "draft"
            )
            .filter((listing) =>
              searchTerm
                ? (listing.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  listing.hostName?.toLowerCase().includes(searchTerm.toLowerCase()))
                : true
            )
            .map((listing) => (
              <div
                key={listing.id}
                className="w-full bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 relative group"
              >
                <div className="relative w-full h-56 overflow-hidden">
                  <img
                    src={listing.images?.[0] || "https://via.placeholder.com/400"}
                    alt={listing.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-wrap">
                    <button
                      onClick={() => {
                        setEditingListing(listing);
                        setShowEditModal(true);
                      }}
                      className="bg-white/80 hover:bg-white text-blue-600 font-semibold px-3 py-1 rounded-lg text-sm shadow-sm"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteListing(listing.id)}
                      className="bg-white/80 hover:bg-white text-red-600 font-semibold px-3 py-1 rounded-lg text-sm shadow-sm"
                    >
                      🗑️ Delete
                    </button>
                    {activeTab === "drafts" && (
                      <button
                        onClick={() => handlePublishListing(listing.id)}
                        className="bg-white/80 hover:bg-white text-green-600 font-semibold px-3 py-1 rounded-lg text-sm shadow-sm"
                      >
                        ✅ Publish
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <h3 className="font-bold text-gray-800 text-lg mb-1 truncate">{listing.title}</h3>
                  <p className="text-gray-500 text-sm mb-2 sm:mb-3">{listing.location}</p>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <p className="text-[#FF5A1F] font-semibold text-lg">₱{listing.price.toLocaleString()}.00</p>
                    <span className="flex items-center gap-1 bg-[#FFF1EB] text-[#FF5A1F] text-xs font-medium px-3 py-1 rounded-full capitalize">
                      {listing.category === "home" && "🏠 Home"}
                      {listing.category === "experience" && "🌄 Experience"}
                      {listing.category === "service" && "💼 Service"}
                      {!["home", "experience", "service"].includes(listing.category) && "Listing"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </main>

      {/* ===== Modal 1: Choose Type ===== */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-[420px] text-center relative animate-fadeIn">
            {/* 🏠 Header */}
            <h2 className="text-2xl font-bold text-[#0B2545] mb-2">Choose Listing Type</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Select the type of listing you want to create for your guests.
            </p>

            {/* ✨ Type Options */}
            <div className="flex flex-col gap-4">
              <button
                onClick={() => handleChooseType("home")}
                className="flex items-center justify-between w-full px-5 py-3 border-2 border-gray-200 rounded-xl hover:border-[#FF5A1F] hover:shadow-md hover:bg-[#FFF8F5] transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏠</span>
                  <div className="text-left">
                    <h3 className="font-semibold text-[#23364A]">Home</h3>
                    <p className="text-xs text-gray-500">List apartments, condos, or rooms</p>
                  </div>
                </div>
                <span className="text-[#FF5A1F] font-bold text-lg">›</span>
              </button>

              <button
                onClick={() => handleChooseType("experience")}
                className="flex items-center justify-between w-full px-5 py-3 border-2 border-gray-200 rounded-xl hover:border-[#FF5A1F] hover:shadow-md hover:bg-[#FFF8F5] transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌄</span>
                  <div className="text-left">
                    <h3 className="font-semibold text-[#23364A]">Experience</h3>
                    <p className="text-xs text-gray-500">Offer tours, workshops, or activities</p>
                  </div>
                </div>
                <span className="text-[#FF5A1F] font-bold text-lg">›</span>
              </button>

              <button
                onClick={() => handleChooseType("service")}
                className="flex items-center justify-between w-full px-5 py-3 border-2 border-gray-200 rounded-xl hover:border-[#FF5A1F] hover:shadow-md hover:bg-[#FFF8F5] transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💼</span>
                  <div className="text-left">
                    <h3 className="font-semibold text-[#23364A]">Service</h3>
                    <p className="text-xs text-gray-500">Promote your professional services</p>
                  </div>
                </div>
                <span className="text-[#FF5A1F] font-bold text-lg">›</span>
              </button>
            </div>

            {/* 🔙 Back Button */}
            <button
              onClick={() => setShowTypeModal(false)}
              className="mt-8 w-full py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* ===== Modal 2: Add Listing Form ===== */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center overflow-auto z-50 animate-fadeIn px-4">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-[520px] max-h-[90vh] overflow-y-auto border border-gray-200 relative">
            <h2 className="text-2xl font-bold mb-6 capitalize text-center text-[#23364A]">
              Add {listingType} Listing
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Title */}
              <input
                type="text"
                placeholder={
                  listingType === "home"
                    ? "Enter title of apartment/house"
                    : listingType === "experience"
                      ? "Enter title of experience"
                      : "Enter service title"
                }
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none w-full"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />

              {/* Location Field */}
              <input
                type="text"
                placeholder="Selected location"
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none w-full mb-2"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
              />
              <div className="w-full h-64 sm:h-80 border border-gray-300 rounded-lg overflow-hidden">
                <MapContainer
                  center={formData.latLng || [14.6760, 121.0437]} // Default to QC
                  zoom={13}
                  scrollWheelZoom={true}
                  className="w-full h-full"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
                  />
                  <LocationPicker formData={formData} setFormData={setFormData} />
                </MapContainer>
                <p className="text-sm text-gray-500 mt-1 text-center">
                  Click on the map to select your listing location
                </p>
              </div>

              {/* Price */}
              <input
                type="number"
                placeholder={
                  listingType === "home"
                    ? "Enter price per night"
                    : listingType === "experience"
                      ? "Enter price per person"
                      : "Enter service rate"
                }
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none w-full"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />

              {/* Discount Field */}
              <input
                type="number"
                placeholder="Enter discount amount (optional)"
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none w-full"
                value={formData.discount || ""}
                onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
              />

              {/* Promos Field */}
              <input
                type="text"
                placeholder="Enter promo details (optional)"
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none w-full"
                value={formData.promos || ""}
                onChange={(e) => setFormData({ ...formData, promos: e.target.value })}
              />

              {/* Category-specific fields */}
              {listingType === "home" && (
                <>
                  {/* Property Type */}
                  <select
                    className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none w-full"
                    value={formData.propertyType || ""}
                    onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                  >
                    <option value="" disabled>Select property type</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Condo">Condo</option>
                    <option value="House">House</option>
                    <option value="Room">Room</option>
                    <option value="Villa">Villa</option>
                  </select>

                  {/* Bedrooms / Beds / Bathrooms */}
                  <input
                    type="number"
                    placeholder="Number of bedrooms"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.bedrooms || ""}
                    onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Number of beds"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.beds || ""}
                    onChange={(e) => setFormData({ ...formData, beds: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Number of bathrooms"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.bathrooms || ""}
                    onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                  />

                  <input
                    type="number"
                    placeholder="Guest size limit"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.guestSize}
                    onChange={(e) => setFormData({ ...formData, guestSize: e.target.value })}
                  />

                  {/* Amenities Label + Text Field */}
                  <label className="font-medium text-gray-700">Amenities</label>
                  <input
                    type="text"
                    placeholder="Selected amenities will appear here"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full mb-2"
                    value={(formData.amenities || []).join(", ")}
                    readOnly
                  />

                  {/* Amenities (Predefined Checkboxes) */}
                  <div className="flex flex-wrap gap-2">
                    {["WiFi", "Parking", "Pool", "Air Conditioning", "Kitchen", "Gym", "Pet Friendly", "TV"].map((amenity) => (
                      <label key={amenity} className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg cursor-pointer hover:bg-gray-200">
                        <input
                          type="checkbox"
                          checked={formData.amenities?.includes(amenity) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                amenities: [...(formData.amenities || []), amenity],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                amenities: formData.amenities.filter((a) => a !== amenity),
                              });
                            }
                          }}
                          className="accent-[#FF5A1F]"
                        />
                        {amenity}
                      </label>
                    ))}
                  </div>

                  {/* House Rules */}
                  <input
                    type="text"
                    placeholder="House rules (No Smoking, No Pets...)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.houseRules || ""}
                    onChange={(e) => setFormData({ ...formData, houseRules: e.target.value })}
                  />

                  {/* Calendar Availability (Single Range Picker) */}
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <label className="font-medium text-gray-700">Calendar Availability</label>

                    <div className="w-full max-w-md mx-auto sm:mx-0">
                      <DateRange
                        editableDateInputs={true}
                        onChange={(item) => {
                          const start = item.selection.startDate;
                          const end = item.selection.endDate;

                          setFormData({
                            ...formData,
                            availabilityStart: start ? formatDateLocal(start) : "",
                            availabilityEnd: end ? formatDateLocal(end) : "",
                          });
                        }}
                        moveRangeOnFirstSelection={false}
                        ranges={[
                          {
                            startDate: formData.availabilityStart
                              ? new Date(formData.availabilityStart)
                              : new Date(),
                            endDate: formData.availabilityEnd
                              ? new Date(formData.availabilityEnd)
                              : new Date(),
                            key: "selection",
                          },
                        ]}
                        locale={enUS}
                        className="border rounded-lg w-full sm:w-auto"
                        direction="vertical" // ✅ vertical layout on mobile
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Experience & Service fields */}
              {/* Same changes applied for textareas, selects, and date inputs to ensure mobile responsiveness */}
              {listingType === "experience" && (
                <>
                  <select
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.experienceType || ""}
                    onChange={(e) => setFormData({ ...formData, experienceType: e.target.value })}
                  >
                    <option value="" disabled>Select experience type</option>
                    <option value="Tour">Tour</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Adventure">Adventure</option>
                    <option value="Class">Class</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Duration (e.g., 3 hours)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="Guest size limit"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.guestSize}
                    onChange={(e) => setFormData({ ...formData, guestSize: e.target.value })}
                  />
                  <textarea
                    placeholder="What’s included (Equipment, Meals...)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none h-20 resize-none w-full"
                    value={formData.includes}
                    onChange={(e) => setFormData({ ...formData, includes: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Age range"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.skillLevel}
                    onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
                  />
                  <textarea
                    placeholder="Safety notes (optional)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none h-20 resize-none w-full"
                    value={formData.safetyNotes}
                    onChange={(e) => setFormData({ ...formData, safetyNotes: e.target.value })}
                  />
                  {/* Calendar Availability (Single Range Picker) */}
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <label className="font-medium text-gray-700">Calendar Availability</label>

                    <div className="w-full max-w-md mx-auto sm:mx-0">
                      <DateRange
                        editableDateInputs={true}
                        onChange={(item) => {
                          const start = item.selection.startDate;
                          const end = item.selection.endDate;

                          setFormData({
                            ...formData,
                            availabilityStart: start ? formatDateLocal(start) : "",
                            availabilityEnd: end ? formatDateLocal(end) : "",
                          });
                        }}
                        moveRangeOnFirstSelection={false}
                        ranges={[
                          {
                            startDate: formData.availabilityStart
                              ? new Date(formData.availabilityStart)
                              : new Date(),
                            endDate: formData.availabilityEnd
                              ? new Date(formData.availabilityEnd)
                              : new Date(),
                            key: "selection",
                          },
                        ]}
                        locale={enUS}
                        className="border rounded-lg w-full sm:w-auto"
                        direction="vertical" // ✅ vertical layout on mobile
                      />
                    </div>
                  </div>
                </>
              )}

              {listingType === "service" && (
                <>
                  <select
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.serviceType || ""}
                    onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  >
                    <option value="" disabled>Select service type</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                    <option value="Grooming">Grooming</option>
                    <option value="Pet Care">Pet Care</option>
                    <option value="Fitness Program">Fitness Program</option>
                    <option value="Others">Others</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Duration / Session length (e.g., 2 hours)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  />

                  <input
                    type="number"
                    placeholder="Guest size limit"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={formData.guestSize}
                    onChange={(e) => setFormData({ ...formData, guestSize: e.target.value })}
                  />

                  {/* Calendar Availability (Single Range Picker) */}
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <label className="font-medium text-gray-700">Calendar Availability</label>

                    <div className="w-full max-w-md mx-auto sm:mx-0">
                      <DateRange
                        editableDateInputs={true}
                        onChange={(item) => {
                          const start = item.selection.startDate;
                          const end = item.selection.endDate;

                          setFormData({
                            ...formData,
                            availabilityStart: start ? formatDateLocal(start) : "",
                            availabilityEnd: end ? formatDateLocal(end) : "",
                          });
                        }}
                        moveRangeOnFirstSelection={false}
                        ranges={[
                          {
                            startDate: formData.availabilityStart
                              ? new Date(formData.availabilityStart)
                              : new Date(),
                            endDate: formData.availabilityEnd
                              ? new Date(formData.availabilityEnd)
                              : new Date(),
                            key: "selection",
                          },
                        ]}
                        locale={enUS}
                        className="border rounded-lg w-full sm:w-auto"
                        direction="vertical" // ✅ vertical layout on mobile
                      />
                    </div>
                  </div>
                  <textarea
                    placeholder="Materials / Requirements (optional)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none h-20 resize-none w-full"
                    value={formData.materials}
                    onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                  />
                </>
              )}

              {/* Description for all */}
              <textarea
                placeholder="Enter full description"
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none h-28 resize-none w-full"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />

              {/* Images */}
              <input
                type="file"
                multiple
                onChange={(e) => setImageFiles(Array.from(e.target.files))}
                required
              />

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowFormModal(false);
                    setShowTypeModal(true);
                  }}
                  className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition w-full sm:w-auto"
                >
                  ← Back
                </button>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, "draft")}
                    disabled={uploadingDraft}
                    className="px-5 py-2.5 bg-gray-700 text-white rounded-lg font-medium hover:opacity-90 transition w-full sm:w-auto"
                  >
                    {uploadingDraft ? "Saving..." : "Save as Draft"}
                  </button>

                  <button
                    type="submit"
                    disabled={uploadingAdd}
                    className="px-5 py-2.5 bg-[#FF5A1F] text-white rounded-lg font-medium hover:opacity-90 transition w-full sm:w-auto"
                  >
                    {uploadingAdd ? "Adding..." : "Add Listing"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal 3: Edit Listing ===== */}
      {showEditModal && editingListing && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 animate-fadeIn px-4">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-[520px] max-h-[90vh] overflow-y-auto border border-gray-200">
            <h2 className="text-2xl font-bold mb-6 text-center text-[#23364A]">
              Edit {editingListing.category} Listing
            </h2>

            <form
              onSubmit={(e) => handleUpdateListing(e, editingListing.id)}
              className="flex flex-col gap-4"
            >
              {/* Title */}
              <input
                type="text"
                placeholder={
                  editingListing.category === "home"
                    ? "Enter title of apartment/house"
                    : editingListing.category === "experience"
                      ? "Enter title of experience"
                      : "Enter service title"
                }
                className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-[#FF5A1F] w-full"
                value={editingListing.title || ""}
                onChange={(e) =>
                  setEditingListing({ ...editingListing, title: e.target.value })
                }
                required
              />

              {/* Location Field */}
              <input
                type="text"
                placeholder="Selected location"
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none w-full mb-2"
                value={editingListing.location || ""}
                onChange={(e) =>
                  setEditingListing({ ...editingListing, location: e.target.value })
                }
                required
              />

              <div className="w-full h-64 sm:h-80 border border-gray-300 rounded-lg overflow-hidden">
                <MapContainer
                  center={editingListing.latLng || [14.6760, 121.0437]} // Default to QC
                  zoom={13}
                  scrollWheelZoom={true}
                  className="w-full h-full"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
                  />
                  <LocationPicker formData={editingListing} setFormData={setEditingListing} />
                </MapContainer>
                <p className="text-sm text-gray-500 mt-1 text-center">
                  Click on the map to select your listing location
                </p>
              </div>

              {/* Price */}
              <input
                type="number"
                placeholder={
                  editingListing.category === "home"
                    ? "Enter price per night"
                    : editingListing.category === "experience"
                      ? "Enter price per person"
                      : "Enter service rate"
                }
                className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-[#FF5A1F] w-full"
                value={editingListing.price || ""}
                onChange={(e) =>
                  setEditingListing({ ...editingListing, price: e.target.value })
                }
                required
              />

              {/* Discount Field */}
              <input
                type="number"
                placeholder="Enter discount amount (optional)"
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none w-full"
                value={editingListing.discount || ""}
                onChange={(e) =>
                  setEditingListing({ ...editingListing, discount: e.target.value })
                }
              />

              {/* Promos Field */}
              <input
                type="text"
                placeholder="Enter promo details (optional)"
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-[#FF5A1F] outline-none w-full"
                value={editingListing.promos || ""}
                onChange={(e) =>
                  setEditingListing({ ...editingListing, promos: e.target.value })
                }
              />

              {/* Category-specific fields */}
              {editingListing.category === "home" && (
                <>
                  <select
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-[#FF5A1F] w-full"
                    value={editingListing.propertyType || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, propertyType: e.target.value })
                    }
                  >
                    <option value="" disabled>Select property type</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Condo">Condo</option>
                    <option value="House">House</option>
                    <option value="Room">Room</option>
                    <option value="Villa">Villa</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Number of bedrooms"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.bedrooms || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, bedrooms: e.target.value })
                    }
                  />
                  <input
                    type="number"
                    placeholder="Number of beds"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.beds || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, beds: e.target.value })
                    }
                  />
                  <input
                    type="number"
                    placeholder="Number of bathrooms"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.bathrooms || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, bathrooms: e.target.value })
                    }
                  />

                  <input
                    type="number"
                    placeholder="Guest size limit"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.guestSize || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, guestSize: e.target.value })
                    }
                  />

                  {/* Amenities Label + Text Field */}
                  <label className="font-medium text-gray-700">Amenities</label>
                  <input
                    type="text"
                    placeholder="Selected amenities will appear here"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full mb-2"
                    value={(editingListing.amenities || []).join(", ")}
                    readOnly
                  />

                  {/* Amenities (Predefined Checkboxes) */}
                  <div className="flex flex-wrap gap-2">
                    {["WiFi", "Parking", "Pool", "Air Conditioning", "Kitchen", "Gym", "Pet Friendly", "TV"].map((amenity) => (
                      <label key={amenity} className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg cursor-pointer hover:bg-gray-200">
                        <input
                          type="checkbox"
                          checked={editingListing.amenities?.includes(amenity) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingListing({
                                ...editingListing,
                                amenities: [...(editingListing.amenities || []), amenity],
                              });
                            } else {
                              setEditingListing({
                                ...editingListing,
                                amenities: editingListing.amenities.filter((a) => a !== amenity),
                              });
                            }
                          }}
                          className="accent-[#FF5A1F]"
                        />
                        {amenity}
                      </label>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="House rules (No Smoking, No Pets...)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.houseRules || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, houseRules: e.target.value })
                    }
                  />

                  {/* Calendar Availability (Single Range Picker) */}
                  {editingListing && (
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <label className="font-medium text-gray-700">Calendar Availability</label>

                      <div className="w-full max-w-md mx-auto sm:mx-0">
                        <DateRange
                          editableDateInputs={true}
                          onChange={(item) => {
                            const start = item.selection.startDate;
                            const end = item.selection.endDate;

                            setEditingListing({
                              ...editingListing,
                              availabilityStart: start ? formatDateLocal(start) : "",
                              availabilityEnd: end ? formatDateLocal(end) : "",
                            });
                          }}
                          moveRangeOnFirstSelection={false}
                          ranges={[
                            {
                              startDate: editingListing.availabilityStart
                                ? new Date(editingListing.availabilityStart)
                                : new Date(),
                              endDate: editingListing.availabilityEnd
                                ? new Date(editingListing.availabilityEnd)
                                : new Date(),
                              key: "selection",
                            },
                          ]}
                          locale={enUS}
                          className="border rounded-lg w-full sm:w-auto"
                          direction="vertical" // ✅ vertical layout on mobile
                        />
                      </div>
                    </div>
                  )}

                </>
              )}

              {/* Experience & Service fields */}
              {editingListing.category === "experience" && (
                <>
                  <select
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-[#FF5A1F] w-full"
                    value={editingListing.experienceType || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, experienceType: e.target.value })
                    }
                  >
                    <option value="" disabled>Select experience type</option>
                    <option value="Tour">Tour</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Adventure">Adventure</option>
                    <option value="Class">Class</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Duration (e.g., 3 hours)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.duration || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, duration: e.target.value })
                    }
                  />
                  <input
                    type="number"
                    placeholder="Guest size limit"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.guestSize || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, guestSize: e.target.value })
                    }
                  />
                  <textarea
                    placeholder="What’s included (Equipment, Meals...)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none h-20 resize-none w-full"
                    value={editingListing.includes || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, includes: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Age range"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.skillLevel || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, skillLevel: e.target.value })
                    }
                  />
                  <textarea
                    placeholder="Safety notes (optional)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none h-20 resize-none w-full"
                    value={editingListing.safetyNotes || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, safetyNotes: e.target.value })
                    }
                  />
                  {/* Calendar Availability (Single Range Picker) */}
                  {editingListing && (
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <label className="font-medium text-gray-700">Calendar Availability</label>

                      <div className="w-full max-w-md mx-auto sm:mx-0">
                        <DateRange
                          editableDateInputs={true}
                          onChange={(item) => {
                            const start = item.selection.startDate;
                            const end = item.selection.endDate;

                            setEditingListing({
                              ...editingListing,
                              availabilityStart: start ? formatDateLocal(start) : "",
                              availabilityEnd: end ? formatDateLocal(end) : "",
                            });
                          }}
                          moveRangeOnFirstSelection={false}
                          ranges={[
                            {
                              startDate: editingListing.availabilityStart
                                ? new Date(editingListing.availabilityStart)
                                : new Date(),
                              endDate: editingListing.availabilityEnd
                                ? new Date(editingListing.availabilityEnd)
                                : new Date(),
                              key: "selection",
                            },
                          ]}
                          locale={enUS}
                          className="border rounded-lg w-full sm:w-auto"
                          direction="vertical" // ✅ vertical layout on mobile
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {editingListing.category === "service" && (
                <>
                  <select
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-[#FF5A1F] w-full"
                    value={editingListing.serviceType || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, serviceType: e.target.value })
                    }
                  >
                    <option value="" disabled>Select service type</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                    <option value="Grooming">Grooming</option>
                    <option value="Pet Care">Pet Care</option>
                    <option value="Fitness Program">Fitness Program</option>
                    <option value="Others">Others</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Duration / Session length (e.g., 2 hours)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.duration || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, duration: e.target.value })
                    }
                  />

                  <input
                    type="number"
                    placeholder="Guest size limit"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.guestSize || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, guestSize: e.target.value })
                    }
                  />

                  {/* Calendar Availability (Single Range Picker) */}
                  {editingListing && (
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <label className="font-medium text-gray-700">Calendar Availability</label>

                      <div className="w-full max-w-md mx-auto sm:mx-0">
                        <DateRange
                          editableDateInputs={true}
                          onChange={(item) => {
                            const start = item.selection.startDate;
                            const end = item.selection.endDate;

                            setEditingListing({
                              ...editingListing,
                              availabilityStart: start ? formatDateLocal(start) : "",
                              availabilityEnd: end ? formatDateLocal(end) : "",
                            });
                          }}
                          moveRangeOnFirstSelection={false}
                          ranges={[
                            {
                              startDate: editingListing.availabilityStart
                                ? new Date(editingListing.availabilityStart)
                                : new Date(),
                              endDate: editingListing.availabilityEnd
                                ? new Date(editingListing.availabilityEnd)
                                : new Date(),
                              key: "selection",
                            },
                          ]}
                          locale={enUS}
                          className="border rounded-lg w-full sm:w-auto"
                          direction="vertical" // ✅ vertical layout on mobile
                        />
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Materials / Requirements (e.g., Client provides laptop)"
                    className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none w-full"
                    value={editingListing.materials || ""}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, materials: e.target.value })
                    }
                  />
                </>
              )}

              {/* Description — Common to All */}
              <textarea
                placeholder="Enter a detailed description of your listing"
                className="border border-gray-300 px-4 py-2.5 rounded-lg outline-none h-24 resize-none w-full"
                value={editingListing.description || ""}
                onChange={(e) =>
                  setEditingListing({ ...editingListing, description: e.target.value })
                }
                required
              />

              {/* Images */}
              <div>
                <label className="text-sm font-medium mb-2 block">Images</label>

                {/* Existing thumbnails */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {(editingListing.images || []).map((img, idx) => (
                    <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden shadow-sm">
                      <img src={img} alt={`img-${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (editingListing.images || []).filter((_, i) => i !== idx);
                          setEditingListing({ ...editingListing, images: updated });
                        }}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 text-xs hover:bg-black/70"
                        title="Remove image"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>

                {/* New selected files */}
                {editingImageFiles && editingImageFiles.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {editingImageFiles.map((file, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden shadow-sm">
                        <img src={URL.createObjectURL(file)} alt={`new-${i}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = editingImageFiles.filter((_, j) => j !== i);
                            setEditingImageFiles(filtered);
                          }}
                          className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 text-xs hover:bg-black/70"
                          title="Remove selected"
                        >
                          ✖
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* File input */}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setEditingImageFiles(Array.from(e.target.files))}
                  className="border border-gray-300 px-3 py-2 rounded-lg w-full"
                />
                <p className="text-xs text-gray-500 mt-2">You can remove existing images with the trash icon. New images will be uploaded and appended when you save.</p>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4">
                <button
                  type="submit"
                  className="flex-1 bg-[#FF5A1F] text-white py-3 rounded-lg font-semibold hover:bg-[#e04e1a] transition duration-300"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingImageFiles([]);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition duration-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Listings;
