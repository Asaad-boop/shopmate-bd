// Mock data generator for Order List
import { formatInTimeZone } from "date-fns-tz";

const DHAKA_TZ = "Asia/Dhaka";

const firstNames = ["Rahim", "Karim", "Nadia", "Fatima", "Arif", "Sadia", "Tanvir", "Mitu", "Rashed", "Jui", "Mamun", "Shapla", "Imran", "Farzana", "Sumon", "Nusrat", "Shakib", "Tamanna", "Rifat", "Mim"];
const lastNames = ["Hossain", "Ahmed", "Begum", "Khan", "Islam", "Rahman", "Akter", "Mia", "Chowdhury", "Sultana"];
const dhakaAreas = ["Mirpur-10", "Dhanmondi", "Gulshan-1", "Uttara-12", "Mohammadpur", "Banani", "Bashundhara", "Badda", "Tejgaon", "Motijheel"];
const outsideAreas = ["Cumilla Sadar", "Chattogram GEC", "Sylhet Ambarkhana", "Rajshahi Court", "Khulna Shibbari", "Bogura Satmatha", "Rangpur Town Hall", "Cox's Bazar Kolatoli", "Gazipur Tongi", "Narayanganj Fatulla"];
const products = [
  { name: "Premium Leather Wallet", sku: "WLT-001", price: 1290, cost: 450 },
  { name: "Silk Saree (Red)", sku: "SRE-102", price: 3490, cost: 1200 },
  { name: "Cotton Polo T-shirt", sku: "PLO-205", price: 890, cost: 320 },
  { name: "Wireless Earbuds Pro", sku: "EBD-050", price: 2490, cost: 980 },
  { name: "Ceramic Mug Set (4pc)", sku: "MUG-012", price: 690, cost: 210 },
  { name: "Smart Watch Band", sku: "SWB-077", price: 1890, cost: 680 },
  { name: "Organic Face Cream", sku: "OFC-033", price: 590, cost: 180 },
  { name: "Bamboo Cutting Board", sku: "BCB-019", price: 490, cost: 150 },
  { name: "LED Desk Lamp", sku: "LDL-088", price: 1490, cost: 540 },
  { name: "Phone Case (iPhone 15)", sku: "PHC-155", price: 390, cost: 90 },
  { name: "Canvas Tote Bag", sku: "CTB-041", price: 450, cost: 130 },
  { name: "Stainless Steel Bottle", sku: "SSB-066", price: 790, cost: 280 },
];
const couriers: string[] = ["Pathao", "Steadfast", "RedX", "Paperfly", "Sundarban", ""];
const statusList: OrderStatus[] = ["pending", "need_call", "confirmed", "ready_to_ship", "in_transit", "delivered", "returned", "cancelled", "exchanged"];
const riskList: RiskLevel[] = ["low", "medium", "high"];
const staffNames: string[] = ["Rahim", "Kamal", "Sadia", "Nusrat", "—"];

export type OrderStatus = "pending" | "need_call" | "confirmed" | "ready_to_ship" | "in_transit" | "delivered" | "returned" | "cancelled" | "exchanged";
export type RiskLevel = "low" | "medium" | "high";

export interface MockOrder {
  id: string;
  invoiceId: string;
  date: string;
  time: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  city: string;
  area: string;
  address: string;
  items: { name: string; sku: string; qty: number; price: number; cost: number }[];
  itemCount: number;
  itemSummary: string;
  amount: number;
  shipping: number;
  discount: number;
  courier: string;
  trackingId: string;
  assignedTo: string;
  age: string;
  risk: RiskLevel;
  notes: string;
  subtotal: number;
  courierCharge: number;
  codFee: number;
  netReceivable: number;
  timeline: { event: string; time: string; staff: string }[];
}

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateTrackingId(courier: string): string {
  if (!courier) return "";
  const prefix = courier === "Pathao" ? "PT" : courier === "Steadfast" ? "SF" : courier === "RedX" ? "RX" : "PF";
  return `${prefix}${randInt(100000, 999999)}`;
}

function getAge(hoursAgo: number): string {
  if (hoursAgo < 1) return "now";
  if (hoursAgo < 24) return `${Math.floor(hoursAgo)}h`;
  return `${Math.floor(hoursAgo / 24)}d`;
}

