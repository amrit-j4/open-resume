/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      // Radius scale matches Reactive Resume (--radius: 0.3rem). `full` stays for circles.
      borderRadius: {
        sm: "calc(var(--radius) * 0.6)",
        DEFAULT: "calc(var(--radius) * 0.8)",
        md: "calc(var(--radius) * 0.8)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) * 1.4)",
        "2xl": "calc(var(--radius) * 1.8)",
        "3xl": "calc(var(--radius) * 2.2)",
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans Variable"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      backgroundImage: {
        dot: "url('/assets/dots.svg')",
      },
    },
  },
  corePlugins: {
    aspectRatio: false,
  },
  plugins: [
    require("tailwind-scrollbar")({ nocompatible: true }),
    require("@tailwindcss/aspect-ratio"),
  ],
};
