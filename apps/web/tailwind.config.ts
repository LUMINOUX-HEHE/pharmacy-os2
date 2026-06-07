import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "hsl(var(--navy-50))",
          100: "hsl(var(--navy-100))",
          900: "hsl(var(--navy-900))",
          950: "hsl(var(--navy-950))"
        },
        teal: {
          50: "hsl(var(--teal-50))",
          100: "hsl(var(--teal-100))",
          300: "hsl(var(--teal-300))",
          400: "hsl(var(--teal-400))",
          500: "hsl(var(--teal-500))",
          600: "hsl(var(--teal-600))",
          700: "hsl(var(--teal-700))"
        },
        amber: {
          50: "hsl(var(--amber-50))",
          200: "hsl(var(--amber-200))",
          500: "hsl(var(--amber-500))",
          700: "hsl(var(--amber-700))"
        },
        rose: {
          50: "hsl(var(--rose-50))",
          200: "hsl(var(--rose-200))",
          500: "hsl(var(--rose-500))",
          600: "hsl(var(--rose-600))",
          700: "hsl(var(--rose-700))"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"]
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        medium: "var(--shadow-medium)",
        hard: "var(--shadow-hard)",
        "glow-teal": "var(--shadow-glow-teal)",
        "glow-amber": "var(--shadow-glow-amber)"
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        26: "6.5rem"
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-500px 0" },
          "100%": { backgroundPosition: "500px 0" }
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 212, 170, 0.36)" },
          "50%": { boxShadow: "0 0 0 8px rgba(0, 212, 170, 0)" }
        }
      },
      animation: {
        fadeInUp: "fadeInUp 0.45s ease-out both",
        slideInRight: "slideInRight 0.4s ease-out both",
        shimmer: "shimmer 1.8s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
