/**
 * Auto address mapping with fuzzy matching for Pathao integration.
 * Maps free-text Bangladesh addresses to Pathao city_id and zone_id.
 */

/* ── Synonyms dictionary ── */
const DISTRICT_SYNONYMS: Record<string, string[]> = {
  dhaka: ["ঢাকা", "dhaka", "ঢাকা জেলা", "dkh"],
  chattogram: ["চট্টগ্রাম", "chittagong", "chattogram", "ctg", "চট্টগ্রাম জেলা"],
  gazipur: ["গাজীপুর", "gazipur", "গাজিপুর"],
  narayanganj: ["নারায়ণগঞ্জ", "narayanganj", "n.ganj"],
  sylhet: ["সিলেট", "sylhet"],
  rajshahi: ["রাজশাহী", "rajshahi"],
  khulna: ["খুলনা", "khulna"],
  rangpur: ["রংপুর", "rangpur"],
  mymensingh: ["ময়মনসিংহ", "mymensingh"],
  comilla: ["কুমিল্লা", "comilla", "cumilla"],
  bogura: ["বগুড়া", "bogra", "bogura"],
  jessore: ["যশোর", "jessore", "jashore"],
  dinajpur: ["দিনাজপুর", "dinajpur"],
  barishal: ["বরিশাল", "barisal", "barishal"],
  cox_bazar: ["কক্সবাজার", "cox's bazar", "coxs bazar", "cox bazar"],
  tangail: ["টাঙ্গাইল", "tangail"],
  narsingdi: ["নরসিংদী", "narsingdi"],
  manikganj: ["মানিকগঞ্জ", "manikganj"],
  munshiganj: ["মুন্সীগঞ্জ", "munshiganj"],
  faridpur: ["ফরিদপুর", "faridpur"],
  kishoreganj: ["কিশোরগঞ্জ", "kishoreganj"],
  noakhali: ["নোয়াখালী", "noakhali"],
  brahmanbaria: ["ব্রাহ্মণবাড়িয়া", "brahmanbaria", "b.baria"],
  habiganj: ["হবিগঞ্জ", "habiganj"],
  moulvibazar: ["মৌলভীবাজার", "moulvibazar", "molvibazar"],
  sunamganj: ["সুনামগঞ্জ", "sunamganj"],
  chandpur: ["চাঁদপুর", "chandpur"],
  lakshmipur: ["লক্ষ্মীপুর", "lakshmipur", "laxmipur"],
  feni: ["ফেনী", "feni"],
  pabna: ["পাবনা", "pabna"],
  sirajganj: ["সিরাজগঞ্জ", "sirajganj"],
  natore: ["নাটোর", "natore"],
  naogaon: ["নওগাঁ", "naogaon"],
  chapainawabganj: ["চাঁপাইনবাবগঞ্জ", "chapainawabganj"],
  joypurhat: ["জয়পুরহাট", "joypurhat"],
  satkhira: ["সাতক্ষীরা", "satkhira"],
  bagerhat: ["বাগেরহাট", "bagerhat"],
  narail: ["নড়াইল", "narail"],
  jhenaidah: ["ঝিনাইদহ", "jhenaidah"],
  magura: ["মাগুরা", "magura"],
  kushtia: ["কুষ্টিয়া", "kushtia"],
  meherpur: ["মেহেরপুর", "meherpur"],
  chuadanga: ["চুয়াডাঙ্গা", "chuadanga"],
  pirojpur: ["পিরোজপুর", "pirojpur"],
  jhalokati: ["ঝালকাঠি", "jhalokati"],
  barguna: ["বরগুনা", "barguna"],
  patuakhali: ["পটুয়াখালী", "patuakhali"],
  bhola: ["ভোলা", "bhola"],
  gopalganj: ["গোপালগঞ্জ", "gopalganj"],
  madaripur: ["মাদারীপুর", "madaripur"],
  shariatpur: ["শরীয়তপুর", "shariatpur"],
  rajbari: ["রাজবাড়ী", "rajbari"],
  thakurgaon: ["ঠাকুরগাঁও", "thakurgaon"],
  panchagarh: ["পঞ্চগড়", "panchagarh"],
  nilphamari: ["নীলফামারী", "nilphamari"],
  lalmonirhat: ["লালমনিরহাট", "lalmonirhat"],
  kurigram: ["কুড়িগ্রাম", "kurigram"],
  gaibandha: ["গাইবান্ধা", "gaibandha"],
  sherpur: ["শেরপুর", "sherpur"],
  jamalpur: ["জামালপুর", "jamalpur"],
  netrokona: ["নেত্রকোণা", "netrokona"],
  bandarban: ["বান্দরবান", "bandarban"],
  rangamati: ["রাঙ্গামাটি", "rangamati"],
  khagrachari: ["খাগড়াছড়ি", "khagrachari"],
};

