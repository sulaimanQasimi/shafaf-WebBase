import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
    initAccountsTable,
    initAccountTransactionsTable,
    initAccountCurrencyBalancesTable,
    createAccount,
    getAccounts,
    updateAccount,
    deleteAccount,
    depositAccount,
    withdrawAccount,
    getAccountTransactions,
    getAllAccountBalances,
    type Account,
    type AccountTransaction,
    type AccountCurrencyBalance,
} from "@/lib/account";
import { getCurrencies, type Currency } from "@/lib/currency";
import { getCoaCategories, initStandardCoaCategories, type CoaCategory } from "@/lib/coa";
import { isDatabaseOpen, openDatabase } from "@/lib/db";
import Footer from "./Footer";
import PersianDatePicker from "./PersianDatePicker";
import { formatPersianDate, getCurrentPersianDate, persianToGeorgian } from "@/lib/date";
import PageHeader from "./common/PageHeader";
import CoaManagement from "./CoaManagement";
import JournalEntries from "./JournalEntries";
import { Plus, Edit, Trash2, ArrowUpCircle, ArrowDownCircle, Search, Wallet, History, FileText, Settings, X, Save, CheckCircle, AlertTriangle } from "lucide-react";

// Dari translations
const translations = {
    title: "مدیریت حساب‌ها",
    addNew: "ثبت حساب جدید",
    edit: "ویرایش",
    delete: "حذف",
    cancel: "لغو",
    save: "ذخیره",
    deposit: "واریز",
    withdraw: "برداشت",
    accountName: "نام حساب",
    currency: "ارز",
    initialBalance: "موجودی اولیه",
    currentBalance: "موجودی فعلی",
    notes: "یادداشت",
    amount: "مقدار",
    rate: "نرخ",
    total: "مجموع",
    date: "تاریخ",
    transactionType: "نوع تراکنش",
    full: "کامل",
    advance: "پیش‌پرداخت",
    isFull: "برداشت/واریز کامل",
    transactionHistory: "تاریخچه تراکنش‌ها",
    noAccounts: "هیچ حسابی ثبت نشده است",
    noTransactions: "هیچ تراکنشی ثبت نشده است",
    confirmDelete: "آیا از حذف این حساب اطمینان دارید؟",
    backToDashboard: "بازگشت به داشبورد",
    success: {
        created: "حساب با موفقیت ثبت شد",
        updated: "حساب با موفقیت بروزرسانی شد",
        deleted: "حساب با موفقیت حذف شد",
        deposited: "واریز با موفقیت انجام شد",
        withdrawn: "برداشت با موفقیت انجام شد",
    },
    errors: {
        create: "خطا در ثبت حساب",
        update: "خطا در بروزرسانی حساب",
        delete: "خطا در حذف حساب",
        fetch: "خطا در دریافت لیست حساب‌ها",
        nameRequired: "نام حساب الزامی است",
        amountRequired: "مقدار الزامی است",
        currencyRequired: "انتخاب ارز الزامی است",
        dateRequired: "تاریخ الزامی است",
        insufficientBalance: "موجودی کافی نیست",
        deposit: "خطا در واریز",
        withdraw: "خطا در برداشت",
    },
    placeholders: {
        accountName: "نام حساب را وارد کنید",
        currency: "ارز را انتخاب کنید",
        amount: "مقدار را وارد کنید",
        rate: "نرخ ارز",
        date: "تاریخ را انتخاب کنید",
        notes: "یادداشت (اختیاری)",
    },
};

interface AccountManagementProps {
    onBack?: () => void;
}

