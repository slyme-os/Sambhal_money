"use client";

// Last-resort error screen. No store access here (the store may be what failed), so
// the copy is bilingual and the only action is to try again.

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <p className="text-2xl font-extrabold text-ink">कुछ गड़बड़ हो गई</p>
      <p className="text-lg font-semibold text-ink-2">Something went wrong</p>
      <p className="mt-3 text-base text-muted">आपका डेटा इस फ़ोन पर सुरक्षित है। · Your saved data is safe on this phone.</p>
      <button type="button" onClick={reset} className="press mt-6 min-h-14 w-full rounded-2xl bg-lime px-5 text-lg font-bold text-ink">
        फिर कोशिश करें · Try again
      </button>
    </main>
  );
}
