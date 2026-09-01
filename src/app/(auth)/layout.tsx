export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-stretch justify-center overflow-hidden">
      {/* Evokes a course at golden hour without shipping a licensed photo. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg,#bfe0f2 0%,#d9ecc9 42%,#8fc27a 62%,#4f9a4a 100%)",
        }}
      />
      <svg
        aria-hidden
        className="absolute bottom-0 left-0 -z-10 w-full"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        height="42%"
      >
        <path
          fill="#5aa64f"
          d="M0,160 C240,80 480,220 720,180 C960,140 1200,60 1440,140 L1440,320 L0,320 Z"
        />
        <path
          fill="#3f8c3f"
          opacity="0.85"
          d="M0,240 C300,180 560,280 840,240 C1120,200 1300,260 1440,230 L1440,320 L0,320 Z"
        />
      </svg>

      <div className="flex w-full max-w-md flex-col justify-center bg-surface px-6 py-10 shadow-xl sm:my-0">
        {children}
      </div>
    </div>
  );
}
