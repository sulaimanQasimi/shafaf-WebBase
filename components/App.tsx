"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  openDatabase,
  isDatabaseOpen,
  createDatabase,
} from "@/lib/db";
import { getDashboardStats, formatPersianNumber, formatLargeNumber } from "@/lib/dashboard";
import { playClickSound } from "@/lib/sound";
import { getCompanySettings, initCompanySettingsTable, type CompanySettings as CompanySettingsType } from "@/lib/company";
import { applyFont } from "@/lib/fonts";
import { checkForUpdatesOnStartup } from "@/lib/updater";
import Login from "@/components/Login";
import DatabaseConfig from "@/components/DatabaseConfig";
import CurrencyManagement from "@/components/Currency";
import SupplierManagement from "@/components/Supplier";
import ProductManagement from "@/components/Product";
import PurchaseManagement from "@/components/Purchase";
import SalesManagement from "@/components/Sales";
import UnitManagement from "@/components/Unit";
import CustomerManagement from "@/components/Customer";
import CustomerDetailPage from "@/components/CustomerDetailPage";
import SupplierDetailPage from "@/components/SupplierDetailPage";
import ExpenseManagement from "@/components/Expense";
import EmployeeManagement from "@/components/Employee";
import SalaryManagement from "@/components/Salary";
import DeductionManagement from "@/components/Deduction";
import UserManagement from "@/components/UserManagement";
import ProfileEdit from "@/components/ProfileEdit";
import CompanySettings from "@/components/CompanySettings";
import SaleInvoice from "@/components/SaleInvoice";
import AccountManagement from "@/components/Account";
import PurchasePaymentManagement from "@/components/PurchasePayment";
import SalesPaymentManagement from "@/components/SalesPayment";
import ServicesManagement from "@/components/Services";
import AiReport from "@/components/AiReport";
import Report from "@/components/Report";
import StockReport from "@/components/StockReport";
import AiCreateUpdateModal from "@/components/AiCreateUpdateModal";
import Footer from "@/components/Footer";
import { SaleWithItems, SalePayment } from "@/lib/sales";
import { Customer } from "@/lib/customer";
import { Product } from "@/lib/product";
import { Unit } from "@/lib/unit";

interface User {
  id: number;
  username: string;
  email: string;
  role?: string;
  profile_picture?: string | null;
}

type Page = "dashboard" | "currency" | "supplier" | "product" | "purchase" | "sales" | "stock" | "unit" | "customer" | "customerDetail" | "supplierDetail" | "expense" | "employee" | "salary" | "deduction" | "users" | "profile" | "invoice" | "company" | "account" | "purchasePayment" | "salesPayment" | "services" | "servicePayment" | "aiReport" | "report";

const DASHBOARD_USAGE_KEY = "shafaf_dashboard_usage";

