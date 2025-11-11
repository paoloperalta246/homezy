import React, { useState, useEffect, useRef } from "react";
import logo from "./homezy-logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase"; // ✅ include db
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  doc,
} from "firebase/firestore"; // ✅ Firestore imports
import defaultProfile from "./images/default-profile.png";
import pine from "./images/pine.png";
import summit from "./images/summit.png";
import westwind from "./images/westwind.png";
import citylights from "./images/citylights.png";
import forest from "./images/forest.png";
import lounge from "./images/lounge.png";
import mountain from "./images/mountain.png";
import hilltop from "./images/hilltop.png";

const BC = () => {
  const location = useLocation();
        const navigate = useNavigate();
        const [dropdownOpen, setDropdownOpen] = useState(false);
        const dropdownRef = useRef(null);
        const [user, setUser] = useState(null);
        const [wishlist, setWishlist] = useState([]);
      
        // 🔥 Track user login + fetch wishlist from Firestore
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
      
        // ❤️ Handle wishlist toggle
        const handleWishlist = async (item) => {
          if (!user) {
            alert("Please log in to add to favorites!");
            navigate("/login");
            return;
          }
      
          const existing = wishlist.find((fav) => fav.name === item.name);
      
          if (existing) {
            // Remove from Firestore
            await deleteDoc(doc(db, "wishlists", existing.id));
            setWishlist(wishlist.filter((fav) => fav.id !== existing.id));
            alert("Removed from favorites 💔");
          } else {
            // Add to Firestore
            const docRef = await addDoc(collection(db, "wishlists"), {
              userId: user.uid,
              name: item.name,
              desc: item.desc,
              price: item.price,
              image: item.image,
              rating: item.rating,
            });
            setWishlist([...wishlist, { id: docRef.id, ...item }]);
            alert("Added to favorites ❤️");
          }
        };
      
        // 🧡 Check if in wishlist
        const isFavorited = (item) => wishlist.some((fav) => fav.name === item.name);

  // 🌆 Apartments in Baguio City
  const baguioCity = [
    {
      name: "Pine Ridge Studio",
      desc: "Cozy studio unit nestled in the pine trees of Camp John Hay.",
      price: "₱2,800.00 / night",
      rating: "4.5",
      image: pine,
    },
    {
      name: "Summit View Condo",
      desc: "One-bedroom high-rise with mountain vistas, near Strawberry Farm roads.",
      price: "₱3,900.00 / night",
      rating: "4.6",
      image: summit,
    },
    {
      name: "Westwind Loft",
      desc: "Loft-style 2-bedroom apartment in a quiet subdivision, perfect for groups.",
      price: "₱4,500.00 / night",
      rating: "4.7",
      image: westwind,
    },
    {
      name: "CityLights 1BR",
      desc: "Modern one-bedroom unit near the city centre, easy access to cafés & nightlife.",
      price: "₱3,200.00 / night",
      rating: "4.4",
      image: citylights,
    },
  ];

  // 🌆 Additional Apartments in Baguio City
  const baguioCity2 = [
    {
      name: "Forest Glade Suite",
      desc: "Spacious suite with scenic forest view which includes a kitchenette.",
      price: "₱5,600.00 / night",
      rating: "4.8",
      image: forest,
    },
    {
      name: "Lounge & Stay",
      desc: "Boutique apartment near schools & restaurants, ideal for travellers.",
      price: "₱3,300.00 / night",
      rating: "4.5",
      image: lounge,
    },
    {
      name: "Mountain Retreat Condo",
      desc: "Deluxe 2-bedroom unit with modern amenities and pine-scented ambiance.",
      price: "₱4,100.00 / night",
      rating: "4.7",
      image: mountain,
    },
    {
      name: "Hilltop Hideaway",
      desc: "Peaceful hideaway on a hilltop, short drive to Burnham and city centre.",
      price: "₱2,900.00 / night",
      rating: "4.3",
      image: hilltop,
    },
  ];

  // 🏠 Card Component (unchanged)
  const renderCard = (item) => (
    <div className="bg-white rounded-2xl shadow-lg hover:-translate-y-1 transition-transform duration-300 text-left w-72 relative">
      <button
        onClick={() => handleWishlist(item)}
        className="absolute top-3 right-3 text-2xl"
      >
        {isFavorited(item) ? "🧡" : "🤍"}
      </button>

      <div className="w-full h-44 rounded-t-2xl overflow-hidden">
        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
      </div>

      <div className="p-5">
        <h3 className="font-bold text-gray-800 text-lg mb-1">{item.name}</h3>
        <p className="text-sm text-gray-500 mb-3 leading-relaxed">{item.desc}</p>
        <div className="flex justify-between items-center">
          <p className="flex items-center text-yellow-400 font-semibold text-sm">
            ⭐ <span className="text-gray-700 ml-1">{item.rating}</span>
          </p>
          <p className="font-bold text-gray-800">{item.price}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="font-sans bg-[#fefefe] min-h-screen">
      {/* 🧭 NAVBAR */}
      <header className="sticky top-0 left-0 w-full flex items-center justify-between px-12 py-6 z-20 bg-white shadow-sm">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <img src={logo} alt="Homezy Logo" className="w-10 h-10 object-contain" />
          <h1 className="text-[#0B2545] text-2xl font-bold">Homezy</h1>
        </Link>

        <div className="flex items-center gap-8 text-[#0B2545] font-medium text-sm">
          <Link
            to="/homes"
            className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-300 transition-colors duration-300 ${
              location.pathname === "/homes"
                ? "after:w-full"
                : "after:w-0 hover:after:w-full"
            }`}
          >
            Homes
          </Link>

          <Link
            to="/experiences"
            className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-300 transition-colors duration-300 ${
              location.pathname === "/experiences"
                ? "after:w-full"
                : "after:w-0 hover:after:w-full"
            }`}
          >
            Experiences
          </Link>

          <Link
            to="/services"
            className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-orange-500 after:transition-all after:duration-300 transition-colors duration-300 ${
              location.pathname === "/services"
                ? "after:w-full"
                : "after:w-0 hover:after:w-full"
            }`}
          >
            Services
          </Link>

          <button
              onClick={() => navigate('/host-verification')}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-md transition"
            >
              Become a Host
            </button>

          {/* 👤 Guest Dropdown */}
<div className="relative" ref={dropdownRef}>
  <button
    onClick={() => {
      if (!user) {
        navigate("/login");
      } else {
        setDropdownOpen(!dropdownOpen); // toggle dropdown for logged-in user
      }
    }}
    className="flex items-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium hover:bg-gray-300 transition"
  >
    {!user ? (
      <>
        {/* Small profile icon */}
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
        <span>Log In or Sign Up</span>
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
    <div className="absolute right-0 mt-2 w-44 bg-white shadow-lg rounded-lg overflow-hidden z-40">
      <button
        onClick={() => {
          setDropdownOpen(false);
          navigate("/edit-profile");
        }}
        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
      >
        Edit Profile
      </button>
      <button
        onClick={() => {
          setDropdownOpen(false);
          navigate("/bookings");
        }}
        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
      >
        Bookings
      </button>
      <button
        onClick={() => {
          setDropdownOpen(false);
          navigate("/favorites");
        }}
        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
      >
        Favorites
      </button>
      <button
        onClick={async () => {
          await signOut(auth);
          setDropdownOpen(false);
          navigate("/login");
        }}
        className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-100 transition"
      >
        Logout
      </button>
    </div>
  )}
          </div>
        </div>
      </header>

      {/* 🔍 Search Section */}
      <section className="mt-10 flex justify-center">
        <div className="mt-6 bg-white/90 backdrop-blur-md rounded-lg shadow-lg w-[90%] max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col justify-center px-4 py-2 border-r border-gray-300 w-1/4">
              <span className="text-sm font-semibold text-gray-700">Location</span>
              <span className="text-gray-500 text-sm">Select location ▼</span>
            </div>

            <div className="flex flex-col justify-center px-4 py-2 border-r border-gray-300 w-1/4">
              <span className="text-sm font-semibold text-gray-700">Check In</span>
              <span className="text-gray-500 text-sm">Add date ▼</span>
            </div>

            <div className="flex flex-col justify-center px-4 py-2 border-r border-gray-300 w-1/4">
              <span className="text-sm font-semibold text-gray-700">Check Out</span>
              <span className="text-gray-500 text-sm">Add date ▼</span>
            </div>

            <div className="flex flex-col justify-center px-4 py-2 w-1/4">
              <span className="text-sm font-semibold text-gray-700">Add Guests</span>
              <span className="text-gray-500 text-sm">Add guests ▼</span>
            </div>

            <button className="ml-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-md transition whitespace-nowrap">
              Search
            </button>
          </div>
        </div>
      </section>

      {/* 🌆 Apartments in Baguio City */}
      <section className="max-w-screen-xl mx-auto mt-14 px-6">
        <div className="grid grid-cols-3 items-center mb-4">
          {/* ← Go Back Button */}
          <button
            onClick={() => navigate("/homes")}
            className="text-sm font-semibold text-[#0B2545] hover:text-orange-500 transition text-left"
          >
            ← Go back
          </button>

          {/* Center Title */}
          <h2 className="text-3xl font-bold text-[#0B2545] text-center">
            Apartments in Baguio City
          </h2>

          {/* Empty div to keep layout balanced */}
          <div />
        </div>

        <div className="w-32 border-b-2 border-orange-500 mx-auto mb-8"></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 justify-items-center">
          {baguioCity.map((item, i) => (
            <div key={i}>{renderCard(item)}</div>
          ))}
        </div>
      </section>

      {/* 🌆 Apartments in Baguio City */}
      <section className="max-w-screen-xl mx-auto mt-14 mb-20 px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 justify-items-center">
          {baguioCity2.map((item, i) => (
            <div key={i}>{renderCard(item)}</div>
          ))}
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
                href="https://www.instagram.com/onlysuhi_/"
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
                href="https://twitter.com/onlysuhi_"
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
};

export default BC;
