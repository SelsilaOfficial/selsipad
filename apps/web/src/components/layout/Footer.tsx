// import NextImage from 'next/image';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-8 mt-auto">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
          {/* Logo Removed */}
        </div>

        <div className="flex items-center gap-8 text-sm text-gray-500">
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>
          <Link href="/security" className="hover:text-white transition-colors">
            Security
          </Link>
          <Link
            href="https://twitter.com"
            target="_blank"
            className="hover:text-white transition-colors"
          >
            Twitter
          </Link>
          <Link href="https://t.me" target="_blank" className="hover:text-white transition-colors">
            Telegram
          </Link>
        </div>

        <div className="text-xs text-gray-600">© 2024 Selsipad Ecosystem. All rights reserved.</div>
      </div>
      <div className="container mx-auto px-4 mt-8 pb-4 border-t border-white/5 pt-4">
        <p className="text-[10px] text-gray-600 text-center leading-relaxed">
          Disclaimer: Selsipad will never endorse or encourage that you invest in any of the
          projects listed and therefore, accept no liability for any loss occasioned. It is the
          user(s) responsibility to do their own research and seek financial advice from a
          professional. More information about (DYOR) can be found via Binance Academy.
        </p>
      </div>
    </footer>
  );
}
