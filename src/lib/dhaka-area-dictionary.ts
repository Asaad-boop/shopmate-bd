/**
 * Dhaka-specific area → zone dictionary for precise address mapping.
 * Maps common area/landmark names to their correct Pathao zone.
 * 
 * Format: { "normalized keyword": "Pathao zone name" }
 * All keys are lowercase. Matching is done against normalized address text.
 */

/** Area keywords that map to specific Pathao zone names */
export const DHAKA_AREA_TO_ZONE: Record<string, string> = {
  // Mirpur numbered zones
  "mirpur 1": "Mirpur-1",
  "mirpur1": "Mirpur-1",
  "mirpur-1": "Mirpur-1",
  "shah ali": "Mirpur-1",
  "shah ali bag": "Mirpur-1",
  "shah ali bagh": "Mirpur-1",
  "shah ali garden": "Mirpur-1",
  "mirpur 2": "Mirpur-2",
  "mirpur2": "Mirpur-2",
  "mirpur-2": "Mirpur-2",
  "mirpur 6": "Mirpur-6",
  "mirpur6": "Mirpur-6",
  "mirpur-6": "Mirpur-6",
  "mirpur 10": "Mirpur-10",
  "mirpur10": "Mirpur-10",
  "mirpur-10": "Mirpur-10",
  "mirpur 11": "Mirpur-11",
  "mirpur11": "Mirpur-11",
  "mirpur-11": "Mirpur-11",
  "mirpur 12": "Mirpur-12",
  "mirpur12": "Mirpur-12",
  "mirpur-12": "Mirpur-12",
  "mirpur 13": "Mirpur-13",
  "mirpur13": "Mirpur-13",
  "mirpur-13": "Mirpur-13",
  "mirpur 14": "Mirpur-14",
  "mirpur14": "Mirpur-14",
  "mirpur-14": "Mirpur-14",
  "pallabi": "Mirpur-12",
  "kafrul": "Mirpur-14",
  "shewrapara": "Mirpur-6",
  "sher e bangla nagar": "Mirpur-6",
  "agargaon": "Mirpur-6",
  "mirpur dohs": "Mirpur DOHS",

  // Dhanmondi numbered zones
  "dhanmondi": "Dhanmondi",
  "dhanmandi": "Dhanmondi",
  "shankar": "Dhanmondi",
  "jigatola": "Dhanmondi",
  "science lab": "Dhanmondi",
  "new market": "New Market",
  "newmarket": "New Market",
  "nilkhet": "New Market",
  "elephant road": "New Market",

  // Mohammadpur area
  "mohammadpur": "Mohammadpur",
  "adabor": "Adabor",
  "ring road": "Mohammadpur",
  "lalmatia": "Mohammadpur",
  "tajmahal road": "Mohammadpur",

  // Gulshan area
  "gulshan 1": "Gulshan-1",
  "gulshan1": "Gulshan-1",
  "gulshan-1": "Gulshan-1",
  "gulshan 2": "Gulshan-2",
  "gulshan2": "Gulshan-2",
  "gulshan-2": "Gulshan-2",
  "gulshan": "Gulshan-2",
  "niketan": "Gulshan-1",
  "police plaza": "Gulshan-1",

  // Banani / Baridhara / Bashundhara
  "banani": "Banani",
  "banani dohs": "Banani DOHS",
  "baridhara": "Baridhara",
  "baridhara dohs": "Baridhara DOHS",
  "bashundhara": "Bashundhara R/A",
  "bashundhara r a": "Bashundhara R/A",
  "bashundhara city": "Bashundhara R/A",

  // Uttara sectors
  "uttara sector 1": "Uttara Sector 1",
  "uttara sector 2": "Uttara Sector 2",
  "uttara sector 3": "Uttara Sector 3",
  "uttara sector 4": "Uttara Sector 4",
  "uttara sector 5": "Uttara Sector 5",
  "uttara sector 6": "Uttara Sector 6",
  "uttara sector 7": "Uttara Sector 7",
  "uttara sector 8": "Uttara Sector 8",
  "uttara sector 9": "Uttara Sector 9",
  "uttara sector 10": "Uttara Sector 10",
  "uttara sector 11": "Uttara Sector 11",
  "uttara sector 12": "Uttara Sector 12",
  "uttara sector 13": "Uttara Sector 13",
  "uttara sector 14": "Uttara Sector 14",
  "abdullahpur": "Abdullahpur Uttara",
  "turag": "Turag",
  "uttara": "Uttara Sector 3", // default if no sector specified
  "diabari": "Uttara Sector 14",

  // Wari / Old Dhaka
  "wari": "Wari",
  "lalbagh": "Lalbagh",
  "lal bagh": "Lalbagh",
  "hazaribagh": "Hazaribagh",
  "hazari bagh": "Hazaribagh",
  "kamrangirchar": "Kamrangirchar",
  "chawkbazar": "Chawkbazar",
  "chawk bazar": "Chawkbazar",

  // Tejgaon / Farmgate area
  "tejgaon": "Tejgaon",
  "farmgate": "Farmgate",
  "farm gate": "Farmgate",
  "karwan bazar": "Karwan Bazar",
  "karwanbazar": "Karwan Bazar",
  "kawranbazar": "Karwan Bazar",
  "panthapath": "Panthapath",
  "panth path": "Panthapath",
  "green road": "Green Road",
  "greenroad": "Green Road",

  // Motijheel area
  "motijheel": "Motijheel",
  "motijhil": "Motijheel",
  "dilkusha": "Motijheel",
  "purana paltan": "Paltan",
  "paltan": "Paltan",
  "arambagh": "Arambagh",

  // Badda / Rampura
  "badda": "Badda",
  "merul badda": "Badda",
  "rampura": "Rampura",
  "khilgaon": "Khilgaon",
  "malibagh": "Malibagh",
  "mugda": "Mugda",
  "mughda": "Mugda",
  "banasree": "Banasree",
  "aftabnagar": "Aftabnagar",
  "aftab nagar": "Aftabnagar",

  // Demra / Jatrabari
  "demra": "Demra",
  "shyampur": "Shyampur",
  "jatrabari": "Jatrabari",
  "kadamtali": "Kadamtali",
  "postogola": "Jatrabari",

  // Shahbagh / Ramna
  "shahbagh": "Shahbagh",
  "shahbag": "Shahbagh",
  "ramna": "Ramna",
  "segunbagicha": "Segunbagicha",
  "kakrail": "Kakrail",

  // Mohakhali
  "mohakhali": "Mohakhali",
  "mohakhali dohs": "Mohakhali DOHS",
  "banani dohs mohakhali": "Mohakhali DOHS",

  // Khilkhet
  "khilkhet": "Khilkhet",
  "kuril": "Kuril",
  "nikunja": "Nikunja",
  "nikunjo": "Nikunja",

  // Savar / Tongi
  "savar": "Savar",
  "tongi": "Tongi",
  "keraniganj": "Keraniganj",
  "ashulia": "Ashulia",
  "hemayetpur": "Savar",

  // Gazipur
  "gazipur": "Gazipur Sadar",
  "board bazar": "Gazipur Sadar",
  "joydebpur": "Gazipur Sadar",
  "kaliakair": "Kaliakair",

  // Narayanganj
  "narayanganj": "Narayanganj Sadar",
  "siddhirganj": "Siddhirganj",
  "fatullah": "Fatullah",

  // Misc
  "cantonment": "Cantonment",
  "airport": "Airport",
  "shahjalal": "Airport",
  "purbachal": "Purbachal",
  "jolshiri": "Purbachal",
};

