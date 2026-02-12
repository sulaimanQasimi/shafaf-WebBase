import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";
import Pagination from "./Pagination";

interface Column<T> {
    key: keyof T | string;
    label: string;
    sortable?: boolean;
    render?: (item: T) => React.ReactNode;
    className?: string;
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    total: number;
    page: number;
    perPage: number;
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: number) => void;
    onSort?: (key: string, direction: "asc" | "desc") => void;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    loading?: boolean;
    actions?: (item: T) => React.ReactNode;
}

export default function Table<T extends { id: number | string }>({
    data,
    columns,
    total,
    page,
    perPage,
    onPageChange,
    onPerPageChange,
    onSort,
    sortBy,
    sortOrder,
    loading,
    actions,
}: TableProps<T>) {
    const handleSort = (key: string) => {
        if (!onSort) return;
        if (sortBy === key) {
            onSort(key, sortOrder === "asc" ? "desc" : "asc");
        } else {
            onSort(key, "asc");
        }
    };

    return (
        <div className="w-full min-w-0 space-y-5">
            <div className="min-w-0 overflow-x-auto rounded-2xl border border-gray-200 dark:border-purple-500/10 shadow-lg dark:shadow-2xl dark:shadow-purple-900/10 overflow-hidden bg-white dark:bg-[#110d22]/80">
                {/* Gradient accent top border */}
                <div className="h-[2px]" style={{
                    background: "linear-gradient(90deg, #8b5cf6, #3b82f6, #ec4899, #8b5cf6)",
                    backgroundSize: "200% 100%",
                    animation: "gradient-shift 4s linear infinite",
                }} />

                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-purple-500/10 bg-gray-50/80 dark:bg-purple-950/20">
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className={`px-3 py-3 sm:px-5 sm:py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-purple-300/60 ${col.sortable ? "cursor-pointer select-none group hover:text-purple-600 dark:hover:text-purple-200 hover:bg-gray-100/60 dark:hover:bg-purple-900/20 transition-colors" : ""
                                        } ${col.className || ""}`}
                                    onClick={() => col.sortable && handleSort(col.key as string)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="transition-colors duration-200">
                                            {col.label}
                                        </span>
                                        {col.sortable && sortBy === col.key && (
                                            <motion.span
                                                initial={{ scale: 0, rotate: -90 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                className="flex items-center justify-center w-5 h-5 rounded-md"
                                                style={{
                                                    background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                                                    boxShadow: "0 2px 8px rgba(139,92,246,0.3)",
                                                }}
                                            >
                                                {sortOrder === "asc" ? (
                                                    <ChevronUp className="w-3.5 h-3.5 text-white" />
                                                ) : (
                                                    <ChevronDown className="w-3.5 h-3.5 text-white" />
                                                )}
                                            </motion.span>
                                        )}
                                        {col.sortable && sortBy !== col.key && (
                                            <span className="text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            {actions && (
                                <th className="px-3 py-3 sm:px-5 sm:py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-purple-300/60">
                                    عملیات
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length + (actions ? 1 : 0)} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            className="w-10 h-10 rounded-full border-[3px] border-purple-200 dark:border-purple-500/20 border-t-purple-500 dark:border-t-purple-400"
                                        />
                                        <span className="text-sm text-gray-400 dark:text-purple-300/30">در حال بارگذاری...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + (actions ? 1 : 0)} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-purple-50 dark:bg-purple-900/20">
                                            <svg className="w-8 h-8 text-purple-300 dark:text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-gray-400 dark:text-gray-500">هیچ داده‌ای یافت نشد</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            <AnimatePresence>
                                {data.map((item, index) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        transition={{ delay: index * 0.03, duration: 0.25 }}
                                        className={`group relative transition-all duration-200 border-b border-gray-100 dark:border-purple-500/5 last:border-b-0 hover:bg-purple-50/60 dark:hover:bg-purple-900/15 ${index % 2 === 1 ? "bg-gray-50/40 dark:bg-purple-950/10" : ""
                                            }`}
                                    >
                                        {columns.map((col, idx) => (
                                            <td key={idx} className="px-3 py-3 sm:px-5 sm:py-4 text-sm text-gray-700 dark:text-gray-300 transition-colors duration-200 group-hover:text-gray-900 dark:group-hover:text-white">
                                                {col.render ? col.render(item) : (item[col.key as keyof T] as React.ReactNode)}
                                            </td>
                                        ))}
                                        {actions && (
                                            <td className="px-3 py-3 sm:px-5 sm:py-4">
                                                {actions(item)}
                                            </td>
                                        )}
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                total={total}
                page={page}
                perPage={perPage}
                onPageChange={onPageChange}
                onPerPageChange={onPerPageChange}
            />
        </div>
    );
}
