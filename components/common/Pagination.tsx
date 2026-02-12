import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
    total: number;
    page: number;
    perPage: number;
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: number) => void;
}

export default function Pagination({
    total,
    page,
    perPage,
    onPageChange,
    onPerPageChange,
}: PaginationProps) {
    const totalPages = Math.ceil(total / perPage);

    if (total <= 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
            {/* Per-page selector */}
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-purple-300/40">
                <span>نمایش</span>
                <select
                    value={perPage}
                    onChange={(e) => onPerPageChange(Number(e.target.value))}
                    className="appearance-none px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer focus:outline-none border border-gray-200 dark:border-purple-500/15 bg-white dark:bg-[#1a1035]/60 text-gray-700 dark:text-purple-200/70 focus:border-purple-400 dark:focus:border-purple-400/50 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-500/10"
                >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                </select>
                <span>مورد از <span className="font-semibold text-purple-600 dark:text-purple-300/60">{total}</span></span>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1 p-1 rounded-xl border border-gray-200 dark:border-purple-500/10 bg-white dark:bg-[#110d22]/60">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onPageChange(1)}
                    disabled={page === 1}
                    className="p-2 rounded-lg transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 dark:text-purple-300/40 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                >
                    <ChevronsRight className="w-4 h-4" />
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="p-2 rounded-lg transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 dark:text-purple-300/40 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                >
                    <ChevronRight className="w-4 h-4" />
                </motion.button>

                <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let p = page;
                        if (page < 3) p = i + 1;
                        else if (page > totalPages - 2) p = totalPages - 4 + i;
                        else p = page - 2 + i;

                        if (p < 1) p = 1;
                        if (p > totalPages) return null;

                        const isActive = page === p;

                        return (
                            <motion.button
                                key={p}
                                whileHover={{ scale: isActive ? 1 : 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onPageChange(p)}
                                className={`relative w-8 h-8 rounded-lg text-sm font-semibold transition-all duration-200 overflow-hidden ${isActive
                                        ? "text-white"
                                        : "text-gray-500 dark:text-purple-300/40 hover:text-purple-700 dark:hover:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activePage"
                                        className="absolute inset-0 rounded-lg"
                                        style={{
                                            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                                            boxShadow: "0 4px 15px rgba(139,92,246,0.35)",
                                        }}
                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    />
                                )}
                                <span className="relative z-10">{p}</span>
                            </motion.button>
                        );
                    })}
                </div>

                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 dark:text-purple-300/40 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                >
                    <ChevronLeft className="w-4 h-4" />
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onPageChange(totalPages)}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 dark:text-purple-300/40 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                >
                    <ChevronsLeft className="w-4 h-4" />
                </motion.button>
            </div>
        </div>
    );
}
