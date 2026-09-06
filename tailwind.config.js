/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ZelarSOAR brand tokens (design.md §2) */
        paper: "var(--paper)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        faint: "var(--faint)",
        line: {
          DEFAULT: "var(--line)",
          soft: "var(--line-soft)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          strong: "var(--brand-strong)",
          hover: "var(--brand-hover)",
          ink: "var(--brand-ink)",
          tint: "var(--brand-tint)",
          accent: "var(--accent)",
        },
        calm: {
          DEFAULT: "var(--calm)",
          tint: "var(--calm-tint)",
        },
        forest: {
          DEFAULT: "var(--forest)",
          2: "var(--forest-2)",
        },
        sev: {
          critical: "var(--sev-critical)",
          "critical-ink": "var(--sev-critical-ink)",
          "critical-tint": "var(--sev-critical-tint)",
          high: "var(--sev-high)",
          "high-ink": "var(--sev-high-ink)",
          "high-tint": "var(--sev-high-tint)",
          medium: "var(--sev-medium)",
          "medium-ink": "var(--sev-medium-ink)",
          "medium-tint": "var(--sev-medium-tint)",
          low: "var(--sev-low)",
          "low-ink": "var(--sev-low-ink)",
          "low-tint": "var(--sev-low-tint)",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "999px",
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        card: "var(--shadow-card)",
        "card-lg": "var(--shadow-card-lg)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "calm-pulse": "calm-pulse 2s ease-in-out infinite",
        "toast-rise": "toast-rise 0.25s ease-out",
        "spin-rot": "spin-rot 0.7s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}