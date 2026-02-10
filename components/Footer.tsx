import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface FooterProps {
  className?: string;
}

export default function Footer({ className = "" }: FooterProps) {
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    // In Tauri: getVersion(); in Next.js/web show "Web"
    if (typeof window !== "undefined" && (window as any).__TAURI__) {
      import("@tauri-apps/api/app")
        .then(({ getVersion }) => getVersion().then(setAppVersion).catch(() => setAppVersion("")))
        .catch(() => setAppVersion("Web"));
    } else {
      setAppVersion("Web");
    }
  }, []);

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className={`mt-auto pt-8 pb-4 border-t border-gray-200 dark:border-gray-700 text-center ${className}`}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {appVersion && (
          <>
            <span className="font-semibold">شفاف</span> نسخه {appVersion}
            {" - "}
          </>
        )}
        Developed by{" "}
        <a
          href="https://www.galaxytechology.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold transition-colors duration-200 hover:underline"
        >
          Galaxy Technology
        </a>
        {" "}-{" "}
        <a
          href="https://www.galaxytechology.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors duration-200 hover:underline"
        >
          www.galaxytechology.com
        </a>
        {" "}-{" "}
      </p>
    </motion.footer>
  );
}
