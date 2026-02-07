/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                oxford: {
                    DEFAULT: "#064e3b",
                    dark: "#022c22",
                    light: "#059669",
                },
            },
        },
    },
    plugins: [],
}
