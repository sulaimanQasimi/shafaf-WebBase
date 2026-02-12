import { motion, AnimatePresence } from "framer-motion";
import Pagination from "./Pagination";

interface ThumbnailGridProps<T extends { id: number | string }> {
    data: T[];
    total: number;
    page: number;
    perPage: number;
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: number) => void;
    loading?: boolean;
    renderCard: (item: T) => React.ReactNode;
}

export default function ThumbnailGrid<T extends { id: number | string }>({
    data,
    total,
    page,
    perPage,
    onPageChange,
    onPerPageChange,
    loading,
    renderCard,
}: ThumbnailGridProps<T>) {
    return (
        <div className="w-full space-y-5">
            <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-purple-500/10 shadow-lg dark:shadow-2xl dark:shadow-purple-900/10 bg-white dark:bg-[#110d22]/80">
                {/* Gradient accent top border */}
                <div className="h-[2px]" style={{
                    background: "linear-gradient(90deg, #8b5cf6, #3b82f6, #ec4899, #8b5cf6)",
                    backgroundSize: "200% 100%",
                    animation: "gradient-shift 4s linear infinite",
                }} />

                <div className="p-4 sm:p-5">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center gap-3">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-10 h-10 rounded-full border-[3px] border-purple-200 dark:border-purple-500/20 border-t-purple-500 dark:border-t-purple-400"
                            />
                            <span className="text-sm text-gray-400 dark:text-purple-300/30">در حال بارگذاری...</span>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="py-20 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-purple-50 dark:bg-purple-900/20">
                                <svg className="w-8 h-8 text-purple-300 dark:text-purple-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <span className="text-sm text-gray-400 dark:text-gray-500">هیچ داده‌ای یافت نشد</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            <AnimatePresence>
                                {data.map((item, index) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{
                                            delay: index * 0.04,
                                            duration: 0.3,
                                            type: "spring",
                                            stiffness: 200,
                                        }}
                                        whileHover={{
                                            y: -4,
                                            scale: 1.02,
                                            transition: { duration: 0.2 },
                                        }}
                                        className="group relative rounded-xl border border-gray-100 dark:border-purple-500/10 hover:border-purple-300 dark:hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 dark:hover:shadow-purple-500/10 transition-all duration-300"
                                    >
                                        {renderCard(item)}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
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
