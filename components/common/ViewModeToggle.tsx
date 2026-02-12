import { List, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";

export type ViewMode = "table" | "thumbnail";

interface ViewModeToggleProps {
    viewMode: ViewMode;
    onChange: (mode: ViewMode) => void;
    tableLabel?: string;
    thumbnailLabel?: string;
}

export default function ViewModeToggle({
    viewMode,
    onChange,
    tableLabel = "لیست",
    thumbnailLabel = "کارت",
}: ViewModeToggleProps) {
    return (
        <div className="flex items-center gap-1 p-1 rounded-xl border border-gray-200 dark:border-purple-500/10 bg-white dark:bg-[#110d22]/60">
            <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onChange("table")}
                title={tableLabel}
                className={`relative p-2.5 rounded-lg transition-all duration-200 overflow-hidden ${viewMode === "table"
                    ? "text-white"
                    : "text-gray-500 dark:text-purple-300/40 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                    }`}
            >
                {viewMode === "table" && (
                    <motion.div
                        layoutId="viewModeActive"
                        className="absolute inset-0 rounded-lg"
                        style={{
                            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                            boxShadow: "0 4px 15px rgba(139,92,246,0.35)",
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                )}
                <List className="w-5 h-5 relative z-10" />
            </motion.button>
            <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onChange("thumbnail")}
                title={thumbnailLabel}
                className={`relative p-2.5 rounded-lg transition-all duration-200 overflow-hidden ${viewMode === "thumbnail"
                    ? "text-white"
                    : "text-gray-500 dark:text-purple-300/40 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                    }`}
            >
                {viewMode === "thumbnail" && (
                    <motion.div
                        layoutId="viewModeActive"
                        className="absolute inset-0 rounded-lg"
                        style={{
                            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                            boxShadow: "0 4px 15px rgba(139,92,246,0.35)",
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                )}
                <LayoutGrid className="w-5 h-5 relative z-10" />
            </motion.button>
        </div>
    );
}
