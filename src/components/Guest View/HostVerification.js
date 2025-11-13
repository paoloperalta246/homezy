import React, { useState, useRef } from "react";
import { Check, Shield, Star, Sparkles, ArrowRight, ArrowLeft, Lock, Users, TrendingUp } from "lucide-react";
import logo from "./homezy-logo.png";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import axios from "axios";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getEmailEndpoint } from "../../utils/api";

export default function HostVerification() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [plan, setPlan] = useState("pro");
  const [acceptedCompliance, setAcceptedCompliance] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [createdUserUid, setCreatedUserUid] = useState(null); // Store UID after user creation
  const onApproveRanRef = useRef(false); // Prevent PayPal onApprove double-run
  const emailSendInFlightRef = useRef(false); // Prevent duplicate email send
  const navigate = useNavigate();

  // Define this at the top of your component, before the return statement
  const priceMap = {
    basic: 500,
    pro: 1200,
    premium: 4500,
  };


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePlanChange = (planId) => setPlan(planId);

  const createFirebaseUser = async () => {
    try {
      console.log("🔵 Creating Firebase user account...");
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;
      const userUid = user.uid;
      console.log("✅ User account created:", userUid);

      // Create initial Firestore doc
      console.log("🔵 Creating initial Firestore document...");
      await setDoc(doc(db, "hosts", userUid), {
        uid: userUid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone,
        timestamp: new Date(),
        subscriptionPlan: null,
        subscriptionPrice: null,
        paymentId: null,
        paymentStatus: null,
        verified: false, // Will be set to true after email verification
      });
      console.log("✅ Firestore document created");

      // ⚠️ CRITICAL: Sign out immediately to prevent Firebase from auto-sending verification email
      console.log("🔵 Signing out user to prevent auto-verification email...");
      await signOut(auth);
      console.log("✅ User signed out - will only receive custom verification email");

      return userUid; // Return the UID instead of user object
    } catch (err) {
      console.error("❌ Error creating user:", err);
      throw err;
    }
  };

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    if (!acceptedCompliance) {
      setError("You must accept the compliance and regulatory terms.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters!");
      return;
    }
    if (!paymentSuccess) {
      setError("Please complete the subscription payment first.");
      return;
    }

    // Simulate registration
    setMessage("Registration successful! Check your email for verification.");
    setTimeout(() => {
      setFormData({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setAcceptedCompliance(false);
      setPlan("pro");
      setPaymentSuccess(false);
      setCurrentStep(1);
    }, 3000);
  };

  const subscriptionPlans = [
    {
      id: "basic",
      name: "Basic",
      price: 10,
      period: "month",
      description: "Perfect for getting started",
      features: ["Up to 5 property listings", "Basic analytics dashboard", "Email support within 48hrs", "Standard listing visibility"],
      icon: Shield,
      popular: false,
      savings: null
    },
    {
      id: "pro",
      name: "Pro",
      price: 25,
      period: "3 months",
      description: "Most popular for serious hosts",
      features: ["Up to 20 property listings", "Advanced analytics & insights", "Priority support within 24hrs", "Enhanced listing visibility", "Marketing tools access"],
      icon: Star,
      popular: true,
      savings: "Save ₱259.00"
    },
    {
      id: "premium",
      name: "Premium",
      price: 90,
      period: "year",
      description: "Maximum value for professionals",
      features: ["Unlimited property listings", "Premium analytics suite", "24/7 dedicated phone support", "Featured homepage placement", "Full marketing automation", "Personal account manager"],
      icon: Sparkles,
      popular: false,
      savings: "Save ₱799.00"
    },
  ];

  const steps = [
    { number: 1, title: "Your Details", description: "Basic information" },
    { number: 2, title: "Choose Plan", description: "Select subscription" },
    { number: 3, title: "Payment", description: "Secure checkout" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-20"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 sm:mb-6">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl">H</div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-snug sm:leading-tight">
              Become a Host with<br />
              <span className="text-white/90">Homezy Today</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-orange-50 mb-6 sm:mb-8 leading-relaxed">
              Join 10,000+ hosts who are earning extra income by sharing their spaces. Set your own prices, accept bookings on your terms, and get paid securely.
            </p>

            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="font-medium">Verified & Secure</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="font-medium">10K+ Active Hosts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="font-medium">$2.5M+ Earned</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <React.Fragment key={step.number}>
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg transition-all ${currentStep >= step.number
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-400'
                    }`}>
                    {currentStep > step.number ? <Check className="w-6 h-6" /> : step.number}
                  </div>
                  <div className="hidden sm:block">
                    <div className={`font-semibold ${currentStep >= step.number ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.title}
                    </div>
                    <div className="text-sm text-gray-500">{step.description}</div>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-4 rounded-full transition-all ${currentStep > step.number ? 'bg-orange-500' : 'bg-gray-200'
                    }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Step 1: Personal Information */}
        {currentStep === 1 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-6">
                <h2 className="text-2xl font-bold text-white">Your Information</h2>
                <p className="text-orange-50 mt-1">Let's start with the basics</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">First Name *</label>
                    <input
                      name="firstName"
                      type="text"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Last Name *</label>
                    <input
                      name="lastName"
                      type="text"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-gray-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Email Address *</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Phone Number</label>
                  <input
                    name="phone"
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Password *</label>
                  <input
                    name="password"
                    type="password"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-gray-900"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-2">Must be at least 6 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Confirm Password *</label>
                  <input
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-gray-900"
                    required
                  />
                </div>
                <button
                  onClick={() => {
                    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.confirmPassword) {
                      alert("❌ Please fill out all required fields before continuing!");
                      return;
                    }
                    if (formData.password !== formData.confirmPassword) {
                      alert("❌ Passwords do not match!");
                      return;
                    }
                    setCurrentStep(2);
                  }}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-4 rounded-xl hover:from-orange-600 hover:to-amber-600 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  Continue to Plans
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Back button */}
                <button
                  onClick={() => navigate("/homes")}
                  className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold py-4 rounded-xl hover:bg-gray-50 transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Choose Plan */}
        {currentStep === 2 && (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Choose Your Plan</h2>
              <p className="text-lg text-gray-600">Select the perfect plan for your hosting journey</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {subscriptionPlans.map((p) => {
                const IconComponent = p.icon;

                const pricePHP = priceMap[p.id].toLocaleString();

                return (
                  <div
                    key={p.id}
                    onClick={() => handlePlanChange(p.id)}
                    className={`relative cursor-pointer rounded-2xl border-2 transition-all transform hover:scale-105 ${plan === p.id
                      ? "border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 shadow-2xl"
                      : "border-gray-200 bg-white hover:border-orange-200 shadow-lg hover:shadow-xl"
                      } ${p.popular ? 'md:-mt-4 md:mb-4' : ''}`}
                  >
                    {p.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-full shadow-lg">
                        MOST POPULAR
                      </div>
                    )}

                    {p.savings && (
                      <div className="absolute top-4 right-4 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                        {p.savings}
                      </div>
                    )}

                    <div className="p-8">
                      <div className={`inline-flex p-3 rounded-xl mb-4 ${plan === p.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                        <IconComponent className="w-6 h-6" />
                      </div>

                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{p.name}</h3>
                      <p className="text-gray-600 text-sm mb-6">{p.description}</p>

                      <div className="mb-6">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-gray-900">₱{pricePHP}.00</span>
                          <span className="text-gray-600">/ {p.period}</span>
                        </div>
                      </div>

                      <ul className="space-y-3 mb-8">
                        {p.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                              <Check className="w-3 h-3 text-green-600" />
                            </div>
                            <span className="text-sm text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className={`w-full py-3 rounded-xl font-semibold text-center transition ${plan === p.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                        }`}>
                        {plan === p.id ? 'Selected' : 'Select Plan'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4 max-w-2xl mx-auto">
              <button
                onClick={() => setCurrentStep(1)}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold py-4 rounded-xl hover:bg-gray-50 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>

              <button
                onClick={async () => {
                  try {
                    // Validate fields first
                    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.confirmPassword) {
                      alert("❌ Please fill out all required fields before continuing!");
                      return;
                    }
                    if (formData.password !== formData.confirmPassword) {
                      alert("❌ Passwords do not match!");
                      return;
                    }

                    // ✅ Create Firebase user before payment and store the UID
                    const userUid = await createFirebaseUser();
                    setCreatedUserUid(userUid); // Store the UID for later use

                    setCurrentStep(3); // now move to payment
                  } catch (err) {
                    alert("❌ Could not create user. " + err.message);
                  }
                }}
                className="w-full sm:flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-4 rounded-xl hover:from-orange-600 hover:to-amber-600 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                Continue to Payment
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payment & Compliance */}
        {currentStep === 3 && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Selected Plan Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                  <div className="font-semibold text-gray-900">
                    {subscriptionPlans.find(p => p.id === plan)?.name} Plan
                  </div>
                  <div className="text-sm text-gray-600">
                    {subscriptionPlans.find(p => p.id === plan)?.period}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  ₱{priceMap[plan].toLocaleString()}.00
                </div>
              </div>
              <div className="flex items-center justify-between pt-4">
                <span className="font-semibold text-gray-900">Total Due Today</span>
                <span className="text-2xl font-bold text-orange-600">
                  ₱{priceMap[plan].toLocaleString()}.00
                </span>
              </div>
            </div>

            {/* Payment Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-6">
                <div className="flex items-center gap-3">
                  <Lock className="w-6 h-6 text-white" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Secure Payment</h2>
                    <p className="text-orange-50 mt-1">Your payment is protected by PayPal</p>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {paymentSuccess ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-6">
                      <Check className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
                    <p className="text-gray-600">Your subscription has been activated</p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-4">
                        <Lock className="w-12 h-12 mx-auto" />
                      </div>
                      <p className="text-gray-600 font-medium mb-4">
                        Complete your subscription via PayPal
                      </p>

                      {/* 🔹 PayPal Checkout Section */}
                      <div className="relative z-10 mt-4 flex justify-center">
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
                              return actions.resolve();
                            }}
                            createOrder={(data, actions) => {
                              return actions.order.create({
                                purchase_units: [
                                  {
                                    description: `${subscriptionPlans.find(p => p.id === plan)?.name} Plan`,
                                    amount: {
                                      value: priceMap[plan].toString(), // Use PHP priceMap
                                      currency_code: "PHP",
                                    },
                                  },
                                ],
                              });
                            }}

                            onApprove={async (data, actions) => {
                              try {
                                // Prevent double execution
                                if (onApproveRanRef.current) {
                                  console.log("⚠️ onApprove already processed. Ignoring duplicate callback.");
                                  return;
                                }
                                onApproveRanRef.current = true;

                                const details = await actions.order.capture();
                                console.log("✅ PayPal Payment Details:", details);

                                // Use the stored UID (user was signed out after creation)
                                if (!createdUserUid) {
                                  throw new Error("User UID not found. Please try again.");
                                }

                                console.log("🔵 Step 1: Saving subscription to Firestore...");
                                // ✅ Save subscription + user info in "hosts" ONLY
                                await setDoc(doc(db, "hosts", createdUserUid), {
                                  subscriptionPlan: plan,
                                  subscriptionPrice: priceMap[plan],
                                  paymentId: details.id,
                                  paymentStatus: details.status || "COMPLETED",
                                  updatedAt: serverTimestamp(),

                                  uid: createdUserUid,
                                  firstName: formData.firstName,
                                  lastName: formData.lastName,
                                  fullName: `${formData.firstName} ${formData.lastName}`.trim(),
                                  email: formData.email,
                                  phone: formData.phone,
                                  timestamp: new Date(),
                                  verified: false, // Will be set to true after email verification
                                }, { merge: true });
                                console.log("✅ Step 1: Subscription saved successfully");

                                console.log("🔵 Step 2: Sending verification email...");
                                if (emailSendInFlightRef.current) {
                                  console.log("⚠️ Email send already in-flight. Skipping duplicate send.");
                                } else {
                                  emailSendInFlightRef.current = true;
                                // Send verification email
                                const emailResponse = await axios.post(getEmailEndpoint('verification'), {
                                  email: formData.email,
                                  fullName: `${formData.firstName} ${formData.lastName}`.trim(),
                                });
                                
                                if (!emailResponse.data.success) {
                                  throw new Error("Failed to send verification email: " + (emailResponse.data.error || "Unknown error"));
                                }
                                console.log("✅ Step 2: Verification email sent successfully");
                                }

                                // ✅ Set message & success state
                                setMessage(
                                  "✅ Payment successful! A verification email has been sent. Please check your inbox before logging in."
                                );
                                setPaymentSuccess(true);

                              } catch (error) {
                                console.error("❌ Payment/Subscription/Error:", error);
                                
                                // Provide more specific error messages
                                let errorMessage = "❌ Payment processed but failed to complete registration. ";
                                if (error.message.includes("UID not found")) {
                                  errorMessage += "User session expired. Please refresh and try again. ";
                                } else if (error.message.includes("verification email")) {
                                  errorMessage += "Failed to send verification email. Please try again or contact support. ";
                                } else if (error.message.includes("Firestore")) {
                                  errorMessage += "Failed to save subscription data. ";
                                } else {
                                  errorMessage += error.message + " ";
                                }
                                errorMessage += "Contact support for assistance.";
                                
                                alert(errorMessage);
                                setError(errorMessage);
                              }
                            }}


                            onError={(err) => {
                              console.error("PayPal Error:", err);
                              alert("❌ Payment failed. Please try again.");
                            }}
                          />

                          {paymentSuccess && (
                            <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-lg">
                              ✅ Payment received. Subscription confirmed!
                            </div>
                          )}
                        </PayPalScriptProvider>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Compliance */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <h3 className="font-semibold text-gray-900 mb-4">Terms & Compliance</h3>
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className="flex-shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={acceptedCompliance}
                    onChange={() => setAcceptedCompliance(!acceptedCompliance)}
                    className="w-6 h-6 text-orange-500 border-gray-300 rounded-lg focus:ring-orange-500 cursor-pointer"
                  />
                </div>
                <span className="text-gray-700 leading-relaxed">
                  I have read and accept the{" "}
                  <a href="/compliance" target="_blank" className="text-orange-600 font-semibold hover:underline">
                    compliance and regulatory terms
                  </a>. I understand my responsibilities as a Homezy host and agree to follow all platform guidelines.
                </span>
              </label>
            </div>

            {/* Messages */}
            {message && (
              <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 flex items-start gap-4">
                <Check className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-green-800 font-medium">{message}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6">
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row gap-4">
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold py-4 rounded-xl hover:bg-gray-50 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>

              <button
                onClick={handleSubmit}
                className="w-full sm:flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-4 rounded-xl hover:from-orange-600 hover:to-amber-600 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                Complete Registration
                <Check className="w-5 h-5" />
              </button>
            </div>

          </div>
        )}
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

        {/* © Bottom Text */}
        <div className="border-t border-gray-700 mt-10 pt-5 text-center text-sm text-gray-500">
          © 2025 Homezy | All Rights Reserved
        </div>
      </footer>
    </div>
  );
}
