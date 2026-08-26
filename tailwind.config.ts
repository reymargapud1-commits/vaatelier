import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fbf3f2",
          100: "#f5e1e3",
          200: "#eac0c6",
          300: "#d998a2",
          400: "#c06b7c",
          500: "#9f3f55",
          600: "#7a1f35",
          700: "#611829",
          800: "#431019",
          900: "#2b1620",
        },
        gold: {
          50: "#fbf7ee",
          100: "#f5ead2",
          200: "#e9d3a4",
          300: "#dbb877",
          400: "#c7a464",
          500: "#b08a45",
          600: "#8f6c33",
          700: "#6f5227",
        },
      },
      fontFamily: {
        serif: ["'Cormorant'", "Georgia", "'Times New Roman'", "serif"],
        sans: [
          "'Manrope'",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
