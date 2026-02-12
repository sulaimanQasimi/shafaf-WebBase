import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getCompanySettings, updateCompanySettings, initCompanySettingsTable } from "@/lib/company";
import { getAvailableFonts, applyFont } from "@/lib/fonts";
import Footer from "./Footer";

// Dari translations
const translations = {
    title: "تنظیمات شرکت",
    subtitle: "اطلاعات شرکت را ویرایش کنید",
    save: "ذخیره تغییرات",
    cancel: "لغو",
    companyName: "نام شرکت",
    logo: "لوگو",
    phone: "شماره تماس",
    address: "آدرس",
    font: "فونت",
    companyInfo: "اطلاعات شرکت",
    quickLinks: "دسترسی سریع",
    manageCurrencies: "مدیریت ارزها",
    manageUnits: "مدیریت واحدها",
    manageAccounts: "مدیریت حساب‌ها",
    success: {
        updated: "تنظیمات شرکت با موفقیت بروزرسانی شد",
    },
    errors: {
        update: "خطا در بروزرسانی تنظیمات شرکت",
        fetch: "خطا در دریافت اطلاعات شرکت",
    },
    placeholders: {
        companyName: "نام شرکت را وارد کنید",
        logo: "مسیر یا URL لوگو را وارد کنید",
        phone: "شماره تماس را وارد کنید",
        address: "آدرس را وارد کنید",
    },
    system: {},
    license: {
        remainingDays: "اعتبار لایسنس: {days} روز باقی‌مانده",
        expired: "اعتبار لایسنس منقضی شده",
    },
};

export type CompanySettingsNavigatePage = "currency" | "unit" | "account";

interface CompanySettingsProps {
    onBack: () => void;
    onNavigate?: (page: CompanySettingsNavigatePage) => void;
}

