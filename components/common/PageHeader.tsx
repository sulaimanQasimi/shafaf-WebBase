import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ReactNode, useRef } from "react";

export interface ActionButton {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    className?: string;
    variant?: "primary" | "secondary" | "danger" | "warning";
}

interface PageHeaderProps {
    title: string;
    onBack?: () => void;
    backLabel?: string;
    actions?: ActionButton[];
    children?: ReactNode;
}

const variantGradients: Record<string, string> = {
    primary: "linear-gradient(135deg, #8b5cf6, #6366f1, #7c3aed)",
    secondary: "linear-gradient(135deg, #64748b, #475569, #6b7280)",
    danger: "linear-gradient(135deg, #ef4444, #ec4899, #f43f5e)",
    warning: "linear-gradient(135deg, #f59e0b, #f97316, #eab308)",
};

const variantShadows: Record<string, string> = {
    primary: "0 8px 25px rgba(139,92,246,0.35)",
    secondary: "0 8px 25px rgba(100,116,139,0.3)",
    danger: "0 8px 25px rgba(239,68,68,0.35)",
    warning: "0 8px 25px rgba(245,158,11,0.35)",
};

export default function PageHeader({
    title,
    onBack,
    backLabel = "بازگشت به داشبورد",
    actions = [],
    children
}: PageHeaderProps) {
    const titleRef = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseYSpring = useSpring(y, { stiffness: 500, damping: 100 });

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!titleRef.current) return;
        const rect = titleRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;
        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <>
            {/* Back Button */}
            {onBack && (
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
                        className="group relative flex items-center gap-3 px-5 py-3 rounded-xl border border-purple-200/30 dark:border-purple-500/15 transition-all duration-300 overflow-hidden"
                        style={{
                            background: "rgba(255,255,255,0.6)",
                            backdropFilter: "blur(12px)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "rgba(139,92,246,0.3)";
                            e.currentTarget.style.boxShadow = "0 8px 30px rgba(139,92,246,0.12)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "";
                            e.currentTarget.style.boxShadow = "";
                        }}
                    >
                        {/* Animated arrow */}
                        <motion.div
                            animate={{ x: [0, -4, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <svg
                                className="w-5 h-5 text-purple-500 dark:text-purple-400"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path d="M15 19l-7-7 7-7" />
                            </svg>
                        </motion.div>

                        <span className="text-sm font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-300 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent">
                            {backLabel}
                        </span>

                        {/* Shimmer on hover */}
                        <motion.div
                            className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-purple-200/20 dark:via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100"
                            initial={{ x: "-200%" }}
                            whileHover={{ x: "200%" }}
                            transition={{ duration: 0.8, ease: "easeInOut" }}
                        />
                    </motion.button>
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                className="mb-10"
            >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    {/* 3D Title with Parallax */}
                    <div
                        ref={titleRef}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        className="relative cursor-default min-w-0"
                    >
                        <motion.div
                            style={{
                                rotateX,
                                rotateY,
                                transformStyle: "preserve-3d",
                            }}
                            className="relative"
                        >
                            <motion.h1
                                className="text-2xl font-black leading-none relative"
                                style={{ transformStyle: "preserve-3d" }}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.6, delay: 0.15 }}
                            >
                                {/* Glow layer */}
                                <motion.span
                                    className="absolute inset-0 text-2xl font-black leading-none bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-300 dark:via-blue-300 dark:to-indigo-300 blur-2xl opacity-30 dark:opacity-40 pointer-events-none select-none"
                                    aria-hidden="true"
                                    animate={{ opacity: [0.3, 0.5, 0.3] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    {title}
                                </motion.span>
                                <span
                                    className="relative z-10 block text-2xl font-black leading-none bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-300 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent"
                                    style={{ transform: "translateZ(30px)" }}
                                >
                                    {title}
                                </span>
                            </motion.h1>
                        </motion.div>

                        {/* Animated underline */}
                        <motion.div
                            className="absolute -bottom-3 left-0 h-1 rounded-full"
                            style={{
                                background: "linear-gradient(90deg, #8b5cf6, #3b82f6, #6366f1)",
                                boxShadow: "0 2px 10px rgba(139,92,246,0.3)",
                            }}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "100%", opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                        />
                    </div>

                    {/* Action Buttons */}
                    {(actions.length > 0 || children) && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="flex gap-3 flex-wrap items-center"
                        >
                            {actions.map((action, index) => {
                                const variant = action.variant || "primary";
                                return (
                                    <motion.button
                                        key={index}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
                                        whileHover={{ scale: 1.05, y: -2 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={action.onClick}
                                        className={`relative px-6 py-3 text-white font-bold rounded-xl transition-all duration-300 flex items-center gap-2.5 overflow-hidden group ${action.className || ""}`}
                                        style={{
                                            background: variantGradients[variant],
                                            boxShadow: variantShadows[variant],
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.boxShadow = variantShadows[variant].replace("0.35", "0.5").replace("0.3", "0.45");
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.boxShadow = variantShadows[variant];
                                        }}
                                    >
                                        {/* Shine sweep */}
                                        <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />

                                        {/* Icon */}
                                        {action.icon && (
                                            <span className="relative z-10">
                                                {action.icon}
                                            </span>
                                        )}

                                        {/* Label */}
                                        <span className="relative z-10 text-sm tracking-wide">
                                            {action.label}
                                        </span>

                                        {/* Subtle inner border */}
                                        <div className="absolute inset-0 rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </motion.button>
                                );
                            })}
                            {children}
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </>
    );
}
