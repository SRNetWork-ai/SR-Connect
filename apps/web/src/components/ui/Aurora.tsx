/** پس‌زمینه‌ی هاله‌ای اسپلش و لاگین. فقط تزئینی است. */
export function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      <div
        className="absolute -top-40 -end-24 size-[420px] animate-float-slow rounded-full opacity-45 blur-[90px]"
        style={{ background: "radial-gradient(circle, #5865f2 0%, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-48 -start-28 size-[460px] animate-float-slow rounded-full opacity-30 blur-[100px]"
        style={{
          background: "radial-gradient(circle, #23a55a 0%, transparent 70%)",
          animationDelay: "-4s",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
    </div>
  );
}
