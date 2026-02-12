import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { loginUser, registerUser, initUsersTable, type LoginResult } from "@/lib/auth";
import { openDatabase, isDatabaseOpen } from "@/lib/db";
import Footer from "./Footer";

interface LoginProps {
  onLoginSuccess: (user: { id: number; username: string; email: string }) => void;
}

// Dari translations
const translations = {
  login: {
    title: "خوش آمدید",
    subtitle: "به حساب کاربری خود وارد شوید",
    username: "نام کاربری",
    password: "رمز عبور",
    submit: "ورود",
    processing: "در حال پردازش...",
    switchText: "حساب کاربری ندارید؟ ثبت نام کنید",
  },
  signup: {
    title: "ایجاد حساب کاربری",
    subtitle: "برای شروع ثبت نام کنید",
    username: "نام کاربری",
    email: "ایمیل",
    password: "رمز عبور",
    confirmPassword: "تأیید رمز عبور",
    submit: "ثبت نام",
    processing: "در حال پردازش...",
    switchText: "قبلاً حساب کاربری دارید؟ وارد شوید",
  },
  errors: {
    passwordMismatch: "رمزهای عبور مطابقت ندارند",
    passwordTooShort: "رمز عبور باید حداقل ۶ کاراکتر باشد",
    invalidCredentials: "نام کاربری یا رمز عبور نامعتبر است",
    registrationFailed: "ثبت نام با خطا مواجه شد",
    loginFailed: "ورود با خطا مواجه شد",
    generalError: "خطایی رخ داد",
  },
  success: {
    loginSuccess: "با موفقیت وارد شدید",
    registrationSuccess: "حساب کاربری با موفقیت ایجاد شد",
  },
  placeholders: {
    username: "نام کاربری خود را وارد کنید",
    email: "ایمیل خود را وارد کنید",
    password: "رمز عبور خود را وارد کنید",
    confirmPassword: "رمز عبور را تأیید کنید",
  },
};

