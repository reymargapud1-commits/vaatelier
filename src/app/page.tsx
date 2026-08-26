import Link from "next/link";
import Navbar from "@/components/Navbar";
import { LogoMark } from "@/components/Logo";
import curriculum from "../../content/curriculum.json";

const COACH_NAME = process.env.COACH_NAME || "Reymar Gapud";
const COACH_TITLE = process.env.COACH_TITLE || "VA Coach & Trainer";
const PRICE_DISPLAY = "₱2,999";

export default function LandingPage() {
  const totalLessons = curriculum.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const initials = COACH_NAME.split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm">
            🇵🇭 A boutique training studio for aspiring Filipino Virtual Assistants
          </span>
          <h1 className="mx-auto max-w-3xl font-serif text-5xl font-semibold leading-[1.1] tracking-tight text-brand-900 sm:text-6xl">
            Become a Job-Ready{" "}
            <span className="italic text-brand-600">Virtual Assistant</span>{" "}
            — From Zero to Your First Client
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            {curriculum.courseDescription}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary text-lg shadow-lg shadow-brand-600/20">
              Enroll Now — {PRICE_DISPLAY}
            </Link>
            <a href="#curriculum" className="btn-secondary text-lg">
              See What's Inside
            </a>
          </div>
          <p className="mt-5 text-sm text-gray-500">
            One-time payment · Lifetime access · Pay securely via GCash, Maya, or Card
          </p>
        </div>
      </section>

      {/* Trailer */}
      <section className="bg-brand-900 py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl shadow-2xl shadow-black/40 ring-1 ring-white/10">
            <video
              className="aspect-video w-full bg-black"
              src="/trailer.mp4"
              controls
              playsInline
              preload="metadata"
            />
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            30 seconds. This is the life you're training for.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-white py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 text-center sm:grid-cols-4">
          <Stat icon="🎥" label="Video Lessons" value={`${totalLessons}`} />
          <Stat icon="📚" label="Modules" value={`${curriculum.modules.length}`} />
          <Stat icon="📝" label="Quizzes" value={`${curriculum.modules.length}`} />
          <Stat icon="🎓" label="Certificate" value="1" />
        </div>
      </section>

      {/* What you'll learn */}
      <section id="curriculum" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <h2 className="mb-2 text-center text-3xl font-bold text-gray-900 sm:text-4xl">
          What You'll Learn
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-gray-600">
          A complete, structured path from total beginner to landing your first paying VA client.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {curriculum.modules.map((mod, i) => (
            <div
              key={mod.id}
              className="card transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="font-bold text-gray-900">
                  {mod.title.replace(/^Module \d+:\s*/, "")}
                </h3>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-600">
                {mod.lessons.map((l) => (
                  <li key={l.id} className="flex items-start gap-2">
                    <span className="mt-1 text-brand-500">▪</span>
                    {l.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="card flex flex-col items-center justify-center border-2 border-dashed border-brand-200 bg-brand-50/50 text-center">
            <div className="mb-2 text-3xl">🎙️</div>
            <h3 className="font-bold text-gray-900">Bonus: Live 1-on-1 Coaching Session</h3>
            <p className="mt-1 text-sm text-gray-600">
              Before you finish, schedule a live session with your coach for personalized
              feedback and questions.
            </p>
          </div>
        </div>
      </section>

      {/* Meet your trainer */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="mb-10 text-3xl font-bold text-gray-900 sm:text-4xl">Meet Your Trainer</h2>
          <div className="card mx-auto flex max-w-xl flex-col items-center gap-4 p-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-3xl font-bold text-white shadow-md">
              {initials}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{COACH_NAME}</p>
              <p className="text-brand-600">{COACH_TITLE}</p>
            </div>
            <p className="text-left text-gray-600">
              I didn't start out as a VA. For years I worked the day shift at a manufacturing
              company — up early, home late, squeezing in my studies in between. Then I got my
              first real shot as a freelance agent for a US-based client. I worked hard, kept
              learning, and was eventually promoted to Team Manager, a role I still hold today,
              leading a team that supports clients on the other side of the world — night shifts,
              holiday duty, and all.
            </p>
            <p className="mt-3 text-left text-gray-600">
              Along the way I built a home office I'm proud of, sat through more training
              sessions and final interviews than I can count, and learned firsthand that this
              career can travel with you — I've logged into team meetings from a beach in
              Dingalan and from a coffee shop when my home internet gave out. I built The VA
              Atelier to hand you everything I wish someone had handed me on day one, so your
              path to your first client is faster and a lot less confusing than mine was.
            </p>
            <p className="mt-3 text-gray-600">
              Every student who completes this program gets direct access to a live 1-on-1
              coaching session with me before earning their certificate — so you leave not just
              with knowledge, but with real feedback and a clear next step toward your first
              client.
            </p>
          </div>
        </div>
      </section>

      {/* Why this course */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 sm:text-4xl">
            Why Train With The VA Atelier
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <Feature
              icon="🎥"
              title="Learn at Your Own Pace"
              text="Bite-sized video lessons you can rewatch anytime, on any device, forever."
            />
            <Feature
              icon="📝"
              title="Test What You've Learned"
              text="Short quizzes after every module make sure the training actually sticks."
            />
            <Feature
              icon="🎓"
              title="Certificate of Completion"
              text="A shareable certificate, personally signed, to add to your resume and LinkedIn."
            />
            <Feature
              icon="🧰"
              title="Real Tools, Real Skills"
              text="Hands-on training in Gmail, Google Workspace, Trello, Canva, and more."
            />
            <Feature
              icon="📄"
              title="Resume & Portfolio Help"
              text="Step-by-step guidance to build a portfolio and resume that gets noticed."
            />
            <Feature
              icon="💼"
              title="Land Your First Client"
              text="Learn exactly where to apply, how to price your services, and how to onboard clients."
            />
          </div>
        </div>
      </section>

      {/* Pricing / CTA */}
      <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h2 className="mb-3 text-3xl font-bold text-gray-900 sm:text-4xl">
          Start Your VA Career Today
        </h2>
        <p className="mb-8 text-gray-600">{curriculum.priceNote}</p>
        <div className="card mx-auto max-w-sm border-2 border-brand-100 shadow-lg">
          <p className="text-sm font-medium text-brand-700">The VA Atelier Training Program</p>
          <p className="mt-2 text-5xl font-extrabold text-gray-900">{PRICE_DISPLAY}</p>
          <p className="mt-1 text-sm text-gray-500">One-time payment</p>
          <Link href="/register" className="btn-primary mt-6 w-full text-lg">
            Enroll Now
          </Link>
          <p className="mt-3 text-xs text-gray-400">
            Secure payment via GCash, Maya, or Card — powered by PayMongo
          </p>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-10 text-center">
        <div className="mb-3 flex justify-center text-brand-300">
          <LogoMark className="h-7 w-7" ring={false} />
        </div>
        <p className="text-sm text-gray-400">
          © {new Date().getFullYear()} The VA Atelier. All rights reserved.
        </p>
      </footer>
    </>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xl">{icon}</div>
      <p className="text-3xl font-extrabold text-brand-600">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="card transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">
        {icon}
      </div>
      <h3 className="mb-1 font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600">{text}</p>
    </div>
  );
}
