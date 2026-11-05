import type { LucideIcon } from "lucide-react";
import { Banknote, Bird, Building2, Egg, Handshake, Landmark, Shield, ShoppingBasket, Stethoscope, Store, Truck, Users } from "lucide-react";

export const ORG_TYPES: { key: string; label: string; icon: LucideIcon; blurb: string }[] = [
  { key: "farm", label: "Farm", icon: Bird, blurb: "Broilers, layers and catfish today. More animals coming soon." },
  { key: "cooperative", label: "Cooperative or association", icon: Users, blurb: "Members, group buying and selling" },
  { key: "hatchery", label: "Hatchery or breeder", icon: Egg, blurb: "Day-old chicks, fingerlings, breeding stock" },
  { key: "vet_practice", label: "Vet practice", icon: Stethoscope, blurb: "Client farms, cases, bookings" },
  { key: "supplier", label: "Feed or input supplier", icon: Store, blurb: "Feed, drugs, vaccines, equipment" },
  { key: "buyer", label: "Buyer business", icon: ShoppingBasket, blurb: "Hotels, restaurants, traders, processors" },
  { key: "logistics", label: "Transport and logistics", icon: Truck, blurb: "Deliveries and cold chain" },
  { key: "lender", label: "Bank or microfinance", icon: Landmark, blurb: "Farm loans with verified records" },
  { key: "insurer", label: "Insurer", icon: Shield, blurb: "Livestock and aquaculture cover" },
  { key: "investor", label: "Investor", icon: Banknote, blurb: "Fund farm projects with live tracking" },
  { key: "integrator", label: "Contract-grower scheme", icon: Handshake, blurb: "Supply growers, pay on results" },
  { key: "programme", label: "Government or NGO programme", icon: Building2, blurb: "Beneficiaries and impact" },
];
export const orgTypeLabel = (k: string) => ORG_TYPES.find((t) => t.key === k)?.label ?? k;
export const orgTypeIcon = (k: string) => ORG_TYPES.find((t) => t.key === k)?.icon ?? Building2;