// Thana synonyms (common ones)
const THANA_SYNONYMS: Record<string, string[]> = {
  mirpur: ["মিরপুর", "mirpur"],
  uttara: ["উত্তরা", "uttara"],
  dhanmondi: ["ধানমন্ডি", "dhanmondi", "dhanmandi"],
  gulshan: ["গুলশান", "gulshan"],
  banani: ["বনানী", "banani"],
  mohammadpur: ["মোহাম্মদপুর", "mohammadpur"],
  motijheel: ["মতিঝিল", "motijheel"],
  jatrabari: ["যাত্রাবাড়ী", "jatrabari"],
  tejgaon: ["তেজগাঁও", "tejgaon"],
  badda: ["বাড্ডা", "badda"],
  khilkhet: ["খিলক্ষেত", "khilkhet"],
  savar: ["সাভার", "savar"],
  tongi: ["টঙ্গী", "tongi"],
  keraniganj: ["কেরানীগঞ্জ", "keraniganj"],
  demra: ["ডেমরা", "demra"],
  bashundhara: ["বসুন্ধরা", "bashundhara"],
};

/* ── Normalize address text ── */
export function normalizeAddress(text: string): string {
  if (!text) return "";
  let normalized = text.toLowerCase();
  // Remove extra punctuation
  normalized = normalized.replace(/[,।\.\-\/:;'"()]+/g, " ");
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

/* ── Dice coefficient for fuzzy matching ── */
function bigrams(str: string): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    s.add(str.slice(i, i + 2));
  }
  return s;
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  let intersection = 0;
  for (const bg of aBigrams) {
    if (bBigrams.has(bg)) intersection++;
  }
  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

/* ── Find best match ── */
export interface MatchResult {
  best: { id: number; name: string } | null;
  score: number;
}

export function findBestMatch(
  query: string,
  candidates: { id: number; name: string }[],
  synonymsDict?: Record<string, string[]>
): MatchResult {
  if (!query || !candidates.length) return { best: null, score: 0 };

  const normalizedQuery = normalizeAddress(query);

  // 1. Exact contains match
  for (const c of candidates) {
    const cName = c.name.toLowerCase();
    if (normalizedQuery.includes(cName) || cName.includes(normalizedQuery)) {
      return { best: c, score: 1.0 };
    }
  }

  // 2. Check synonyms
  if (synonymsDict) {
    for (const [_key, synonyms] of Object.entries(synonymsDict)) {
      const matchedSynonym = synonyms.some((s) => normalizedQuery.includes(s.toLowerCase()));
      if (matchedSynonym) {
        // Find candidate matching any synonym
        for (const c of candidates) {
          const cName = c.name.toLowerCase();
          if (synonyms.some((s) => cName.includes(s.toLowerCase()) || s.toLowerCase().includes(cName))) {
            return { best: c, score: 0.95 };
          }
        }
      }
    }
  }

  // 3. Check if the full address text contains any candidate name
  for (const c of candidates) {
    const cName = c.name.toLowerCase();
    // Split address into words and check
    const words = normalizedQuery.split(" ");
    for (const word of words) {
      if (word.length >= 3 && (cName.includes(word) || word.includes(cName))) {
        return { best: c, score: 0.85 };
      }
    }
  }

  // 4. Fuzzy match using Dice coefficient — test each word against each candidate
  let bestScore = 0;
  let bestCandidate: { id: number; name: string } | null = null;

  const queryWords = normalizedQuery.split(" ").filter((w) => w.length >= 3);

  for (const c of candidates) {
    const cName = c.name.toLowerCase();
    // Score against each word
    for (const word of queryWords) {
      const score = diceCoefficient(word, cName);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = c;
      }
    }
    // Also score the full query
    const fullScore = diceCoefficient(normalizedQuery, cName);
    if (fullScore > bestScore) {
      bestScore = fullScore;
      bestCandidate = c;
    }
  }

  return { best: bestCandidate, score: bestScore };
}

/* ── Map address to Pathao IDs ── */
export interface MappingResult {
  cityId: number | null;
  cityName: string;
  cityScore: number;
  zoneId: number | null;
  zoneName: string;
  zoneScore: number;
  success: boolean;
}

export function mapAddressToPathao(
  fullAddress: string,
  cities: { city_id: number; city_name: string }[],
  zones: { zone_id: number; zone_name: string }[]
): MappingResult {
  const normalized = normalizeAddress(fullAddress);

  // Map city
  const cityCandidates = cities.map((c) => ({ id: c.city_id, name: c.city_name }));
  const cityMatch = findBestMatch(normalized, cityCandidates, DISTRICT_SYNONYMS);

  if (!cityMatch.best || cityMatch.score < 0.70) {
    return {
      cityId: cityMatch.best?.id || null,
      cityName: cityMatch.best?.name || "",
      cityScore: cityMatch.score,
      zoneId: null,
      zoneName: "",
      zoneScore: 0,
      success: false,
    };
  }

  // Map zone
  const zoneCandidates = zones.map((z) => ({ id: z.zone_id, name: z.zone_name }));
  const zoneMatch = findBestMatch(normalized, zoneCandidates, THANA_SYNONYMS);

  const success = cityMatch.score >= 0.70 && (zoneMatch.best ? zoneMatch.score >= 0.65 : false);

  return {
    cityId: cityMatch.best.id,
    cityName: cityMatch.best.name,
    cityScore: cityMatch.score,
    zoneId: zoneMatch.best?.id || null,
    zoneName: zoneMatch.best?.name || "",
    zoneScore: zoneMatch.score,
    success,
  };
}

export const CONFIDENCE_THRESHOLDS = {
  CITY_MIN: 0.70,
  ZONE_MIN: 0.65,
};