/**
 * Extract specific numbered zone patterns from raw address text.
 * Returns the specific zone name if found, null otherwise.
 * 
 * Handles patterns like:
 * - "Mirpur-1", "Mirpur 1", "mirpur1"
 * - "Uttara Sector 3", "Sector 3 Uttara"
 * - "Gulshan-2", "Gulshan 2"
 * - "Dhanmondi 15", "Dhanmondi-15"
 */
export function extractSpecificZone(rawAddress: string): string | null {
  if (!rawAddress) return null;
  const addr = rawAddress.toLowerCase().replace(/[,।\.\/:;'"()]+/g, " ").replace(/\s+/g, " ").trim();

  // 1. Check exact area keywords (longest match first)
  const sortedKeys = Object.keys(DHAKA_AREA_TO_ZONE).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (addr.includes(key)) {
      return DHAKA_AREA_TO_ZONE[key];
    }
  }

  // 2. Extract "Mirpur-X" pattern (handles mirpur-1, mirpur 1, mirpur1)
  const mirpurMatch = addr.match(/mirpur[\s\-]*(\d{1,2})/i);
  if (mirpurMatch) {
    return `Mirpur-${mirpurMatch[1]}`;
  }

  // 3. Extract "Uttara Sector X" pattern
  const uttaraMatch = addr.match(/uttara[\s\-]*(?:sector[\s\-]*)?(\d{1,2})/i) ||
                       addr.match(/sector[\s\-]*(\d{1,2})[\s,]*uttara/i);
  if (uttaraMatch) {
    return `Uttara Sector ${uttaraMatch[1]}`;
  }

  // 4. Extract "Gulshan-X" pattern
  const gulshanMatch = addr.match(/gulshan[\s\-]*(\d{1,2})/i);
  if (gulshanMatch) {
    return `Gulshan-${gulshanMatch[1]}`;
  }

  // 5. Extract "Dhanmondi-X" pattern
  const dhanmondiMatch = addr.match(/dhanmon[dt]i[\s\-]*(\d{1,2})/i);
  if (dhanmondiMatch) {
    return `Dhanmondi ${dhanmondiMatch[1]}`;
  }

  return null;
}

/**
 * Calculate confidence score for an address mapping.
 * Returns 0-100 percentage.
 */
export function calculateConfidence(
  cityScore: number,
  zoneScore: number,
  areaScore: number,
  usedDictionary: boolean
): number {
  // Dictionary matches are very reliable
  if (usedDictionary) {
    const base = 90;
    const cityBonus = cityScore >= 0.95 ? 10 : cityScore >= 0.70 ? 5 : 0;
    return Math.min(100, base + cityBonus);
  }

  // Weighted: city 30%, zone 50%, area 20%
  const raw = (cityScore * 30 + zoneScore * 50 + areaScore * 20);
  return Math.round(raw);
}

/**
 * Get confidence level label and color
 */
export function getConfidenceLevel(confidence: number): {
  level: "high" | "medium" | "low";
  label: string;
  color: string;
  icon: string;
} {
  if (confidence >= 85) {
    return { level: "high", label: "Auto-detected", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "🟢" };
  }
  if (confidence >= 60) {
    return { level: "medium", label: "Please verify", color: "bg-amber-50 text-amber-700 border-amber-200", icon: "🟡" };
  }
  return { level: "low", label: "Manual entry required", color: "bg-red-50 text-red-700 border-red-200", icon: "🔴" };
}
