import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, Check } from "lucide-react";

export interface SearchableSelectOption {
  id: number;
  label: string;
  [key: string]: unknown;
}

interface SearchableSelectProps<T> {
  options: T[];
  value: number;
  onChange: (value: number) => void;
  getOptionLabel: (option: T) => string;
  getOptionValue: (option: T) => number;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  dir?: "rtl" | "ltr";
  /** Optional extra line under each option (e.g. stock) */
  renderOptionExtra?: (option: T) => React.ReactNode;
}

export default function SearchableSelect<T>({
  options,
  value,
  onChange,
  getOptionLabel,
  getOptionValue,
  placeholder = "انتخاب کنید",
  searchPlaceholder = "جستجو بر اساس نام یا بارکد...",
  className = "",
  dir = "rtl",
  renderOptionExtra,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => getOptionValue(o) === value);
  const displayLabel = selectedOption ? getOptionLabel(selectedOption) : placeholder;

  const filteredOptions = options.filter((opt) => {
    const label = getOptionLabel(opt).toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return label.includes(q);
  });

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownRect(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update dropdown position on scroll/resize when open
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const updatePos = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownRect({
          top: rect.bottom,
          left: rect.left,
          width: rect.width,
        });
      }
    };
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [isOpen]);

  const handleSelect = (opt: T) => {
    onChange(getOptionValue(opt));
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} dir={dir}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none flex items-center justify-between gap-2 text-right transition-all duration-200 bg-white dark:bg-gray-800 ${isOpen
            ? "border-purple-400 dark:border-purple-500/40 ring-2 ring-purple-100 dark:ring-purple-500/10 shadow-md"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          }`}
      >
        <span className={`truncate flex-1 ${selectedOption ? "text-gray-800 dark:text-gray-200 font-medium" : "text-gray-400 dark:text-gray-500"}`}>
          {displayLabel}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-purple-400/60" />
        </motion.div>
      </button>

      {isOpen && dropdownRect && createPortal(
        <AnimatePresence>
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-[9999] rounded-xl border border-gray-200 dark:border-purple-500/15 max-h-72 flex flex-col overflow-hidden bg-white dark:bg-gray-800 shadow-xl dark:shadow-2xl dark:shadow-purple-900/20"
            style={{
              top: dropdownRect.top + 4,
              left: dropdownRect.left,
              width: dropdownRect.width,
            }}
          >
            {/* Search input */}
            <div className="p-2.5 border-b border-gray-100 dark:border-purple-500/10 sticky top-0 bg-white dark:bg-gray-800">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-purple-400/50 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pr-9 pl-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:border-purple-400 dark:focus:border-purple-500/50 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-500/10 transition-all duration-200 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            </div>

            {/* Options list */}
            <div className="overflow-y-auto flex-1 min-h-0 py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center bg-purple-50 dark:bg-purple-900/20">
                    <Search className="w-5 h-5 text-purple-300 dark:text-purple-400/40" />
                  </div>
                  <span className="text-sm text-gray-400 dark:text-gray-500">موردی یافت نشد</span>
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const optValue = getOptionValue(opt);
                  const isSelected = optValue === value;
                  return (
                    <button
                      key={optValue}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={`w-full px-3 py-2.5 text-right text-sm transition-all duration-150 flex items-center gap-2 ${isSelected
                          ? "bg-purple-50 dark:bg-purple-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-purple-900/10"
                        }`}
                    >
                      {/* Check icon for selected */}
                      <div className={`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center transition-all duration-200 ${isSelected ? "opacity-100" : "opacity-0"
                        }`}
                        style={{
                          background: isSelected ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "transparent",
                          boxShadow: isSelected ? "0 2px 6px rgba(139,92,246,0.3)" : "none",
                        }}
                      >
                        <Check className="w-3 h-3 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className={`block truncate ${isSelected
                            ? "text-purple-700 dark:text-purple-300 font-semibold"
                            : "text-gray-700 dark:text-gray-300"
                          }`}>
                          {getOptionLabel(opt)}
                        </span>
                        {renderOptionExtra && (
                          <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {renderOptionExtra(opt)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