export default function AccountManagement({ onBack }: AccountManagementProps) {
    const [showCoaManagement, setShowCoaManagement] = useState(false);
    const [showJournalEntries, setShowJournalEntries] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [coaCategories, setCoaCategories] = useState<CoaCategory[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [accountBalances, setAccountBalances] = useState<AccountCurrencyBalance[]>([]);
    const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [transactionType, setTransactionType] = useState<"deposit" | "withdraw">("deposit");
    const [accountFormData, setAccountFormData] = useState({
        name: "",
        currency_id: "",
        coa_category_id: "",
        account_code: "",
        account_type: "",
        initial_balance: "",
        is_active: true,
        notes: "",
    });
    const [transactionFormData, setTransactionFormData] = useState({
        amount: "",
        currency: "",
        rate: "1",
        total: "",
        date: persianToGeorgian(getCurrentPersianDate()) || new Date().toISOString().split('T')[0],
        is_full: false,
        notes: "",
    });

    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const dbOpen = await isDatabaseOpen();
            if (!dbOpen) {
                await openDatabase("db");
            }

            try {
                await initAccountsTable();
                await initAccountTransactionsTable();
                await initAccountCurrencyBalancesTable();
                await initStandardCoaCategories().catch(() => { });
            } catch (err) {
                console.log("Table initialization:", err);
            }

            const [accountsData, currenciesData, categoriesData] = await Promise.all([
                getAccounts(),
                getCurrencies(),
                getCoaCategories().catch(() => []),
            ]);

            setAccounts(accountsData);
            setCurrencies(currenciesData);
            setCoaCategories(categoriesData);
        } catch (error: any) {
            toast.error(translations.errors.fetch);
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadTransactions = async (accountId: number) => {
        try {
            const [transactionsData, balancesData] = await Promise.all([
                getAccountTransactions(accountId),
                getAllAccountBalances(accountId).catch(() => []),
            ]);
            setTransactions(transactionsData);
            setAccountBalances(balancesData);
        } catch (error: any) {
            console.error("Error loading transactions:", error);
        }
    };

    const calculateTotal = () => {
        const amount = parseFloat(transactionFormData.amount) || 0;
        const rate = parseFloat(transactionFormData.rate) || 1;
        return amount * rate;
    };

    useEffect(() => {
        if (!transactionFormData.is_full) {
            const total = calculateTotal();
            setTransactionFormData(prev => ({ ...prev, total: total.toFixed(2) }));
        }
    }, [transactionFormData.amount, transactionFormData.rate, transactionFormData.is_full]);

    const handleOpenAccountModal = (account?: Account) => {
        if (account) {
            setEditingAccount(account);
            setAccountFormData({
                name: account.name,
                currency_id: account.currency_id?.toString() || "",
                coa_category_id: account.coa_category_id?.toString() || "",
                account_code: account.account_code || "",
                account_type: account.account_type || "",
                initial_balance: account.initial_balance.toString(),
                is_active: account.is_active,
                notes: account.notes || "",
            });
        } else {
            setEditingAccount(null);
            setAccountFormData({
                name: "",
                currency_id: "",
                coa_category_id: "",
                account_code: "",
                account_type: "",
                initial_balance: "",
                is_active: true,
                notes: "",
            });
        }
        setIsAccountModalOpen(true);
    };

    const handleCloseAccountModal = () => {
        setIsAccountModalOpen(false);
        setEditingAccount(null);
        setAccountFormData({
            name: "",
            currency_id: "",
            coa_category_id: "",
            account_code: "",
            account_type: "",
            initial_balance: "",
            is_active: true,
            notes: "",
        });
    };

    const handleOpenTransactionModal = (account: Account, type: "deposit" | "withdraw") => {
        setSelectedAccount(account);
        setTransactionType(type);
        setTransactionFormData({
            amount: "",
            currency: currencies[0]?.name || "",
            rate: "1",
            total: "",
            date: persianToGeorgian(getCurrentPersianDate()) || new Date().toISOString().split('T')[0],
            is_full: false,
            notes: "",
        });
        setIsTransactionModalOpen(true);
    };

    const handleCloseTransactionModal = () => {
        setIsTransactionModalOpen(false);
        setSelectedAccount(null);
        setTransactionFormData({
            amount: "",
            currency: "",
            rate: "1",
            total: "",
            date: persianToGeorgian(getCurrentPersianDate()) || new Date().toISOString().split('T')[0],
            is_full: false,
            notes: "",
        });
    };

    const handleAccountSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!accountFormData.name.trim()) {
            toast.error(translations.errors.nameRequired);
            return;
        }

        try {
            setLoading(true);
            if (editingAccount) {
                await updateAccount(
                    editingAccount.id,
                    accountFormData.name,
                    accountFormData.currency_id ? parseInt(accountFormData.currency_id, 10) : null,
                    accountFormData.coa_category_id ? parseInt(accountFormData.coa_category_id, 10) : null,
                    accountFormData.account_code || null,
                    accountFormData.account_type || null,
                    parseFloat(accountFormData.initial_balance) || 0,
                    accountFormData.is_active,
                    accountFormData.notes || null
                );
                toast.success(translations.success.updated);
            } else {
                await createAccount(
                    accountFormData.name,
                    accountFormData.currency_id ? parseInt(accountFormData.currency_id, 10) : null,
                    accountFormData.coa_category_id ? parseInt(accountFormData.coa_category_id, 10) : null,
                    accountFormData.account_code || null,
                    accountFormData.account_type || null,
                    parseFloat(accountFormData.initial_balance) || 0,
                    accountFormData.notes || null
                );
                toast.success(translations.success.created);
            }
            handleCloseAccountModal();
            await loadData();
        } catch (error: any) {
            toast.error(editingAccount ? translations.errors.update : translations.errors.create);
            console.error("Error saving account:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTransactionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedAccount) return;

        if (!transactionFormData.currency) {
            toast.error(translations.errors.currencyRequired);
            return;
        }

        if (!transactionFormData.is_full && (!transactionFormData.amount || parseFloat(transactionFormData.amount) <= 0)) {
            toast.error(translations.errors.amountRequired);
            return;
        }

        if (!transactionFormData.date) {
            toast.error(translations.errors.dateRequired);
            return;
        }

        const amount = parseFloat(transactionFormData.amount) || 0;
        const rate = parseFloat(transactionFormData.rate) || 1;

        try {
            setLoading(true);
            if (transactionType === "deposit") {
                await depositAccount(
                    selectedAccount.id,
                    amount,
                    transactionFormData.currency,
                    rate,
                    transactionFormData.date,
                    transactionFormData.is_full,
                    transactionFormData.notes || null
                );
                toast.success(translations.success.deposited);
            } else {
                await withdrawAccount(
                    selectedAccount.id,
                    amount,
                    transactionFormData.currency,
                    rate,
                    transactionFormData.date,
                    transactionFormData.is_full,
                    transactionFormData.notes || null
                );
                toast.success(translations.success.withdrawn);
            }
            handleCloseTransactionModal();
            await loadData();
            if (selectedAccount) {
                await loadTransactions(selectedAccount.id);
            }
        } catch (error: any) {
            const errorMessage = error.toString();
            if (errorMessage.includes("Insufficient") || errorMessage.includes("موجودی")) {
                toast.error(translations.errors.insufficientBalance);
            } else {
                toast.error(transactionType === "deposit" ? translations.errors.deposit : translations.errors.withdraw);
            }
            console.error("Error processing transaction:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            setLoading(true);
            await deleteAccount(id);
            toast.success(translations.success.deleted);
            setDeleteConfirm(null);
            await loadData();
            if (selectedAccount?.id === id) {
                setSelectedAccount(null);
                setTransactions([]);
                setAccountBalances([]);
            }
        } catch (error: any) {
            toast.error(translations.errors.delete);
            console.error("Error deleting account:", error);
        } finally {
            setLoading(false);
        }
    };

    const getCurrencyName = (currencyId: number | null | undefined): string => {
        if (!currencyId) return "نامشخص";
        const currency = currencies.find(c => c.id === currencyId);
        return currency ? currency.name : "نامشخص";
    };

    const handleSelectAccount = async (account: Account) => {
        setSelectedAccount(account);
        await loadTransactions(account.id);
    };

    if (showCoaManagement) {
        return <CoaManagement onBack={() => { setShowCoaManagement(false); loadData(); }} />;
    }

    if (showJournalEntries) {
        return <JournalEntries onBack={() => { setShowJournalEntries(false); }} />;
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/20 dark:bg-none p-4 sm:p-6 lg:p-8" dir="rtl">
            {/* Dark mode mesh background */}
            <div className="fixed inset-0 -z-10 bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/20 dark:from-[#0f0a1e] dark:via-[#1a1035] dark:to-[#0d1b2a]" />
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-[5]">
                <motion.div
                    animate={{ x: [0, 60, -30, 40, 0], y: [0, -40, 30, -20, 0], scale: [1, 1.15, 0.9, 1.05, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-30 dark:opacity-100"
                    style={{ background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)", filter: "blur(60px)" }}
                />
            </div>

            <div className="max-w-7xl mx-auto">
                <PageHeader
                    title={translations.title}
                    onBack={onBack}
                    backLabel={translations.backToDashboard}
                    actions={[
                        {
                            label: "دفتر روزنامه",
                            onClick: () => setShowJournalEntries(true),
                            variant: "secondary",
                            icon: <FileText className="w-4 h-4" />
                        },
                        {
                            label: "COA دسته",
                            onClick: () => setShowCoaManagement(true),
                            variant: "secondary",
                            icon: <Settings className="w-4 h-4" />
                        },
                        {
                            label: translations.addNew,
                            onClick: () => handleOpenAccountModal(),
                            variant: "primary",
                            icon: <Plus className="w-4 h-4" />
                        }
                    ]}
                />

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-8">
                    {/* ─── Accounts List Panel ─── */}
                    <motion.div
                        className="xl:col-span-5 flex flex-col gap-5"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        {/* Search/Filter placeholder could go here */}

                        <div className="space-y-4">
                            {accounts.length === 0 && !loading ? (
                                <div className="text-center py-12 bg-white/50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400">
                                        <Wallet className="w-8 h-8" />
                                    </div>
                                    <p className="text-gray-500 dark:text-gray-400">{translations.noAccounts}</p>
                                </div>
                            ) : (
                                accounts.map((account, index) => (
                                    <motion.div
                                        key={account.id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => handleSelectAccount(account)}
                                        className={`group relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden ${selectedAccount?.id === account.id
                                                ? "bg-white dark:bg-[#110d22] border-purple-500 shadow-xl shadow-purple-500/10 dark:shadow-purple-900/20"
                                                : "bg-white/80 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/50 hover:border-purple-300 dark:hover:border-purple-500/30 hover:shadow-lg"
                                            }`}
                                    >
                                        {selectedAccount?.id === account.id && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent pointer-events-none" />
                                        )}

                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedAccount?.id === account.id
                                                        ? "bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-lg"
                                                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 group-hover:text-purple-600 dark:group-hover:text-purple-400"
                                                    }`}>
                                                    <Wallet className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{account.name}</h3>
                                                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                        <span className="bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-600">
                                                            {getCurrencyName(account.currency_id)}
                                                        </span>
                                                        {account.account_type && (
                                                            <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800/30">
                                                                {account.account_type}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenAccountModal(account); }}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(account.id); }}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-end justify-between relative z-10">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">موجودی فعلی</p>
                                                <p className={`text-xl font-bold font-mono tracking-tight ${account.current_balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                                    }`}>
                                                    {account.current_balance.toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenTransactionModal(account, "deposit"); }}
                                                    className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-xs font-semibold flex items-center gap-1"
                                                >
                                                    <ArrowDownCircle className="w-3.5 h-3.5" />
                                                    {translations.deposit}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOpenTransactionModal(account, "withdraw"); }}
                                                    className="p-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors text-xs font-semibold flex items-center gap-1"
                                                >
                                                    <ArrowUpCircle className="w-3.5 h-3.5" />
                                                    {translations.withdraw}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </motion.div>

                    {/* ─── Transaction Detail Panel ─── */}
                    <div className="xl:col-span-7">
                        <motion.div
                            className="bg-white/90 dark:bg-[#110d22]/80 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-purple-500/10 shadow-2xl shadow-purple-900/5 h-[calc(100vh-140px)] flex flex-col overflow-hidden sticky top-24"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            {/* Gradient Header */}
                            <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500" />

                            {!selectedAccount ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400 dark:text-gray-500">
                                    <div className="w-24 h-24 mb-6 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                                        <History className="w-10 h-10 opacity-50" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2 text-gray-600 dark:text-gray-300">حسابی انتخاب نشده است</h3>
                                    <p className="max-w-xs mx-auto text-sm">برای مشاهده تاریخچه تراکنش‌ها و جزئیات، لطفاً یک حساب را از لیست انتخاب کنید.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <History className="w-5 h-5 text-purple-500" />
                                                {translations.transactionHistory}
                                                <span className="text-gray-400 text-sm font-normal mx-2">|</span>
                                                <span className="text-purple-600 dark:text-purple-400 text-lg">{selectedAccount.name}</span>
                                            </h3>
                                        </div>

                                        {accountBalances.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {accountBalances.map((balance) => {
                                                    const currency = currencies.find(c => c.id === balance.currency_id);
                                                    return (
                                                        <div key={balance.id} className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm">
                                                            <span className="text-gray-500 dark:text-gray-400 text-xs">{currency?.name || "ارز"}:</span>
                                                            <span className={`font-mono font-bold ${balance.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                                                {balance.balance.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                                        {transactions.length === 0 ? (
                                            <div className="text-center py-12">
                                                <div className="inline-block p-4 rounded-full bg-gray-50 dark:bg-gray-800/50 mb-3 text-gray-400">
                                                    <Search className="w-6 h-6" />
                                                </div>
                                                <p className="text-gray-500 dark:text-gray-400">{translations.noTransactions}</p>
                                            </div>
                                        ) : (
                                            transactions.map((transaction, idx) => (
                                                <motion.div
                                                    key={transaction.id}
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="group flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-500/30 bg-white dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
                                                >
                                                    {/* Icon & Type */}
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${transaction.transaction_type === "deposit"
                                                            ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                                                            : "bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                                                        }`}>
                                                        {transaction.transaction_type === "deposit" ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                                                    </div>

                                                    {/* Main Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-sm font-bold ${transaction.transaction_type === "deposit" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                                                                }`}>
                                                                {transaction.transaction_type === "deposit" ? translations.deposit : translations.withdraw}
                                                            </span>
                                                            {transaction.is_full && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                                    {translations.full}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                                                            <span className="flex items-center gap-1">
                                                                <FileText className="w-3 h-3" />
                                                                {formatPersianDate(transaction.transaction_date)}
                                                            </span>
                                                            {transaction.notes && (
                                                                <span className="text-gray-400 dark:text-gray-500 truncate max-w-[200px]" title={transaction.notes}>
                                                                    {transaction.notes}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Amount Values */}
                                                    <div className="text-left flex-shrink-0 flex flex-col items-end">
                                                        <div className={`text-lg font-bold font-mono tracking-tight ${transaction.transaction_type === "deposit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                                            }`}>
                                                            {transaction.transaction_type === "deposit" ? "+" : "-"}{transaction.total.toLocaleString()}
                                                        </div>
                                                        <div className="text-xs text-gray-400 dark:text-gray-500">
                                                            {transaction.amount.toLocaleString()} {transaction.currency} <span className="text-[10px] opacity-70">(@ {transaction.rate})</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>
                </div>

                {/* Account Form Modal */}
                <AnimatePresence>
                    {isAccountModalOpen && (
                        <Modal onClose={handleCloseAccountModal} title={editingAccount ? translations.edit : translations.addNew}>
                            <form onSubmit={handleAccountSubmit} className="space-y-4">
                                <Input label={translations.accountName} value={accountFormData.name} onChange={e => setAccountFormData({ ...accountFormData, name: e.target.value })} required autoFocus />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Select label={translations.currency} value={accountFormData.currency_id} onChange={e => setAccountFormData({ ...accountFormData, currency_id: e.target.value })}>
                                        <option value="">انتخاب ارز (اختیاری)</option>
                                        {currencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </Select>
                                    <Select label="دسته COA" value={accountFormData.coa_category_id} onChange={e => setAccountFormData({ ...accountFormData, coa_category_id: e.target.value })}>
                                        <option value="">انتخاب دسته (اختیاری)</option>
                                        {coaCategories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                                    </Select>
                                    <Input label="کد حساب" value={accountFormData.account_code} onChange={e => setAccountFormData({ ...accountFormData, account_code: e.target.value })} dir="ltr" />
                                    <Select label="نوع حساب" value={accountFormData.account_type} onChange={e => setAccountFormData({ ...accountFormData, account_type: e.target.value })}>
                                        <option value="">انتخاب نوع (اختیاری)</option>
                                        <option value="Asset">دارایی</option>
                                        <option value="Liability">بدهی</option>
                                        <option value="Equity">حقوق صاحبان سهام</option>
                                        <option value="Revenue">درآمد</option>
                                        <option value="Expense">هزینه</option>
                                    </Select>
                                    <Input label={translations.initialBalance} type="number" step="0.01" value={accountFormData.initial_balance} onChange={e => setAccountFormData({ ...accountFormData, initial_balance: e.target.value })} dir="ltr" />
                                    <div className="flex items-center h-full pt-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={accountFormData.is_active} onChange={e => setAccountFormData({ ...accountFormData, is_active: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">حساب فعال</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{translations.notes}</label>
                                    <textarea
                                        value={accountFormData.notes}
                                        onChange={e => setAccountFormData({ ...accountFormData, notes: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all resize-none"
                                        placeholder={translations.placeholders.notes}
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <Button variant="secondary" onClick={handleCloseAccountModal} className="flex-1">{translations.cancel}</Button>
                                    <Button type="submit" variant="primary" loading={loading} className="flex-1">{translations.save}</Button>
                                </div>
                            </form>
                        </Modal>
                    )}
                </AnimatePresence>

                {/* Transaction Modal */}
                <AnimatePresence>
                    {isTransactionModalOpen && selectedAccount && (
                        <Modal onClose={handleCloseTransactionModal} title={`${transactionType === 'deposit' ? translations.deposit : translations.withdraw} - ${selectedAccount.name}`}>
                            <form onSubmit={handleTransactionSubmit} className="space-y-4">
                                <label className="flex items-center gap-2 mb-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={transactionFormData.is_full}
                                        onChange={(e) => setTransactionFormData({ ...transactionFormData, is_full: e.target.checked, amount: e.target.checked ? "" : transactionFormData.amount })}
                                        className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-bold text-purple-700 dark:text-purple-300">{translations.isFull}</span>
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Select label={translations.currency} value={transactionFormData.currency} onChange={e => setTransactionFormData({ ...transactionFormData, currency: e.target.value })} required>
                                        <option value="">{translations.placeholders.currency}</option>
                                        {currencies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </Select>
                                    <Input label={translations.amount} type="number" step="0.01" value={transactionFormData.amount} onChange={e => setTransactionFormData({ ...transactionFormData, amount: e.target.value })} disabled={transactionFormData.is_full} required={!transactionFormData.is_full} dir="ltr" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label={translations.rate} type="number" step="0.01" value={transactionFormData.rate} onChange={e => setTransactionFormData({ ...transactionFormData, rate: e.target.value })} required dir="ltr" />
                                    <Input label={translations.total} value={transactionFormData.is_full ? "محاسبه می‌شود" : transactionFormData.total} readOnly dir="ltr" className="bg-gray-100 dark:bg-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{translations.date}</label>
                                    <PersianDatePicker value={transactionFormData.date} onChange={date => setTransactionFormData({ ...transactionFormData, date })} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{translations.notes}</label>
                                    <textarea value={transactionFormData.notes} onChange={e => setTransactionFormData({ ...transactionFormData, notes: e.target.value })} rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all resize-none" />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <Button variant="secondary" onClick={handleCloseTransactionModal} className="flex-1">{translations.cancel}</Button>
                                    <Button type="submit" variant={transactionType === 'deposit' ? 'success' : 'danger'} loading={loading} className="flex-1">
                                        {transactionType === 'deposit' ? translations.deposit : translations.withdraw}
                                    </Button>
                                </div>
                            </form>
                        </Modal>
                    )}
                </AnimatePresence>

                {/* Delete Modal */}
                <AnimatePresence>
                    {deleteConfirm && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                onClick={e => e.stopPropagation()}
                                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-md border border-red-100 dark:border-red-900/30 text-center"
                            >
                                <div className="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                                    <AlertTriangle className="w-10 h-10" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{translations.delete}</h2>
                                <p className="text-gray-600 dark:text-gray-400 mb-8">{translations.confirmDelete}</p>
                                <div className="flex gap-3">
                                    <Button variant="secondary" onClick={() => setDeleteConfirm(null)} className="flex-1">{translations.cancel}</Button>
                                    <Button variant="danger" onClick={() => handleDelete(deleteConfirm)} loading={loading} className="flex-1">{translations.delete}</Button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <Footer />
            </div>
        </div>
    );
}

// Reuseable Components
function Modal({ children, title, onClose }: { children: React.ReactNode, title: string, onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-[#1a1035] rounded-2xl shadow-2xl border border-gray-200 dark:border-purple-500/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
                <div className="sticky top-0 z-10 bg-white/10 dark:bg-[#1a1035] backdrop-blur-md border-b border-gray-100 dark:border-purple-500/10 p-5 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-gray-500 dark:text-gray-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </motion.div>
        </div>
    );
}

function Input({ label, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
            <input
                className={`w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all ${className}`}
                {...props}
            />
        </div>
    );
}

function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
            <select
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 transition-all appearance-none cursor-pointer"
                dir="rtl"
                {...props}
            >
                {children}
            </select>
        </div>
    );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    loading?: boolean;
}

function Button({ children, variant = 'primary', loading, className = "", ...props }: ButtonProps) {
    const variants = {
        primary: "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/20",
        secondary: "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white",
        danger: "bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/20",
        success: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20",
    };

    const {
        onAnimationStart,
        onAnimationEnd,
        onAnimationIteration,
        onDragStart,
        onDrag,
        onDragEnd,
        ...restProps
    } = props;

    return (
        <motion.button
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            disabled={loading || props.disabled}
            className={`px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
            {...restProps}
        >
            {loading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {children}
        </motion.button>
    );
}
