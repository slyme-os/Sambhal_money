import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <p className="text-2xl font-extrabold text-ink">यह पेज नहीं मिला</p>
      <p className="text-lg font-semibold text-ink-2">Page not found</p>
      <Link href="/" className="press mt-6 grid min-h-14 w-full place-items-center rounded-2xl bg-lime px-5 text-lg font-bold text-ink">
        घर जाएँ · Go home
      </Link>
    </main>
  );
}
