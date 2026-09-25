import Link from "next/link";

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      D
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="size-4"
    >
      <path
        d="M4 10h12M11 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="size-5"
    >
      <circle cx="6" cy="6" r="2.25" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="18" r="2.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.25 6h2.5a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h-1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="size-5"
    >
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.5 18c.45-3.1 2.3-4.7 5.5-4.7s5.05 1.6 5.5 4.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M15 6.2a2.7 2.7 0 0 1 0 5.2M16 13.8c2.5.4 3.9 1.8 4.3 4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="size-5"
    >
      <path
        d="M12 3.5 19 6v5.2c0 4.5-2.8 7.7-7 9.3-4.2-1.6-7-4.8-7-9.3V6l7-2.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const features = [
  {
    icon: <RouteIcon />,
    title: "Built around your route",
    description:
      "Choose a Dhaka pickup and destination. Compatible riders can share the same trip.",
  },
  {
    icon: <UsersIcon />,
    title: "Pool without overbooking",
    description:
      "Every seat is accounted for. Bullet carries a maximum of three passengers.",
  },
  {
    icon: <ShieldIcon />,
    title: "Know what happens next",
    description:
      "Follow your ride from request and match through arrival, start, and completion.",
  },
];

export default function Home() {
  return (
    <main className="landing-shell">
      <header className="site-header">
        <div className="page-container header-inner">
          <Link href="/" className="brand" aria-label="Dhaka Tesla Pool home">
            <BrandMark />
            <span>Dhaka Tesla Pool</span>
          </Link>

          <Link href="/login" className="header-action">
            Sign in
            <ArrowIcon />
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />

        <div className="page-container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Ride pooling for Dhaka
            </div>

            <h1>
              Share a seat.
              <br />
              <span>Split the fare.</span>
              <br />
              Survive Dhaka traffic.
            </h1>

            <p className="hero-description">
              Pool compatible trips, keep every fare private, and move through
              Dhaka together in Bullet, Jashim&apos;s three-seat Tesla.
            </p>

            <div className="hero-actions">
              <Link href="/login?role=passenger" className="button button-primary">
                Find a ride
                <ArrowIcon />
              </Link>

              <Link href="/login?role=driver" className="button button-secondary">
                Driver access
              </Link>
            </div>

            <div className="hero-note">
              <div className="avatar-stack" aria-hidden="true">
                <span>N</span>
                <span>R</span>
                <span>S</span>
              </div>
              <p>
                One Tesla. <strong>3 passenger seats.</strong> Strict capacity.
              </p>
            </div>
          </div>

          <div className="ride-preview" aria-label="Example pooled ride">
            <div className="preview-top">
              <div>
                <p className="preview-label">Current pool</p>
                <h2>Banani pickup</h2>
              </div>
              <span className="status-pill">
                <span />
                Matching
              </span>
            </div>

            <div className="route-card">
              <div className="route-line" aria-hidden="true">
                <span className="route-point route-point-start" />
                <span className="route-stem" />
                <span className="route-point route-point-end" />
              </div>

              <div className="route-details">
                <div>
                  <span>Pickup</span>
                  <strong>Banani</strong>
                </div>

                <div>
                  <span>Shared destinations</span>
                  <strong>Mohakhali · Gulshan 1</strong>
                </div>
              </div>
            </div>

            <div className="vehicle-card">
              <div className="vehicle-visual" aria-hidden="true">
                <div className="car">
                  <span className="car-roof" />
                  <span className="car-body" />
                  <span className="car-wheel car-wheel-left" />
                  <span className="car-wheel car-wheel-right" />
                </div>
              </div>

              <div className="vehicle-copy">
                <p>Jashim&apos;s Tesla</p>
                <h3>Bullet</h3>
                <span>3-seat fixed capacity</span>
              </div>
            </div>

            <div className="seat-summary">
              <div>
                <span className="seat-avatar">N</span>
                <div>
                  <strong>Nusrat</strong>
                  <span>Mohakhali</span>
                </div>
              </div>

              <div>
                <span className="seat-avatar">R</span>
                <div>
                  <strong>Rafiq</strong>
                  <span>Gulshan 1</span>
                </div>
              </div>

              <div className="seat-open">
                <span>1</span>
                seat left
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="page-container">
          <div className="section-heading">
            <p>Simple by design</p>
            <h2>A small pool with clear rules.</h2>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="page-container footer-inner">
          <div className="brand footer-brand">
            <BrandMark />
            <span>Dhaka Tesla Pool</span>
          </div>

          <p>Share a seat. Split the fare. Survive Dhaka traffic.</p>
        </div>
      </footer>
    </main>
  );
}
