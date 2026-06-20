import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ledger: {
          ink: "#1F2933",
          muted: "#617080",
          paper: "#F8F5EF",
          panel: "#FFFFFF",
          line: "#D8D3C9",
          teal: "#1F7A70",
          coral: "#D46A5B",
          amber: "#B8872A"
        }
      },
      boxShadow: {
        panel: "0 12px 35px rgba(31, 41, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
