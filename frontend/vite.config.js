import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "tailwindcss";
import path from "path";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // server: {
  //   proxy: {
  //     // Proxy all requests starting with "/api" to your backend
  //     "/api": {
  //       target: "http://localhost:5000", // Your backend URL
  //       changeOrigin: true, // Change the origin of the request to the target URL
  //       rewrite: (path) => path.replace(/^\/api/, ""), // Remove the "/api" prefix
  //     },
  //   },
  // },
});
