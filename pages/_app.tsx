import type { AppProps } from "next/app";
import { IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "../lib/theme";

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <div className={plex.className}>
        <Component {...pageProps} />
      </div>
      <style jsx global>{`
        :root {
          --color-primary: #127ae2;
          --color-bg: #0a0a0a;
          --color-surface: #111111;
          --color-surface-2: #1a1a2e;
          --color-border: #333333;
          --color-text: #ffffff;
          --color-text-muted: #999999;
          --app-font-family: "IBM Plex Mono", monospace;
        }
        :root[data-theme="light"] {
          --color-primary: #127ae2;
          --color-bg: #f4f7fb;
          --color-surface: #ffffff;
          --color-surface-2: #edf3fc;
          --color-border: #ced8e8;
          --color-text: #0f1b2a;
          --color-text-muted: #4f647a;
        }
        html,
        body,
        #__next {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          font-family: var(--app-font-family);
          background: var(--color-bg);
          color: var(--color-text);
        }
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }
      `}</style>
    </ThemeProvider>
  );
}