function getDashboardUsage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DASHBOARD_USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function incrementDashboardUsage(page: Page): void {
  const usage = getDashboardUsage();
  usage[page] = (usage[page] || 0) + 1;
  try {
    localStorage.setItem(DASHBOARD_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore
  }
}

const DASHBOARD_FEATURES: Array<{
  title: string;
  description: string;
  icon: string;
  color: string;
  page: Page;
}> = [
    { title: "مدیریت اجناس", description: "افزودن، ویرایش و مدیریت اجناس و محصولات", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", color: "from-indigo-500 to-violet-500", page: "product" },
    { title: "مدیریت خریداری", description: "ثبت و پیگیری خریداری ها از تمویل کننده ها", icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z", color: "from-purple-500 to-blue-500", page: "purchase" },
    { title: "مدیریت فروشات", description: "ثبت و مدیریت فروشات، صدور فاکتور و کنترل موجودی", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", color: "from-emerald-500 to-teal-500", page: "sales" },
    { title: "موجودی (بر اساس دسته)", description: "گزارش موجودی محصولات به تفکیک دسته و شماره دسته", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", color: "from-amber-500 to-orange-500", page: "stock" },
    { title: "خدمات", description: "ثبت و مدیریت خدمات با آیتم‌های آزاد (نام و قیمت)", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", color: "from-teal-500 to-cyan-500", page: "services" },
    { title: "تمویل کننده ها", description: "مدیریت اطلاعات تمویل کننده ها و توزیع کننده ها", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", color: "from-green-500 to-teal-500", page: "supplier" },
    { title: "مدیریت مشتری ها", description: "افزودن، ویرایش و مدیریت اطلاعات مشتریان", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", color: "from-indigo-500 to-blue-500", page: "customer" },
    { title: "مدیریت مصارف", description: "ثبت و مدیریت مصارف و هزینه‌ها", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z", color: "from-red-500 to-pink-500", page: "expense" },
    { title: "مدیریت کارمندان", description: "افزودن، ویرایش و مدیریت اطلاعات کارمندان", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", color: "from-violet-500 to-purple-500", page: "employee" },
    { title: "مدیریت کاربران", description: "ایجاد، ویرایش و مدیریت کاربران سیستم", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197v-1a6 6 0 00-9-5.197", color: "from-cyan-500 to-blue-500", page: "users" },
    { title: "تنظیمات شرکت", description: "ویرایش اطلاعات و تنظیمات شرکت", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", color: "from-emerald-500 to-teal-500", page: "company" },
    { title: "گزارش‌ها", description: "تولید و خروجی گزارش‌های مختلف با فیلتر تاریخ", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", color: "from-indigo-500 to-purple-500", page: "report" },
    { title: "گزارش هوشمند (AI)", description: "تولید گزارش جدول و چارت بر اساس درخواست متنی", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", color: "from-violet-500 to-fuchsia-500", page: "aiReport" },
  ];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [dashboardStats, setDashboardStats] = useState({
    productsCount: 0,
    suppliersCount: 0,
    purchasesCount: 0,
    monthlyIncome: 0,
    deductionsCount: 0,
    totalDeductions: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettingsType | null>(null);
  const [invoiceData, setInvoiceData] = useState<{
    saleData: SaleWithItems;
    customer: Customer;
    products: Product[];
    units: Unit[];
    payments: SalePayment[];
    currencyName?: string;
  } | null>(null);
  const [aiCreateUpdateOpen, setAiCreateUpdateOpen] = useState(false);
  const [detailCustomerId, setDetailCustomerId] = useState<number | null>(null);
  const [detailSupplierId, setDetailSupplierId] = useState<number | null>(null);

  // Sort dashboard features by usage (most used first)
  const sortedDashboardFeatures = useMemo(() => {
    const usage = getDashboardUsage();
    return [...DASHBOARD_FEATURES].sort((a, b) => (usage[b.page] || 0) - (usage[a.page] || 0));
  }, [currentPage]);

  // Theme state - initialize from localStorage or system preference
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      // No saved preference, use system
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Apply theme to document on mount and whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => {
      const newValue = !prev;
      // Apply immediately for instant visual feedback
      const root = document.documentElement;
      if (newValue) {
        root.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newValue;
    });
  };

  // Check for updates on mount
  useEffect(() => {
    // Check for updates silently in the background
    checkForUpdatesOnStartup().catch((error) => {
      // Silently fail - updates are optional
      console.log("Update check:", error);
    });
  }, []);

  // Global keyboard shortcut: Ctrl+T to open sales create modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+T (or Cmd+T on Mac)
      // Ignore if user is typing in an input, textarea, or contenteditable element
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input, textarea, [contenteditable="true"]');

      if ((e.ctrlKey || e.metaKey) && e.key === 't' && !isInput) {
        e.preventDefault();
        e.stopPropagation();

        // Navigate to sales page if not already there
        if (currentPage !== "sales") {
          setCurrentPage("sales");
          // Wait a bit for the component to mount, then trigger modal
          setTimeout(() => {
            const openModal = (window as any).__openSalesModal;
            if (openModal && typeof openModal === 'function') {
              openModal();
            }
          }, 150);
        } else {
          // Already on sales page, just open the modal
          const openModal = (window as any).__openSalesModal;
          if (openModal && typeof openModal === 'function') {
            openModal();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentPage]);

  // Ensure database exists and is open before showing login.
  // If DB/tables exist, open; else create DB from env and run schema (db.sql).
  const ensureDatabase = async () => {
    setDbError(null);
    setDbReady(null);
    try {
      const alreadyOpen = await isDatabaseOpen();
      if (alreadyOpen) {
        setDbReady(true);
        return;
      }
      try {
        await openDatabase("");
        setDbReady(true);
        return;
      } catch (openErr: any) {
        // e.g. "Unknown database" or connection error — try creating DB and running schema
        const msg = openErr?.message ?? String(openErr);
        console.warn("Database open failed, will try create:", msg);
      }
      try {
        await createDatabase("");
        setDbReady(true);
      } catch (createErr: any) {
        const msg = createErr?.message ?? String(createErr);
        setDbError(msg);
        setDbReady(false);
      }
    } catch (err: any) {
      setDbError(err?.message ?? "Database check failed");
      setDbReady(false);
    }
  };

  // Run database check on mount (before showing login).
  useEffect(() => {
    ensureDatabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add global click sound handler
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Only play sound for interactive elements (buttons, links, etc.)
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a') ||
        target.getAttribute('role') === 'button' ||
        target.onclick !== null
      ) {
        playClickSound();
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // Load company settings and apply font
  useEffect(() => {
    const loadCompanySettings = async () => {
      try {
        await initCompanySettingsTable();
        const settings = await getCompanySettings();
        setCompanySettings(settings);

        // Apply font from settings
        if (settings.font) {
          await applyFont(settings.font);
        } else {
          await applyFont(null); // Use system default
        }
      } catch (error) {
        console.error("Error loading company settings:", error);
      }
    };
    if (user) {
      loadCompanySettings();
    }
  }, [user]);

  // Load dashboard stats when on dashboard page
  useEffect(() => {
    const loadStats = async () => {
      if (currentPage === "dashboard" && user) {
        try {
          setLoadingStats(true);
          const stats = await getDashboardStats();
          setDashboardStats(stats);
        } catch (error) {
          console.error("Error loading dashboard stats:", error);
        } finally {
          setLoadingStats(false);
        }
      }
    };
    loadStats();
  }, [currentPage, user]);

  // Before login: ensure database exists and tables exist (open or create + import db.sql)
  if (!user) {
    if (dbReady === null) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{
          background: "linear-gradient(135deg, #0f0a1e 0%, #1a1035 25%, #0d1b2a 50%, #16103a 75%, #0a0e1a 100%)"
        }}>
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-full"
              style={{
                border: "3px solid rgba(139,92,246,0.2)",
                borderTopColor: "#8b5cf6",
              }}
            />
            <p className="text-purple-300/50">در حال بررسی پایگاه داده...</p>
          </div>
        </div>
      );
    }
    if (dbReady === false) {
      return (
        <DatabaseConfig
          dbError={dbError}
          onSaveSuccess={() => ensureDatabase()}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={(user) => setUser(user)}
      />
    );
  }

  const handleLogout = () => {
    setUser(null);
    setCurrentPage("dashboard");
  };

  // Show currency page if selected
  if (currentPage === "currency") {
    return (
      <CurrencyManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show supplier page if selected
  if (currentPage === "supplier") {
    return (
      <SupplierManagement
        onBack={() => setCurrentPage("dashboard")}
        onNavigateToBalancePage={() => setCurrentPage("purchasePayment")}
        onNavigateToDetail={(id) => {
          setDetailSupplierId(id);
          setCurrentPage("supplierDetail");
        }}
      />
    );
  }

  // Show supplier detail page if selected
  if (currentPage === "supplierDetail" && detailSupplierId !== null) {
    return (
      <SupplierDetailPage
        supplierId={detailSupplierId}
        onBack={() => {
          setCurrentPage("supplier");
          setDetailSupplierId(null);
        }}
      />
    );
  }

  // Show unit page if selected
  if (currentPage === "unit") {
    return (
      <UnitManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  if (currentPage === "purchase") {
    return (
      <PurchaseManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show sales page if selected
  if (currentPage === "sales") {
    return (
      <SalesManagement
        onBack={() => setCurrentPage("dashboard")}
        onOpenInvoice={(data) => {
          setInvoiceData(data);
          setCurrentPage("invoice");
        }}
      />
    );
  }

  // Show product page if selected
  if (currentPage === "product") {
    return (
      <ProductManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show customer page if selected
  if (currentPage === "customer") {
    return (
      <CustomerManagement
        onBack={() => setCurrentPage("dashboard")}
        onNavigateToBalancePage={() => setCurrentPage("salesPayment")}
        onNavigateToDetail={(id) => {
          setDetailCustomerId(id);
          setCurrentPage("customerDetail");
        }}
      />
    );
  }

  // Show customer detail page if selected
  if (currentPage === "customerDetail" && detailCustomerId !== null) {
    return (
      <CustomerDetailPage
        customerId={detailCustomerId}
        onBack={() => {
          setCurrentPage("customer");
          setDetailCustomerId(null);
        }}
      />
    );
  }

  // Show expense page if selected
  if (currentPage === "expense") {
    return (
      <ExpenseManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show employee page if selected
  if (currentPage === "employee") {
    return (
      <EmployeeManagement
        onBack={() => setCurrentPage("dashboard")}
        onNavigateToSalary={() => setCurrentPage("salary")}
      />
    );
  }

  // Show salary page if selected
  if (currentPage === "salary") {
    return (
      <SalaryManagement
        onBack={() => setCurrentPage("dashboard")}
        onNavigateToDeduction={() => setCurrentPage("deduction")}
      />
    );
  }

  // Show deduction page if selected
  if (currentPage === "deduction") {
    return (
      <DeductionManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show users management page if selected
  if (currentPage === "users") {
    return (
      <UserManagement
        onBack={() => setCurrentPage("dashboard")}
        currentUser={user}
      />
    );
  }

  // Show profile edit page if selected
  if (currentPage === "profile") {
    return (
      <ProfileEdit
        userId={user.id}
        onBack={() => setCurrentPage("dashboard")}
        onProfileUpdate={(updatedUser) => {
          setUser({
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            profile_picture: updatedUser.profile_picture ?? undefined,
          });
        }}
      />
    );
  }

  // Show invoice page if selected
  if (currentPage === "invoice" && invoiceData) {
    return (
      <SaleInvoice
        saleData={invoiceData.saleData}
        customer={invoiceData.customer}
        products={invoiceData.products}
        units={invoiceData.units}
        payments={invoiceData.payments}
        companySettings={companySettings}
        currencyName={invoiceData.currencyName}
        onClose={() => setCurrentPage("sales")}
      />
    );
  }

  // Show company settings page if selected
  if (currentPage === "company") {
    return (
      <CompanySettings
        onBack={() => setCurrentPage("dashboard")}
        onNavigate={(page) => setCurrentPage(page)}
      />
    );
  }

  // Show account page if selected
  if (currentPage === "account") {
    return (
      <AccountManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show purchase payment page if selected
  if (currentPage === "purchasePayment") {
    return (
      <PurchasePaymentManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show sales payment page if selected
  if (currentPage === "salesPayment") {
    return (
      <SalesPaymentManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show services page if selected
  if (currentPage === "services") {
    return (
      <ServicesManagement onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show AI report page if selected
  if (currentPage === "aiReport") {
    return (
      <AiReport onBack={() => setCurrentPage("dashboard")} />
    );
  }

  // Show report page if selected
  if (currentPage === "report") {
    return (
      <Report onBack={() => setCurrentPage("dashboard")} />
    );
  }

  if (currentPage === "stock") {
    return (
      <StockReport onBack={() => setCurrentPage("dashboard")} />
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" dir="rtl" style={{
      background: isDark
        ? "linear-gradient(135deg, #0f0a1e 0%, #1a1035 25%, #0d1b2a 50%, #16103a 75%, #0a0e1a 100%)"
        : "linear-gradient(135deg, #f0e6ff 0%, #e0ecff 25%, #f5f0ff 50%, #dde8ff 75%, #f0e6ff 100%)"
    }}>
      {/* === ANIMATED MESH BACKGROUND === */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Animated mesh orbs */}
        <motion.div
          animate={{
            x: [0, 80, -40, 60, 0],
            y: [0, -60, 40, -30, 0],
            scale: [1, 1.2, 0.9, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: isDark
              ? "radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(168,85,247,0.05) 40%, transparent 70%)"
              : "radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(168,85,247,0.04) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <motion.div
          animate={{
            x: [0, -60, 40, -20, 0],
            y: [0, 40, -30, 60, 0],
            scale: [1, 0.85, 1.2, 0.9, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] rounded-full"
          style={{
            background: isDark
              ? "radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.04) 40%, transparent 70%)"
              : "radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.03) 40%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <motion.div
          animate={{
            x: [0, 40, -60, 20, 0],
            y: [0, -40, 20, -50, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full"
          style={{
            background: isDark
              ? "radial-gradient(circle, rgba(236,72,153,0.08) 0%, rgba(244,114,182,0.03) 40%, transparent 70%)"
              : "radial-gradient(circle, rgba(236,72,153,0.06) 0%, rgba(244,114,182,0.02) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            opacity: isDark ? 0.03 : 0.04,
            backgroundImage: `
              linear-gradient(rgba(139,92,246,0.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139,92,246,0.4) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* === PREMIUM HEADER === */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 80, damping: 15 }}
        className="sticky top-0 z-50 border-b border-gray-200/60 dark:border-purple-500/10 bg-white/80 dark:bg-[#0f0a1e]/80"
        style={{ backdropFilter: "blur(24px) saturate(180%)" }}
      >
        {/* Animated gradient top accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
          background: "linear-gradient(90deg, #8b5cf6, #06b6d4, #3b82f6, #ec4899, #f59e0b, #8b5cf6)",
          backgroundSize: "300% 100%",
          animation: "gradient-shift 5s linear infinite",
        }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16 gap-3">
            {/* ─── Logo & Brand ─── */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Logo with animated ring */}
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="relative w-11 h-11 flex-shrink-0"
              >
                {/* Animated ring */}
                <motion.div
                  className="absolute -inset-[2px] rounded-xl"
                  style={{
                    background: "conic-gradient(from 0deg, #8b5cf6, #3b82f6, #06b6d4, #ec4899, #8b5cf6)",
                    padding: "2px",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-full h-full rounded-[10px] bg-white dark:bg-[#0f0a1e]" />
                </motion.div>
                <div className="absolute inset-0 rounded-xl overflow-hidden">
                  <img
                    src="/logo.jpeg"
                    alt="شفاف Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              </motion.div>

              {/* Brand text */}
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold leading-tight" style={{
                  background: "linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  شفاف
                </h1>
                <p className="text-[10px] leading-tight text-gray-400 dark:text-purple-300/35 truncate max-w-[140px]">
                  {companySettings?.name || "سیستم مدیریت مالی"}
                </p>
              </div>
            </div>

            {/* ─── Nav Actions ─── */}
            <div className="flex items-center gap-2">
              {/* User info pill */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-purple-500/10 bg-gray-50/60 dark:bg-purple-950/20 cursor-default"
              >
                {/* Mini avatar */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                  }}
                >
                  {user.profile_picture ? (
                    <img src={user.profile_picture} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs font-bold">{user.username.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="text-right min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[100px]">{user.username}</p>
                  <p className="text-[10px] text-gray-400 dark:text-purple-300/30 truncate max-w-[100px]">{user.email}</p>
                </div>
              </motion.div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-8 bg-gray-200 dark:bg-purple-500/10 mx-1" />

              {/* Theme Toggle */}
              <motion.button
                whileHover={{ scale: 1.1, rotate: 12 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer border border-gray-200 dark:border-purple-500/15 bg-gray-50 dark:bg-purple-950/30 text-gray-500 dark:text-purple-300/60 hover:text-purple-600 dark:hover:text-purple-300 hover:border-purple-300 dark:hover:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200"
                title={isDark ? "روشن کردن تم" : "تاریک کردن تم"}
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: isDark ? 360 : 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {isDark ? (
                    <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                </motion.div>
              </motion.button>

              {/* Profile Edit */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setCurrentPage("profile")}
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer border border-gray-200 dark:border-purple-500/15 bg-gray-50 dark:bg-purple-950/30 text-gray-500 dark:text-purple-300/60 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                title="ویرایش پروفایل"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </motion.button>

              {/* Settings / Admin */}
              {user.role === "admin" && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setCurrentPage("users")}
                  className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer border border-gray-200 dark:border-purple-500/15 bg-gray-50 dark:bg-purple-950/30 text-gray-500 dark:text-purple-300/60 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200"
                  title="مدیریت کاربران"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </motion.button>
              )}

              {/* Logout */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleLogout}
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer border border-gray-200 dark:border-purple-500/15 bg-gray-50 dark:bg-purple-950/30 text-gray-500 dark:text-purple-300/60 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                title="خروج"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 z-10">

        {/* === PREMIUM STATS CARDS === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-12"
        >
          {[
            {
              label: "اجناس",
              value: loadingStats ? "..." : formatPersianNumber(dashboardStats.productsCount),
              icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
              gradient: "from-violet-500 to-purple-600",
              glowColor: "rgba(139,92,246,0.3)",
              bgLight: "rgba(139,92,246,0.06)",
            },
            {
              label: "تمویل کنندگان",
              value: loadingStats ? "..." : formatPersianNumber(dashboardStats.suppliersCount),
              icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
              gradient: "from-emerald-500 to-teal-600",
              glowColor: "rgba(16,185,129,0.3)",
              bgLight: "rgba(16,185,129,0.06)",
            },
            {
              label: "خریداری ها",
              value: loadingStats ? "..." : formatPersianNumber(dashboardStats.purchasesCount),
              icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
              gradient: "from-blue-500 to-cyan-600",
              glowColor: "rgba(59,130,246,0.3)",
              bgLight: "rgba(59,130,246,0.06)",
            },
            {
              label: "درآمد ماهانه",
              value: loadingStats ? "..." : formatLargeNumber(dashboardStats.monthlyIncome),
              icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              gradient: "from-amber-500 to-orange-600",
              glowColor: "rgba(245,158,11,0.3)",
              bgLight: "rgba(245,158,11,0.06)",
            },
            {
              label: "کسرها",
              value: loadingStats ? "..." : formatPersianNumber(dashboardStats.deductionsCount),
              icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              gradient: "from-rose-500 to-pink-600",
              glowColor: "rgba(244,63,94,0.3)",
              bgLight: "rgba(244,63,94,0.06)",
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1, type: "spring", stiffness: 200 }}
              whileHover={{ y: -8, scale: 1.03, transition: { duration: 0.25 } }}
              className="relative rounded-2xl p-5 overflow-hidden group cursor-default"
              style={{
                background: isDark
                  ? "rgba(15,10,30,0.6)"
                  : "rgba(255,255,255,0.7)",
                backdropFilter: "blur(20px)",
                border: `1px solid ${isDark ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.15)"}`,
                boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.3)" : "0 8px 32px rgba(139,92,246,0.08)",
              }}
            >
              {/* Gradient border on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                background: `linear-gradient(135deg, ${stat.glowColor}, transparent, ${stat.glowColor})`,
                padding: "1px",
                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                maskComposite: "xor",
                WebkitMaskComposite: "xor",
              }} />

              {/* Background glow on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: stat.bgLight }}
              />

              <div className="relative flex items-center justify-between">
                <div className="flex-1">
                  <p className={`text-xs font-semibold mb-2 uppercase tracking-wider ${isDark ? "text-purple-300/50" : "text-gray-500"}`}>{stat.label}</p>
                  <p className={`text-3xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                    {stat.value}
                  </p>
                </div>
                <motion.div
                  className={`w-14 h-14 bg-gradient-to-br ${stat.gradient} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-300`}
                  style={{
                    boxShadow: `0 8px 25px ${stat.glowColor}`,
                  }}
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                  </svg>
                </motion.div>
              </div>

              {/* Shimmer effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </motion.div>
          ))}
        </motion.div>

        {/* === NAVIGATION SECTION === */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h3 className={`text-2xl font-bold mb-6 flex items-center gap-3 ${isDark ? "text-white" : "text-gray-900"}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center" style={{
              boxShadow: "0 4px 15px rgba(139,92,246,0.3)",
            }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            بخش های سیستم
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedDashboardFeatures.map((item, index) => {
              // Map color classes to actual gradient values for inline styles
              const colorMap: Record<string, { from: string; to: string; glow: string }> = {
                "from-indigo-500 to-violet-500": { from: "#6366f1", to: "#8b5cf6", glow: "rgba(99,102,241,0.25)" },
                "from-purple-500 to-blue-500": { from: "#a855f7", to: "#3b82f6", glow: "rgba(168,85,247,0.25)" },
                "from-emerald-500 to-teal-500": { from: "#10b981", to: "#14b8a6", glow: "rgba(16,185,129,0.25)" },
                "from-amber-500 to-orange-500": { from: "#f59e0b", to: "#f97316", glow: "rgba(245,158,11,0.25)" },
                "from-teal-500 to-cyan-500": { from: "#14b8a6", to: "#06b6d4", glow: "rgba(20,184,166,0.25)" },
                "from-green-500 to-teal-500": { from: "#22c55e", to: "#14b8a6", glow: "rgba(34,197,94,0.25)" },
                "from-indigo-500 to-blue-500": { from: "#6366f1", to: "#3b82f6", glow: "rgba(99,102,241,0.25)" },
                "from-red-500 to-pink-500": { from: "#ef4444", to: "#ec4899", glow: "rgba(239,68,68,0.25)" },
                "from-violet-500 to-purple-500": { from: "#8b5cf6", to: "#a855f7", glow: "rgba(139,92,246,0.25)" },
                "from-cyan-500 to-blue-500": { from: "#06b6d4", to: "#3b82f6", glow: "rgba(6,182,212,0.25)" },
                "from-violet-500 to-fuchsia-500": { from: "#8b5cf6", to: "#d946ef", glow: "rgba(139,92,246,0.25)" },
                "from-indigo-500 to-purple-500": { from: "#6366f1", to: "#a855f7", glow: "rgba(99,102,241,0.25)" },
              };
              const colors = colorMap[item.color] || { from: "#8b5cf6", to: "#3b82f6", glow: "rgba(139,92,246,0.25)" };

              return (
                <motion.button
                  key={item.title}
                  onClick={() => {
                    incrementDashboardUsage(item.page);
                    setCurrentPage(item.page);
                  }}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.04, type: "spring", stiffness: 200 }}
                  whileHover={{
                    y: -6,
                    scale: 1.02,
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative rounded-2xl p-5 text-right overflow-hidden transition-all duration-300"
                  style={{
                    background: isDark
                      ? "rgba(15,10,30,0.5)"
                      : "rgba(255,255,255,0.6)",
                    backdropFilter: "blur(16px)",
                    border: `1px solid ${isDark ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.12)"}`,
                    boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(139,92,246,0.06)",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = `${colors.glow}`;
                    el.style.boxShadow = `0 8px 30px ${colors.glow}, inset 0 0 0 0 transparent`;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = isDark ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.12)";
                    el.style.boxShadow = isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(139,92,246,0.06)";
                  }}
                >
                  <div className="relative flex items-center gap-4">
                    <motion.div
                      className="w-12 h-12 rounded-xl flex items-center justify-center relative overflow-hidden flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                        boxShadow: `0 6px 20px ${colors.glow}`,
                      }}
                      whileHover={{ rotate: [0, -5, 5, -5, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <svg className="w-6 h-6 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-base font-bold transition-all duration-300 ${isDark ? "text-white group-hover:text-purple-300" : "text-gray-900 group-hover:text-purple-700"}`}>
                        {item.title}
                      </h4>
                      <p className={`text-xs mt-1 line-clamp-1 ${isDark ? "text-purple-300/40" : "text-gray-500"}`}>
                        {item.description}
                      </p>
                    </div>
                    <motion.svg
                      className={`w-5 h-5 transition-all duration-300 ${isDark ? "text-purple-500/30 group-hover:text-purple-400" : "text-gray-300 group-hover:text-purple-500"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </motion.svg>
                  </div>

                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Footer */}
        <Footer className="mt-16" />
      </main>

      {/* AI Create/Update FAB - dashboard only */}
      <motion.button
        onClick={() => setAiCreateUpdateOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl text-white font-medium transition-all group"
        style={{
          background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
          boxShadow: "0 8px 30px rgba(139,92,246,0.4)",
        }}
        whileHover={{ scale: 1.05, boxShadow: "0 12px 40px rgba(139,92,246,0.5)" }}
        whileTap={{ scale: 0.98 }}
        title="ایجاد و بروزرسانی با AI"
        aria-label="ایجاد و بروزرسانی با AI"
      >
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-2xl animate-ping opacity-20" style={{
          background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
        }} />
        <svg className="w-5 h-5 shrink-0 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="hidden sm:inline relative z-10 text-sm">ایجاد/بروزرسانی AI</span>
      </motion.button>

      <AiCreateUpdateModal
        open={aiCreateUpdateOpen}
        onClose={() => setAiCreateUpdateOpen(false)}
        onSuccess={() => {
          setAiCreateUpdateOpen(false);
          getDashboardStats().then(setDashboardStats);
        }}
      />
    </div>
  );
}

export default App;