export default function CompanySettings({ onBack, onNavigate }: CompanySettingsProps) {
    const [loading, setLoading] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: "",
        logo: "",
        phone: "",
        address: "",
        font: "",
    });
    const [availableFonts] = useState(getAvailableFonts());

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setFetchLoading(true);
            await initCompanySettingsTable();

            const settingsData = await getCompanySettings();
            if (settingsData) {
                setFormData({
                    name: settingsData.name || "",
                    logo: settingsData.logo || "",
                    phone: settingsData.phone || "",
                    address: settingsData.address || "",
                    font: settingsData.font || "",
                });
            }
        } catch (error: any) {
            toast.error(translations.errors.fetch);
            console.error("Error loading company settings:", error);
        } finally {
            setFetchLoading(false);
        }
    };

    const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error("لطفاً یک فایل تصویری انتخاب کنید");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error("حجم فایل نباید بیشتر از 5 مگابایت باشد");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setFormData({ ...formData, logo: result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setFormData({ ...formData, logo: "" });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("نام شرکت الزامی است");
            return;
        }

        try {
            setLoading(true);
            const updatedSettings = await updateCompanySettings({
                name: formData.name,
                logo: formData.logo || undefined,
                phone: formData.phone || undefined,
                address: formData.address || undefined,
                font: formData.font || undefined,
            });

            if (updatedSettings) {
                toast.success(translations.success.updated);
                try {
                    if (updatedSettings.font) {
                        await applyFont(updatedSettings.font);
                    } else {
                        await applyFont(null);
                    }
                } catch (fontError) {
                    console.error("Error applying font:", fontError);
                }
            }
        } catch (error: any) {
            toast.error(translations.errors.update);
            console.error("Error updating company settings:", error);
        } finally {
            setLoading(false);
        }
    };

    if (fetchLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f0a1e]">
                <div className="flex flex-col items-center gap-4">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 rounded-full border-[3px] border-purple-200 dark:border-purple-500/20 border-t-purple-500 dark:border-t-purple-400"
                    />
                    <p className="text-sm text-gray-400 dark:text-purple-300/40">در حال بارگذاری...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/20 dark:bg-none p-4 sm:p-6 lg:p-8" dir="rtl"
            style={{
                background: undefined,
            }}
        >
            {/* Background - only for dark mode mesh gradient */}
            <div className="fixed inset-0 -z-10 bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/20 dark:from-[#0f0a1e] dark:via-[#1a1035] dark:to-[#0d1b2a]" />

            {/* Animated mesh orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-[5]">
                <motion.div
                    animate={{ x: [0, 60, -30, 40, 0], y: [0, -40, 30, -20, 0], scale: [1, 1.15, 0.9, 1.05, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-30 dark:opacity-100"
                    style={{
                        background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
                        filter: "blur(60px)",
                    }}
                />
                <motion.div
                    animate={{ x: [0, -50, 30, -15, 0], y: [0, 30, -25, 50, 0] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-20 dark:opacity-100"
                    style={{
                        background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
                        filter: "blur(80px)",
                    }}
                />
            </div>

            <div className="max-w-4xl mx-auto relative z-10">
                {/* Back Button */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, type: "spring", stiffness: 120 }}
                    className="mb-8"
                >
                    <motion.button
                        whileHover={{ scale: 1.02, x: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onBack}
                        className="group flex items-center gap-3 px-5 py-3 rounded-xl border border-gray-200 dark:border-purple-500/15 bg-white dark:bg-[#110d22]/60 hover:border-purple-300 dark:hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 dark:hover:shadow-purple-500/10 transition-all duration-300 overflow-hidden"
                    >
                        <motion.svg
                            className="w-5 h-5 text-purple-500 dark:text-purple-400"
                            fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" stroke="currentColor"
                            animate={{ x: [0, -4, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <path d="M15 19l-7-7 7-7" />
                        </motion.svg>
                        <span className="text-sm font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-300 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent">
                            بازگشت به داشبورد
                        </span>
                    </motion.button>
                </motion.div>

                {/* ═══ Company Header Card ═══ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative rounded-2xl overflow-hidden mb-8"
                >
                    {/* Header gradient */}
                    <div className="absolute inset-0" style={{
                        background: "linear-gradient(135deg, #7c3aed 0%, #6366f1 30%, #3b82f6 60%, #06b6d4 100%)",
                    }} />
                    {/* Decorative elements */}
                    <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                        backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
                        backgroundSize: "30px 30px",
                    }} />

                    <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
                        {/* Logo with animated ring */}
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="relative w-24 h-24 flex-shrink-0"
                        >
                            <motion.div
                                className="absolute -inset-[3px] rounded-2xl"
                                style={{
                                    background: "conic-gradient(from 0deg, rgba(255,255,255,0.8), rgba(255,255,255,0.2), rgba(255,255,255,0.6), rgba(255,255,255,0.1), rgba(255,255,255,0.8))",
                                    padding: "3px",
                                }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                            >
                                <div className="w-full h-full rounded-[13px] bg-white/20 backdrop-blur-sm" />
                            </motion.div>
                            <div className="absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center">
                                {formData.logo ? (
                                    <img
                                        src={formData.logo}
                                        alt={formData.name}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = "none";
                                        }}
                                    />
                                ) : (
                                    <svg className="w-10 h-10 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                )}
                            </div>
                        </motion.div>

                        <div className="text-center sm:text-right">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1 tracking-tight">
                                {formData.name || translations.title}
                            </h1>
                            <p className="text-white/60 text-sm">{translations.subtitle}</p>
                            <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs text-white/50">فعال</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ═══ Quick Links ═══ */}
                {onNavigate && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mb-8"
                    >
                        <h3 className="text-sm font-bold text-gray-500 dark:text-purple-300/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            {translations.quickLinks}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                {
                                    title: translations.manageCurrencies,
                                    page: "currency" as const,
                                    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                                    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
                                    hoverShadow: "rgba(245,158,11,0.3)",
                                    iconBg: "rgba(245,158,11,0.15)",
                                },
                                {
                                    title: translations.manageUnits,
                                    page: "unit" as const,
                                    icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
                                    gradient: "linear-gradient(135deg, #ec4899, #db2777)",
                                    hoverShadow: "rgba(236,72,153,0.3)",
                                    iconBg: "rgba(236,72,153,0.15)",
                                },
                                {
                                    title: translations.manageAccounts,
                                    page: "account" as const,
                                    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
                                    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
                                    hoverShadow: "rgba(6,182,212,0.3)",
                                    iconBg: "rgba(6,182,212,0.15)",
                                },
                            ].map((item, index) => (
                                <motion.button
                                    key={item.page}
                                    type="button"
                                    onClick={() => onNavigate(item.page)}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 + index * 0.08 }}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="group relative rounded-2xl p-5 border border-gray-200 dark:border-purple-500/10 bg-white dark:bg-[#110d22]/60 text-right transition-all duration-300 overflow-hidden"
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow = `0 12px 30px ${item.hoverShadow}`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = "";
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: item.gradient }}>
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold text-sm text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{item.title}</span>
                                            <p className="text-[11px] text-gray-400 dark:text-purple-300/30 mt-0.5">تنظیمات و مدیریت</p>
                                        </div>
                                        <svg className="w-5 h-5 text-gray-300 dark:text-purple-500/20 group-hover:text-gray-400 dark:group-hover:text-purple-400/40 group-hover:-translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </div>

                                    {/* Hover gradient border */}
                                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{
                                        background: item.gradient,
                                        padding: "1px",
                                        mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                        maskComposite: "xor",
                                        WebkitMaskComposite: "xor",
                                    }} />
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ═══ Form ═══ */}
                <form onSubmit={handleSubmit}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-2xl border border-gray-200 dark:border-purple-500/10 bg-white dark:bg-[#110d22]/60 overflow-hidden mb-6"
                    >
                        {/* Gradient accent */}
                        <div className="h-[2px]" style={{
                            background: "linear-gradient(90deg, #8b5cf6, #3b82f6, #06b6d4, #8b5cf6)",
                            backgroundSize: "200% 100%",
                            animation: "gradient-shift 4s linear infinite",
                        }} />

                        <div className="p-6 sm:p-8">
                            {/* Section header */}
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                                    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                                }}>
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{translations.companyInfo}</h2>
                                    <p className="text-xs text-gray-400 dark:text-purple-300/30">اطلاعات پایه شرکت را تنظیم کنید</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Company Name */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-purple-300/50 uppercase tracking-wider mb-2">
                                        {translations.companyName} <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300 dark:text-purple-500/30 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            className="w-full pr-11 pl-4 py-3 rounded-xl border border-gray-200 dark:border-purple-500/15 bg-gray-50/50 dark:bg-purple-950/20 text-gray-900 dark:text-white focus:outline-none focus:border-purple-400 dark:focus:border-purple-500/40 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-500/10 focus:bg-white dark:focus:bg-purple-950/30 transition-all duration-200 text-sm"
                                            placeholder={translations.placeholders.companyName}
                                            dir="rtl"
                                        />
                                    </div>
                                </div>

                                {/* Logo */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-purple-300/50 uppercase tracking-wider mb-2">
                                        {translations.logo}
                                    </label>
                                    <div className="space-y-3">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleSelectImage}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-purple-500/15 bg-gray-50/50 dark:bg-purple-950/20 text-gray-900 dark:text-white focus:outline-none focus:border-purple-400 dark:focus:border-purple-500/40 transition-all duration-200 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
                                            dir="rtl"
                                        />
                                        {formData.logo && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                className="mt-3"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs text-gray-400 dark:text-purple-300/30">پیش‌نمایش لوگو:</p>
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveImage}
                                                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-semibold flex items-center gap-1 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        حذف
                                                    </button>
                                                </div>
                                                <div className="w-28 h-28 border border-gray-200 dark:border-purple-500/15 rounded-xl overflow-hidden bg-gray-50 dark:bg-purple-950/20 flex items-center justify-center">
                                                    <img
                                                        src={formData.logo}
                                                        alt="Logo preview"
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.style.display = "none";
                                                            const parent = target.parentElement;
                                                            if (parent) {
                                                                parent.innerHTML = '<p class="text-gray-400 text-xs">خطا</p>';
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-purple-300/50 uppercase tracking-wider mb-2">
                                        {translations.phone}
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300 dark:text-purple-500/30 group-focus-within:text-emerald-500 dark:group-focus-within:text-emerald-400 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full pr-11 pl-4 py-3 rounded-xl border border-gray-200 dark:border-purple-500/15 bg-gray-50/50 dark:bg-purple-950/20 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-500/10 focus:bg-white dark:focus:bg-purple-950/30 transition-all duration-200 text-sm"
                                            placeholder={translations.placeholders.phone}
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                {/* Address */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-purple-300/50 uppercase tracking-wider mb-2">
                                        {translations.address}
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute right-3 top-3 pointer-events-none text-gray-300 dark:text-purple-500/30 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <textarea
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            rows={3}
                                            className="w-full pr-11 pl-4 py-3 rounded-xl border border-gray-200 dark:border-purple-500/15 bg-gray-50/50 dark:bg-purple-950/20 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/40 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/10 focus:bg-white dark:focus:bg-purple-950/30 transition-all duration-200 text-sm resize-none"
                                            placeholder={translations.placeholders.address}
                                            dir="rtl"
                                        />
                                    </div>
                                </div>

                                {/* Font */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-purple-300/50 uppercase tracking-wider mb-2">
                                        {translations.font}
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300 dark:text-purple-500/30 group-focus-within:text-pink-500 dark:group-focus-within:text-pink-400 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <select
                                            value={formData.font}
                                            onChange={(e) => setFormData({ ...formData, font: e.target.value })}
                                            className="w-full pr-11 pl-4 py-3 rounded-xl border border-gray-200 dark:border-purple-500/15 bg-gray-50/50 dark:bg-purple-950/20 text-gray-900 dark:text-white focus:outline-none focus:border-pink-400 dark:focus:border-pink-500/40 focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-500/10 focus:bg-white dark:focus:bg-purple-950/30 transition-all duration-200 text-sm appearance-none cursor-pointer"
                                            dir="rtl"
                                            style={{
                                                fontFamily: formData.font && formData.font !== "system" && !formData.font.includes('/')
                                                    ? formData.font
                                                    : (formData.font && formData.font.includes('IRANSans') ? 'IRANSans' : undefined)
                                            }}
                                        >
                                            {availableFonts.map((font, index) => {
                                                const value = font.name === "system"
                                                    ? ""
                                                    : (font.file ? font.file : font.name);
                                                return (
                                                    <option key={`${font.name}-${index}`} value={value}>
                                                        {font.displayName}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-gray-400 dark:text-purple-300/20 mt-2">
                                        فونت‌های سفارشی را در پوشه public/fonts قرار دهید (فرمت‌های .ttf, .otf, .woff, .woff2)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* ═══ Action Buttons ═══ */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex gap-3"
                    >
                        <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onBack}
                            className="flex-1 py-3.5 rounded-xl border border-gray-200 dark:border-purple-500/15 bg-white dark:bg-[#110d22]/60 text-gray-700 dark:text-gray-300 font-bold text-sm hover:border-gray-300 dark:hover:border-purple-500/25 hover:bg-gray-50 dark:hover:bg-purple-950/30 transition-all duration-200"
                        >
                            {translations.cancel}
                        </motion.button>
                        <motion.button
                            type="submit"
                            disabled={loading}
                            whileHover={{ scale: loading ? 1 : 1.02 }}
                            whileTap={{ scale: loading ? 1 : 0.98 }}
                            className="flex-[2] py-3.5 rounded-xl text-white font-bold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{
                                background: "linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)",
                                boxShadow: "0 8px 25px rgba(139,92,246,0.3)",
                            }}
                        >
                            {loading ? (
                                <>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                    />
                                    <span>در حال ذخیره...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>{translations.save}</span>
                                </>
                            )}
                        </motion.button>
                    </motion.div>
                </form>
                <Footer />
            </div>
        </div>
    );
}
