import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { MailIcon } from "./ButtonIcons";
import { NavIcon } from "./NavIcon";

const links = [
  { href: "#properties", label: "Properties", icon: "properties" },
  { href: "#about", label: "How it works", icon: "how" },
  { href: "#fees", label: "Fees", icon: "fees" },
  { href: "#contact", label: "Contact", icon: "contact" },
];

/** `base` is "/" on pages other than the home page, so the menu links lead back to the home page sections. */
export function Header({ name, base = "" }: { name: string; base?: string }) {
  return (
    <header className="sticky top-0 z-40 glass-bar border-b border-line/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Logo className="text-[15px] sm:text-xl" name={name} href={base ? "/" : "#top"} />
        <nav className="flex items-center gap-3 sm:gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={`${base}${l.href}`}
              className="group hidden items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink md:inline-flex"
            >
              <NavIcon name={l.icon} className="size-4 text-green/70 transition-colors group-hover:text-green" />
              {l.label}
            </a>
          ))}
          <a
            href={`${base}#enquiry-form`}
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-green px-5 text-sm font-semibold text-white icon-btn hover:bg-green-deep"
          >
            <MailIcon />
            Enquire
          </a>
          <MobileMenu links={links.map((l) => ({ ...l, href: `${base}${l.href}` }))} />
        </nav>
      </div>
    </header>
  );
}