// Floating particle component
function FloatingParticle({ delay, size, x, y, duration }: { delay: number; size: number; x: string; y: string; duration: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: `radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(59,130,246,0.1) 50%, transparent 70%)`,
      }}
      animate={{
        y: [0, -30, 0, 20, 0],
        x: [0, 15, -10, 5, 0],
        scale: [1, 1.2, 0.9, 1.1, 1],
        opacity: [0.3, 0.6, 0.4, 0.7, 0.3],
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        delay: delay,
        ease: "easeInOut",
      }}
    />
  );
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dbOpen = await isDatabaseOpen();
      if (!dbOpen) {
        await openDatabase("db");
      }

      try {
        await initUsersTable();
      } catch (err) {
        console.log("Table initialization:", err);
      }

      if (isLogin) {
        const result: LoginResult = await loginUser(username, password);
        if (result.success && result.user) {
          toast.success(translations.success.loginSuccess);
          setTimeout(() => {
            onLoginSuccess(result.user!);
          }, 500);
        } else {
          toast.error(result.message || translations.errors.invalidCredentials);
        }
      } else {
        if (password !== confirmPassword) {
          toast.error(translations.errors.passwordMismatch);
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          toast.error(translations.errors.passwordTooShort);
          setLoading(false);
          return;
        }

        const result: LoginResult = await registerUser(username, email, password);
        if (result.success && result.user) {
          toast.success(translations.success.registrationSuccess);
          setTimeout(() => {
            onLoginSuccess(result.user!);
          }, 1000);
        } else {
          toast.error(result.message || translations.errors.registrationFailed);
        }
      }
    } catch (err: any) {
      toast.error(err.toString() || translations.errors.generalError);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setPassword("");
    setConfirmPassword("");
  };

  const currentTranslations = isLogin ? translations.login : translations.signup;

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* === ANIMATED MESH GRADIENT BACKGROUND === */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div
          className="absolute inset-0 transition-all duration-1000"
          style={{
            background: `
              radial-gradient(ellipse at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(139,92,246,0.15) 0%, transparent 50%),
              radial-gradient(ellipse at ${100 - mousePos.x * 100}% ${100 - mousePos.y * 100}%, rgba(59,130,246,0.12) 0%, transparent 50%),
              linear-gradient(135deg, #0f0a1e 0%, #1a1035 25%, #0d1b2a 50%, #16103a 75%, #0a0e1a 100%)
            `,
          }}
        />

        {/* Animated mesh orbs */}
        <motion.div
          animate={{
            x: [0, 100, -50, 80, 0],
            y: [0, -80, 60, -40, 0],
            scale: [1, 1.3, 0.8, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(168,85,247,0.08) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <motion.div
          animate={{
            x: [0, -80, 60, -30, 0],
            y: [0, 60, -40, 80, 0],
            scale: [1, 0.9, 1.3, 0.85, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(99,102,241,0.06) 40%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <motion.div
          animate={{
            x: [0, 50, -80, 30, 0],
            y: [0, -50, 30, -60, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(236,72,153,0.12) 0%, rgba(244,114,182,0.04) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <FloatingParticle delay={0} size={6} x="10%" y="20%" duration={8} />
          <FloatingParticle delay={1} size={4} x="80%" y="15%" duration={10} />
          <FloatingParticle delay={2} size={8} x="25%" y="70%" duration={12} />
          <FloatingParticle delay={0.5} size={5} x="60%" y="40%" duration={9} />
          <FloatingParticle delay={3} size={3} x="90%" y="60%" duration={11} />
          <FloatingParticle delay={1.5} size={7} x="40%" y="85%" duration={7} />
          <FloatingParticle delay={2.5} size={4} x="70%" y="30%" duration={13} />
          <FloatingParticle delay={0.8} size={6} x="15%" y="50%" duration={10} />
        </div>
      </div>

      {/* === LEFT PANEL - BRANDING (hidden on mobile) === */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex w-1/2 relative items-center justify-center p-12"
      >
        <div className="relative z-10 max-w-lg text-center">
          {/* Animated Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.3, duration: 1 }}
            className="mx-auto mb-10 relative"
          >
            <div className="w-32 h-32 mx-auto relative">
              {/* Outer glow ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-3xl"
                style={{
                  background: "conic-gradient(from 0deg, #8b5cf6, #3b82f6, #ec4899, #8b5cf6)",
                  padding: "3px",
                }}
              >
                <div className="w-full h-full rounded-3xl bg-[#0f0a1e]" />
              </motion.div>

              {/* Logo container */}
              <div className="absolute inset-[6px] rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600 flex items-center justify-center overflow-hidden shadow-2xl shadow-purple-500/30">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Brand Name */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-6xl font-black mb-4 leading-tight"
            style={{
              background: "linear-gradient(135deg, #c084fc 0%, #818cf8 30%, #60a5fa 60%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            شفاف
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="text-xl text-purple-200/60 mb-8 leading-relaxed"
            dir="rtl"
          >
            سیستم هوشمند مدیریت مالی و حسابداری
          </motion.p>

          {/* Feature highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="space-y-4"
            dir="rtl"
          >
            {[
              { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", text: "امنیت بالا و رمزگذاری پیشرفته" },
              { icon: "M13 10V3L4 14h7v7l9-11h-7z", text: "عملکرد سریع و پاسخگویی آنی" },
              { icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", text: "گزارش‌دهی هوشمند با هوش مصنوعی" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + i * 0.15, duration: 0.5 }}
                className="flex items-center gap-3 text-purple-200/50"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                  </svg>
                </div>
                <span className="text-sm">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* === RIGHT PANEL - LOGIN/REGISTER FORM === */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Glassmorphism Card */}
          <div className="relative">
            {/* Animated border gradient */}
            <motion.div
              className="absolute -inset-[1px] rounded-[28px] z-0"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.5), rgba(59,130,246,0.3), rgba(236,72,153,0.4), rgba(139,92,246,0.5))",
              }}
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            />

            <div
              className="relative rounded-[27px] p-6 sm:p-8 z-10"
              style={{
                background: "linear-gradient(135deg, rgba(15,10,30,0.95) 0%, rgba(26,16,53,0.92) 50%, rgba(13,27,42,0.95) 100%)",
                backdropFilter: "blur(40px)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255,255,255,0.05)",
              }}
            >
              {/* Mobile Logo */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                className="flex justify-center mb-6 lg:hidden"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </motion.div>

              {/* Title Section */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={isLogin ? "login" : "signup"}
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  transition={{ duration: 0.3 }}
                  className="text-center mb-8"
                >
                  <motion.h1
                    className="text-3xl sm:text-4xl font-extrabold mb-2"
                    style={{
                      background: "linear-gradient(135deg, #c084fc 0%, #818cf8 40%, #60a5fa 70%, #a78bfa 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                    dir="rtl"
                  >
                    {currentTranslations.title}
                  </motion.h1>
                  <p className="text-purple-300/50 text-sm sm:text-base" dir="rtl">
                    {currentTranslations.subtitle}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
                {/* Username Field */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <label htmlFor="username" className="block text-xs font-semibold text-purple-300/70 mb-2 tracking-wider uppercase">
                    {currentTranslations.username}
                  </label>
                  <div className="relative group">
                    <div className={`absolute -inset-[1px] rounded-xl transition-all duration-300 ${
                      focusedField === "username"
                        ? "bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 opacity-100"
                        : "bg-gradient-to-r from-purple-500/20 to-blue-500/20 opacity-50 group-hover:opacity-80"
                    }`} />
                    <div className="relative flex items-center">
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                        <svg className={`w-5 h-5 transition-colors duration-300 ${focusedField === "username" ? "text-violet-400" : "text-purple-500/40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onFocus={() => setFocusedField("username")}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="relative w-full pr-11 pl-4 py-3.5 rounded-xl bg-[#1a1035]/80 text-white placeholder-purple-400/30 focus:outline-none transition-all duration-300 text-sm"
                        placeholder={translations.placeholders.username}
                        dir="rtl"
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Email Field (Signup only) */}
                <AnimatePresence>
                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <label htmlFor="email" className="block text-xs font-semibold text-purple-300/70 mb-2 tracking-wider uppercase">
                        {translations.signup.email}
                      </label>
                      <div className="relative group">
                        <div className={`absolute -inset-[1px] rounded-xl transition-all duration-300 ${
                          focusedField === "email"
                            ? "bg-gradient-to-r from-pink-500 via-purple-500 to-violet-500 opacity-100"
                            : "bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-50 group-hover:opacity-80"
                        }`} />
                        <div className="relative flex items-center">
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                            <svg className={`w-5 h-5 transition-colors duration-300 ${focusedField === "email" ? "text-pink-400" : "text-purple-500/40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => setFocusedField("email")}
                            onBlur={() => setFocusedField(null)}
                            required
                            className="relative w-full pr-11 pl-4 py-3.5 rounded-xl bg-[#1a1035]/80 text-white placeholder-purple-400/30 focus:outline-none transition-all duration-300 text-sm"
                            placeholder={translations.placeholders.email}
                            dir="rtl"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Password Field */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  <label htmlFor="password" className="block text-xs font-semibold text-purple-300/70 mb-2 tracking-wider uppercase">
                    {currentTranslations.password}
                  </label>
                  <div className="relative group">
                    <div className={`absolute -inset-[1px] rounded-xl transition-all duration-300 ${
                      focusedField === "password"
                        ? "bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 opacity-100"
                        : "bg-gradient-to-r from-blue-500/20 to-violet-500/20 opacity-50 group-hover:opacity-80"
                    }`} />
                    <div className="relative flex items-center">
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                        <svg className={`w-5 h-5 transition-colors duration-300 ${focusedField === "password" ? "text-blue-400" : "text-purple-500/40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="relative w-full pr-11 pl-12 py-3.5 rounded-xl bg-[#1a1035]/80 text-white placeholder-purple-400/30 focus:outline-none transition-all duration-300 text-sm"
                        placeholder={translations.placeholders.password}
                        dir="rtl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500/40 hover:text-purple-300 transition-colors z-10"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Confirm Password Field (Signup only) */}
                <AnimatePresence>
                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <label htmlFor="confirmPassword" className="block text-xs font-semibold text-purple-300/70 mb-2 tracking-wider uppercase">
                        {translations.signup.confirmPassword}
                      </label>
                      <div className="relative group">
                        <div className={`absolute -inset-[1px] rounded-xl transition-all duration-300 ${
                          focusedField === "confirmPassword"
                            ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-100"
                            : "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 opacity-50 group-hover:opacity-80"
                        }`} />
                        <div className="relative flex items-center">
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                            <svg className={`w-5 h-5 transition-colors duration-300 ${focusedField === "confirmPassword" ? "text-emerald-400" : "text-purple-500/40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onFocus={() => setFocusedField("confirmPassword")}
                            onBlur={() => setFocusedField(null)}
                            required
                            className="relative w-full pr-11 pl-12 py-3.5 rounded-xl bg-[#1a1035]/80 text-white placeholder-purple-400/30 focus:outline-none transition-all duration-300 text-sm"
                            placeholder={translations.placeholders.confirmPassword}
                            dir="rtl"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500/40 hover:text-purple-300 transition-colors z-10"
                          >
                            {showConfirmPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="pt-2"
                >
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -2 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="relative w-full py-4 px-6 rounded-xl font-bold text-white overflow-hidden transition-all duration-300 disabled:cursor-not-allowed group"
                  >
                    {/* Button gradient background */}
                    <div className={`absolute inset-0 transition-all duration-500 ${
                      loading
                        ? "bg-gradient-to-r from-gray-600 to-gray-700"
                        : isLogin
                          ? "bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 group-hover:from-violet-500 group-hover:via-purple-500 group-hover:to-blue-500"
                          : "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 group-hover:from-emerald-500 group-hover:via-teal-500 group-hover:to-cyan-500"
                    }`} />

                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    {/* Button glow */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                      isLogin
                        ? "shadow-[0_0_40px_rgba(139,92,246,0.4)]"
                        : "shadow-[0_0_40px_rgba(20,184,166,0.4)]"
                    }`} />

                    <span className="relative flex items-center justify-center gap-3">
                      {loading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                          <span>{currentTranslations.processing}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isLogin ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            )}
                          </svg>
                          <span className="text-base">{currentTranslations.submit}</span>
                        </>
                      )}
                    </span>
                  </motion.button>
                </motion.div>
              </form>

              {/* Divider */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-8 relative"
              >
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-purple-500/20" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 text-purple-400/40" style={{ background: "rgba(15,10,30,0.95)" }}>
                    یا
                  </span>
                </div>
              </motion.div>

              {/* Toggle Mode Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-6 text-center"
              >
                <motion.button
                  type="button"
                  onClick={handleToggleMode}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="group inline-flex items-center gap-2 text-sm font-medium transition-all duration-300"
                  dir="rtl"
                >
                  <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent group-hover:from-purple-300 group-hover:to-blue-300 transition-all">
                    {currentTranslations.switchText}
                  </span>
                  <motion.svg
                    className="w-4 h-4 text-purple-400 group-hover:text-purple-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    animate={{ x: [0, -3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </motion.svg>
                </motion.button>
              </motion.div>
            </div>
          </div>

          {/* Footer */}
          <Footer className="mt-8 !border-t-purple-500/10 !text-purple-300/30" />
        </motion.div>
      </div>
    </div>
  );
}
