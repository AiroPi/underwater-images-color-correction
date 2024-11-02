import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    esbuild: {
        supported: {
            // "top-level-await": true,
        },
    },
    plugins: [
        VitePWA({
            registerType: "autoUpdate",
            devOptions: {
                enabled: true,
            },
            includeAssets: ["favicon.ico", "favicon.svg", "pwa-192x192.png", "pwa-512x512.png", "apple-touch-icon.png"],
            manifest: {
                name: "Remove Water",
                short_name: "RMwater",
                icons: [
                    {
                        src: "/pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-maskable-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "maskable",
                    },
                    {
                        src: "/pwa-maskable-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
                start_url: "/?source=pwa",
                display: "standalone",
                background_color: "#FFFFFF",
                theme_color: "#64A2FF",
                description:
                    '"Remove the water" from your underwater image. This app tries to fix the colour of your photos.',
            },
        }),
    ],
});
