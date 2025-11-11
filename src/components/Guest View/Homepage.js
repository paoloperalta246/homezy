import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import defaultProfile from "./images/default-profile.png";
import logo from "./homezy-logo.png";
import heroVideo from "./images/background-video.mp4"; // 🎥 video import
import houseIcon from "./images/house.png";
import computerIcon from "./images/computer.png";
import moneyIcon from "./images/money.png";
import medicsIcon from "./images/medics.png";
import topBookings from "./images/our-top-bookings.png";
import testimonialBg from "./images/testimonial.png";
import sebastian from "./images/sebastian.png";
import sofia from "./images/sofia.png";
import alexander from "./images/alexander.png";
import high from "./images/high-park.png";
import pacific from "./images/pacific-plaza-towers.jpg";
import nivel from "./images/nivel.png";
import forest from "./images/forest.png";
import cresmont from "./images/cresmont.png";
import greenbelt from "./images/greenbelt.png";
import rise from "./images/rise.png";
import mountain from "./images/mountain.png";
import { User, Calendar, Heart, LogOut, MessageCircle, Menu, X } from "lucide-react";

export default function Homepage() {
  const [scrolled, setScrolled] = useState(false);
  const guestRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownMenuRef = useRef(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownButtonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // If dropdown is open and click is outside both button and menu
      if (
        dropdownOpen &&
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(event.target) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);



  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="w-full flex flex-col font-inter text-gray-800">
      {/* 🌅 HERO SECTION */}
      <section className="relative h-screen flex flex-col justify-center items-center text-center text-white overflow-hidden">
        {/* 🎥 Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover"
        >
          <source src={heroVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* 🧭 Overlay */}
        <div className="absolute inset-0 bg-black/40"></div>

        {/* 🧭 FIXED NAVBAR */}
        <nav
          className={`fixed top-0 left-0 w-full flex items-center justify-between px-6 sm:px-12 py-4 sm:py-6 z-30 transition-all duration-300 ${scrolled ? "bg-black/70 backdrop-blur-md shadow-md" : "bg-transparent"
            }`}
        >
          {/* 🏠 Logo */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="Homezy Logo" className="w-9 h-9 object-contain" />
            <h1 className="text-white text-2xl font-bold">Homezy</h1>
          </div>

          {/* 🍔 Hamburger Icon (mobile only) */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden text-white focus:outline-none"
          >
            {menuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>

          {/* 🧭 Desktop Nav */}
          <div className="hidden sm:flex items-center gap-8 text-white font-medium text-sm">
            <div className="flex items-center gap-6">
              <Link
                to="/homes"
                className="relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-300 hover:after:w-full"
              >
                Homes
              </Link>
              <Link
                to="/experiences"
                className="relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-300 hover:after:w-full"
              >
                Experiences
              </Link>
              <Link
                to="/services"
                className="relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-300 hover:after:w-full"
              >
                Services
              </Link>
            </div>

            <button
              onClick={() => navigate("/host-verification")}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-md transition"
            >
              Become a Host
            </button>

            {/* 👤 Profile Dropdown */}
            <div className="relative flex-shrink-0"> {/* ✅ flex-shrink-0 lets button grow */}
              <button
                ref={dropdownButtonRef}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="inline-flex items-center gap-2 bg-white/80 text-gray-800 px-3 py-2 rounded-md font-medium hover:bg-white transition w-fit"

              // ✅ min-w bigger, w-auto
              >
                {user ? (
                  <>
                    <img
                      src={user.photoURL || defaultProfile}
                      alt="profile"
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span className="whitespace-nowrap overflow-visible">{user.displayName || "User"}</span>
                    {/* ✅ overflow-visible ensures full name shows */}
                  </>
                ) : (
                  <>
                    <User className="w-5 h-5" />
                    <span
                      onClick={() => navigate("/login")}
                      className="cursor-pointer text-sm whitespace-nowrap overflow-visible"
                    >
                      Log In or Sign Up
                    </span>
                  </>
                )}
              </button>

              {user && dropdownOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-visible z-[9999]">
                  <div className="p-3 border-b border-gray-100 flex items-center gap-3">
                    <img
                      src={user.photoURL || defaultProfile}
                      alt="profile"
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                    <div className="min-w-0 flex-1">
                      {/* ✅ allows text to expand without being cut */}
                      <p className="text-gray-800 font-semibold text-sm break-words">
                        {user.displayName || "Guest User"}
                      </p>
                      <p className="text-xs text-gray-500 break-all">{user.email}</p>
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
              )}
            </div>
          </div>

          {/* 📱 Mobile Menu */}
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute top-full left-0 w-full bg-black/90 text-white flex flex-col items-center gap-4 py-6 sm:hidden transition-all duration-300"
            >
              <Link to="/homes" onClick={() => setMenuOpen(false)} className="hover:text-orange-400">
                Homes
              </Link>
              <Link to="/experiences" onClick={() => setMenuOpen(false)} className="hover:text-orange-400">
                Experiences
              </Link>
              <Link to="/services" onClick={() => setMenuOpen(false)} className="hover:text-orange-400">
                Services
              </Link>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/host-verification");
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-md transition"
              >
                Become a Host
              </button>

              {user ? (
                <>
                  <Link to="/guest-profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
                    <User className="w-4 h-4 text-orange-500" /> Profile
                  </Link>
                  <Link to="/bookings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-500" /> Bookings
                  </Link>
                  <Link to="/guest-messages" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-orange-500" /> Messages
                  </Link>
                  <Link to="/favorites" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-orange-500" /> Favorites
                  </Link>

                  <button
                    onClick={async () => {
                      await signOut(auth);
                      setMenuOpen(false);
                      navigate("/login");
                    }}
                    className="flex items-center gap-2 text-red-400 hover:text-red-500 transition"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/login");
                  }}
                  className="bg-white/80 text-gray-800 px-3 py-2 rounded-md font-medium hover:bg-white transition w-auto inline-flex justify-center"

                >
                  Log In or Sign Up
                </button>
              )}
            </div>
          )}
        </nav>

        {/* 🏖 HERO CONTENT */}
        <div className="relative z-10 max-w-3xl px-4 mt-20 sm:mt-28">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold leading-tight mb-4">
            Manage and Book Spaces Effortlessly
          </h1>
          <p className="text-base sm:text-lg text-gray-200 mb-8">
            Connect, book, and manage with ease — all in one platform.
          </p>
          <Link
            to="/homes"
            className="inline-block bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-md font-semibold text-white transition"
          >
            Start browsing →
          </Link>
        </div>
      </section>

      {/* 🧩 SERVICES SECTION */}
      <section className="py-16 sm:py-24 bg-white text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-gray-800">
          Everything You Need For The Perfect Stay
        </h2>
        <p className="text-gray-500 mb-10 text-base max-w-xl mx-auto">
          Find comfort, safety, and style wherever you go.
        </p>
        <div className="h-1 w-24 bg-orange-500 mx-auto mb-14 rounded-full"></div>

        <div className="flex flex-wrap justify-center gap-6 sm:gap-10 px-4 sm:px-6">
          {[
            { img: houseIcon, title: "Verified & Trusted Stays", text: "Every listing is verified for safety and comfort — book with confidence." },
            { img: computerIcon, title: "Flexible Booking Made Easy", text: "Pick your dates, check in anytime, and manage bookings easily." },
            { img: moneyIcon, title: "Affordable Comfort", text: "Cozy, stylish homes that fit your budget — no hidden fees." },
            { img: medicsIcon, title: "24/7 Guest Support", text: "We’re here to help anytime, from booking to check-in." },
          ].map((card, i) => (
            <div key={i} className="bg-white w-full sm:w-64 shadow-lg rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-300 border border-gray-100">
              <img src={card.img} alt={card.title} className="w-12 h-12 mx-auto mb-5" />
              <h3 className="font-semibold text-lg mb-2 text-gray-800">{card.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
      </section>
      <br></br><br></br><br></br>

      {/* 🏙 OUR TOP BOOKINGS SECTION */}
      <section
        className="relative bg-cover bg-center py-16 sm:py-20"
        style={{ backgroundImage: `url(${topBookings})` }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
            Our Top Bookings
          </h2>
          <div className="w-20 h-[3px] bg-orange-500 mx-auto mt-6 sm:mt-10 rounded-full"></div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mt-10">
            {[ /* your booking data here */].map((place, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-lg hover:-translate-y-1 transition-transform duration-300 p-4 text-left"
              >
                <div className="bg-gray-200 w-full h-40 rounded-xl mb-4"></div>
                <div className="flex justify-between items-center mb-2 text-xs text-gray-600">
                  <span className="flex items-center gap-1">📅 12, September 2022</span>
                  <span>120+ People</span>
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-1">{place.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{place.desc}</p>
                <div className="flex justify-between items-center">
                  <p className="flex items-center text-yellow-400 font-semibold text-sm">
                    ⭐ <span className="text-gray-700 ml-1">{place.rating}</span>
                  </p>
                  <p className="font-bold text-gray-800">{place.price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 🏘️ TOP BOOKINGS CARDS BELOW IMAGE */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                img: high,
                title: "High Park Tower 2",
                desc: "Studio condo on the 47th floor, fully furnished, luxury tower with amenities.",
                rating: "4.9",
                price: "₱3,500.00 / night",
              },
              {
                img: pacific,
                title: "Pacific Plaza Towers",
                desc: "Exclusive twin towers in BGC offering elegant interiors and sweeping views.",
                rating: "4.8",
                price: "₱3,599.00 / night",
              },
              {
                img: nivel,
                title: "128 Nivel Hills Tower 1",
                desc: "High-rise condo with premium finishes and great views in Lahug area.",
                rating: "4.8",
                price: "₱5,200.00 / night",
              },
              {
                img: forest,
                title: "Forest Glade Suite",
                desc: "Spacious suite with scenic forest view which includes a kitchenette.",
                rating: "4.8",
                price: "₱5,600.00 / night",
              },
              {
                img: cresmont,
                title: "The Crestmont",
                desc: "Modern 57 sqm 2-BR unit in the heart of QC, near malls & transport hubs.",
                rating: "4.7",
                price: "₱4,600.00 / night",
              },
              {
                img: greenbelt,
                title: "The Residences at Greenbelt",
                desc: "Boutique luxury condo near Greenbelt Mall, Makati.",
                rating: "4.7",
                price: "₱4,100.00 / night",
              },
              {
                img: rise,
                title: "The Rise at Monterrazas",
                desc: "Boutique, nature-inspired living in Guadalupe with resort-style amenities.",
                rating: "4.7",
                price: "₱4,100.00 / night",
              },
              {
                img: mountain,
                title: "Mountain Retreat Condo",
                desc: "Deluxe 2-bedroom unit with modern amenities and pine-scented ambiance.",
                rating: "4.7",
                price: "₱4,100.00 / night",
              },
            ].map((place, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-lg hover:-translate-y-1 transition-transform duration-300 text-left"
              >
                <img
                  src={place.img}
                  alt={place.title}
                  className="w-full h-44 object-cover rounded-t-2xl"
                />
                <div className="p-5">
                  <div className="flex justify-between items-center mb-2 text-xs text-gray-600">
                    <span className="flex items-center gap-1">📅 12, September 2022</span>
                    <span>120+ People</span>
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg mb-1">{place.title}</h3>
                  <p className="text-sm text-gray-500 mb-3">{place.desc}</p>
                  <div className="flex justify-between items-center">
                    <p className="flex items-center text-yellow-400 font-semibold text-sm">
                      ⭐ <span className="text-gray-700 ml-1">{place.rating}</span>
                    </p>
                    <p className="font-bold text-gray-800">{place.price}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* 💬 SEE WHAT OUR CLIENTS SAY */}
      <section
        className="relative bg-cover bg-center py-20"
        style={{ backgroundImage: `url(${testimonialBg})` }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">
            See What Our Clients Say
          </h2>
          <p className="text-gray-200 text-sm md:text-base mb-6">
            Honest reviews from guests who’ve stayed with us.
          </p>
          <div className="w-24 h-[3px] bg-orange-500 mx-auto mb-14 rounded-full"></div>

          {/* Testimonials Row */}
          <div className="flex flex-wrap justify-center gap-8">
            {[
              {
                img: sebastian,
                name: "Sebastian",
                job: "Business Analyst",
                review:
                  "The place looked exactly like the photos! Super clean and comfy — felt just like home. Booking was quick and easy, too.",
              },
              {
                img: sofia,
                name: "Sofia Reyes",
                job: "Teacher",
                review:
                  "I stayed for a weekend trip in Quezon City. Great location and smooth check-in process. Would definitely book again!",
              },
              {
                img: alexander,
                name: "Alexander",
                job: "Freelance Photographer",
                review:
                  "Homezy made my stay hassle-free! Loved how friendly the host was and how everything was well-prepared!",
              },
            ].map((r, i) => (
              <div
                key={i}
                className="bg-white text-gray-800 w-80 rounded-2xl shadow-lg p-6"
              >
                <img
                  src={r.img}
                  alt={r.name}
                  className="w-16 h-16 rounded-full mx-auto mb-4 object-cover"
                />
                <h3 className="font-semibold text-gray-900">{r.name}</h3>
                <p className="text-xs text-gray-500 mb-3">{r.job}</p>
                <p className="text-gray-600 text-sm italic mb-4">"{r.review}"</p>
                <div className="text-orange-400 text-lg">★★★★★</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* 🦶 FOOTER */}
      <footer className="bg-gray-900 text-gray-300 py-14 px-8 md:px-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* 🏠 Brand Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src={logo} alt="Homezy" className="w-8 h-8" />
              <h1 className="text-white text-lg font-bold">Homezy</h1>
            </div>
            <p className="text-sm mb-4 leading-relaxed">
              Helping travelers feel at home, anywhere.
            </p>

            {/* 🌐 Social Media Icons */}
            <div className="flex gap-3">
              {/* Facebook */}
              <a
                href="https://www.facebook.com/paoloperalta246"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-full flex items-center justify-center transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-white"
                >
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 
            6.48 2 12c0 4.99 3.66 9.12 8.44 
            9.88v-6.99H8.9v-2.89h1.54V9.8c0-1.52.9-2.36 
            2.28-2.36.66 0 1.35.12 1.35.12v1.48h-.76c-.75 
            0-.98.47-.98.95v1.14h1.67l-.27 2.89h-1.4v6.99C18.34 
            21.12 22 16.99 22 12z" />
                </svg>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com/onlysuhi_/" // 👈 replace with your actual Instagram link
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-full flex items-center justify-center transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-white"
                >
                  <path d="M7.5 2C4.47 2 2 4.47 2 
            7.5v9C2 19.53 4.47 22 7.5 22h9c3.03 
            0 5.5-2.47 5.5-5.5v-9C22 4.47 19.53 
            2 16.5 2h-9zM12 8.5A3.5 3.5 0 1 1 8.5 
            12 3.5 3.5 0 0 1 12 8.5zm5.25-.75a.75.75 
            0 1 1-.75-.75.75.75 0 0 1 .75.75zM12 
            10a2 2 0 1 0 2 2 2 2 0 0 0-2-2z" />
                </svg>
              </a>

              {/* Twitter/X */}
              <a
                href="https://twitter.com/onlysuhi_" // 👈 replace with your actual Twitter link
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-700 hover:bg-orange-500 rounded-full flex items-center justify-center transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-white"
                >
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

          {/* 📦 Company */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>About Us</li>
              <li>Careers</li>
              <li>Blog</li>
              <li>Pricing</li>
            </ul>
          </div>

          {/* 🗺️ Destinations */}
          <div>
            <h3 className="text-white font-semibold mb-4">Destinations</h3>
            <ul className="space-y-2 text-sm">
              <li>Maldives</li>
              <li>Los Angeles</li>
              <li>Las Vegas</li>
              <li>Toronto</li>
            </ul>
          </div>

          {/* 📰 Newsletter */}
          <div>
            <h3 className="text-white font-semibold mb-4">Join Our Newsletter</h3>
            <div className="flex">
              <input
                type="email"
                placeholder="Your email address"
                className="px-3 py-2 w-full rounded-l-md text-gray-700 focus:outline-none"
              />
              <button className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-r-md text-white font-semibold">
                Subscribe
              </button>
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
}