export function generateMockOrders(count: number = 80): MockOrder[] {
  const orders: MockOrder[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const hoursAgo = randInt(0, 168); // up to 7 days
    const orderDate = new Date(now - hoursAgo * 3600000);
    const dateStr = formatInTimeZone(orderDate, DHAKA_TZ, "dd MMM yyyy");
    const timeStr = formatInTimeZone(orderDate, DHAKA_TZ, "hh:mm a");

    const isDhaka = Math.random() > 0.4;
    const area = isDhaka ? rand(dhakaAreas) : rand(outsideAreas);
    const city = isDhaka ? "Dhaka" : area.split(" ")[0];

    const itemCount = Math.random() > 0.7 ? randInt(2, 4) : 1;
    const selectedProducts = Array.from({ length: itemCount }, () => {
      const p = rand(products);
      return { ...p, qty: Math.random() > 0.8 ? 2 : 1 };
    });

    const subtotal = selectedProducts.reduce((s, p) => s + p.price * p.qty, 0);
    const shipping = isDhaka ? (Math.random() > 0.5 ? 60 : 80) : (Math.random() > 0.5 ? 100 : 120);
    const discount = Math.random() > 0.85 ? randInt(50, 200) : 0;
    const amount = subtotal + shipping - discount;

    const status: OrderStatus = rand(statusList);
    const hasCourier = ["ready_to_ship", "in_transit", "delivered", "returned"].includes(status as string);
    const courier: string = hasCourier ? rand(couriers.filter((c: string) => c !== "")) : (Math.random() > 0.6 ? rand(couriers.filter((c: string) => c !== "")) : "");
    const trackingId = courier ? generateTrackingId(courier) : "";

    const courierCharge = courier ? (isDhaka ? 60 : 120) : 0;
    const codFee = courier ? Math.round(amount * 0.01) : 0;
    const netReceivable = amount - courierCharge - codFee;

    const risk: RiskLevel = Math.random() > 0.85 ? "high" : Math.random() > 0.6 ? "medium" : "low";

    const timeline = [
      { event: "Order Created", time: formatInTimeZone(orderDate, DHAKA_TZ, "dd MMM, hh:mm a"), staff: rand(staffNames) as string },
    ];
    if (["confirmed", "ready_to_ship", "in_transit", "delivered", "returned", "exchanged"].includes(status as string)) {
      timeline.push({ event: "Confirmed", time: formatInTimeZone(new Date(orderDate.getTime() + 3600000), DHAKA_TZ, "dd MMM, hh:mm a"), staff: rand(staffNames) as string });
    }
    if (["ready_to_ship", "in_transit", "delivered", "returned"].includes(status as string)) {
      timeline.push({ event: "Packed & Ready", time: formatInTimeZone(new Date(orderDate.getTime() + 7200000), DHAKA_TZ, "dd MMM, hh:mm a"), staff: rand(staffNames) as string });
    }
    if (["in_transit", "delivered", "returned"].includes(status as string)) {
      timeline.push({ event: "Shipped via " + courier, time: formatInTimeZone(new Date(orderDate.getTime() + 10800000), DHAKA_TZ, "dd MMM, hh:mm a"), staff: rand(staffNames) as string });
    }
    if (status === "delivered") {
      timeline.push({ event: "Delivered", time: formatInTimeZone(new Date(orderDate.getTime() + 86400000), DHAKA_TZ, "dd MMM, hh:mm a"), staff: "System" });
    }
    if (status === "returned") {
      timeline.push({ event: "Returned", time: formatInTimeZone(new Date(orderDate.getTime() + 172800000), DHAKA_TZ, "dd MMM, hh:mm a"), staff: "System" });
    }

    orders.push({
      id: `ord-${String(i + 1).padStart(4, "0")}`,
      invoiceId: `INV-2026-${String(8500 + i).padStart(5, "0")}`,
      date: dateStr,
      time: timeStr,
      status,
      customerName: `${rand(firstNames)} ${rand(lastNames)}`,
      customerPhone: `+8801${randInt(3, 9)}${String(randInt(10000000, 99999999))}`,
      city,
      area,
      address: `House ${randInt(1, 99)}, Road ${randInt(1, 30)}, ${area}, ${city}`,
      items: selectedProducts,
      itemCount: selectedProducts.reduce((s, p) => s + p.qty, 0),
      itemSummary: selectedProducts.map(p => `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`).join(", "),
      amount,
      shipping,
      discount,
      courier,
      trackingId,
      assignedTo: rand(staffNames),
      age: getAge(hoursAgo),
      risk,
      notes: Math.random() > 0.8 ? "Customer requested fragile packaging" : "",
      subtotal,
      courierCharge,
      codFee,
      netReceivable,
      timeline,
    });
  }

  return orders;
}

export const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; dotColor: string }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground", dotColor: "bg-muted-foreground" },
  need_call: { label: "Need Call", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", dotColor: "bg-purple-500" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", dotColor: "bg-blue-500" },
  ready_to_ship: { label: "Ready to Ship", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300", dotColor: "bg-cyan-500" },
  in_transit: { label: "In Transit", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dotColor: "bg-amber-500" },
  delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", dotColor: "bg-emerald-500" },
  returned: { label: "Returned", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", dotColor: "bg-red-500" },
  cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400", dotColor: "bg-slate-400" },
  exchanged: { label: "Exchange", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", dotColor: "bg-yellow-500" },
};

export const STATUS_TABS: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "All Orders" },
  { key: "pending", label: "Pending" },
  { key: "need_call", label: "Need Call" },
  { key: "confirmed", label: "Confirmed" },
  { key: "ready_to_ship", label: "Ready to Ship" },
  { key: "in_transit", label: "In Transit" },
  { key: "delivered", label: "Delivered" },
  { key: "returned", label: "Returned" },
  { key: "cancelled", label: "Cancelled" },
  { key: "exchanged", label: "Exchange" },
];
