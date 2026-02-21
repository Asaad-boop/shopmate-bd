/**
 * Auto address mapping with fuzzy matching for Pathao integration.
 * Maps free-text Bangladesh addresses to Pathao city_id and zone_id.
 * 
 * Enhanced with romanization normalization for Bengali address variations.
 */

import { normalizeRomanization, resolveDistrict, getVariationLookup } from "./address-variations";

/* ── Synonyms dictionary (kept for backward compat + Pathao API matching) ── */
export const DISTRICT_SYNONYMS: Record<string, string[]> = {
  dhaka: ["ঢাকা", "dhaka", "dacca", "daka"],
  chattogram: ["চট্টগ্রাম", "chittagong", "chattogram", "ctg", "chottogram"],
  gazipur: ["গাজীপুর", "gazipur", "গাজিপুর", "gajipur", "ghazipur"],
  narayanganj: ["নারায়ণগঞ্জ", "narayanganj", "n.ganj", "naraynganj"],
  sylhet: ["সিলেট", "sylhet", "silhet", "silet"],
  rajshahi: ["রাজশাহী", "rajshahi", "rajsahi"],
  khulna: ["খুলনা", "khulna", "kulna"],
  rangpur: ["রংপুর", "rangpur", "rongpur", "rangpoor"],
  mymensingh: ["ময়মনসিংহ", "mymensingh", "maimansingh"],
  comilla: ["কুমিল্লা", "comilla", "cumilla", "kumilla"],
  bogura: ["বগুড়া", "bogra", "bogura"],
  jessore: ["যশোর", "jessore", "jashore"],
  dinajpur: ["দিনাজপুর", "dinajpur"],
  barishal: ["বরিশাল", "barisal", "barishal"],
  cox_bazar: ["কক্সবাজার", "cox's bazar", "coxs bazar", "cox bazar"],
  tangail: ["টাঙ্গাইল", "tangail"],
  narsingdi: ["নরসিংদী", "narsingdi", "norshinghi", "nersingdi"],
  manikganj: ["মানিকগঞ্জ", "manikganj"],
  munshiganj: ["মুন্সীগঞ্জ", "munshiganj"],
  faridpur: ["ফরিদপুর", "faridpur", "faridpoor"],
  kishoreganj: ["কিশোরগঞ্জ", "kishoreganj"],
  noakhali: ["নোয়াখালী", "noakhali"],
  brahmanbaria: ["ব্রাহ্মণবাড়িয়া", "brahmanbaria", "b.baria"],
  habiganj: ["হবিগঞ্জ", "habiganj"],
  moulvibazar: ["মৌলভীবাজার", "moulvibazar", "molvibazar"],
  sunamganj: ["সুনামগঞ্জ", "sunamganj"],
  chandpur: ["চাঁদপুর", "chandpur"],
  lakshmipur: ["লক্ষ্মীপুর", "lakshmipur", "laxmipur"],
  feni: ["ফেনী", "feni", "pheni"],
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
  bhola: ["ভোলা", "bhola", "bola"],
  gopalganj: ["গোপালগঞ্জ", "gopalganj"],
  madaripur: ["মাদারীপুর", "madaripur"],
  shariatpur: ["শরীয়তপুর", "shariatpur"],
  rajbari: ["রাজবাড়ী", "rajbari"],
  thakurgaon: ["ঠাকুরগাঁও", "thakurgaon"],
  panchagarh: ["পঞ্চগড়", "panchagarh"],
  nilphamari: ["নীলফামারী", "nilphamari", "nilfamari"],
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

export const THANA_SYNONYMS: Record<string, string[]> = {
  mirpur: ["মিরপুর", "mirpur"],
  uttara: ["উত্তরা", "uttara", "utara"],
  dhanmondi: ["ধানমন্ডি", "dhanmondi", "dhanmandi", "dhanmondy"],
  gulshan: ["গুলশান", "gulshan"],
  banani: ["বনানী", "banani"],
  mohammadpur: ["মোহাম্মদপুর", "mohammadpur", "mohammedpur", "muhammadpur"],
  motijheel: ["মতিঝিল", "motijheel", "motijeel"],
  jatrabari: ["যাত্রাবাড়ী", "jatrabari"],
  tejgaon: ["তেজগাঁও", "tejgaon", "tegaon"],
  badda: ["বাড্ডা", "badda", "bada"],
  khilkhet: ["খিলক্ষেত", "khilkhet"],
  savar: ["সাভার", "savar"],
  tongi: ["টঙ্গী", "tongi"],
  keraniganj: ["কেরানীগঞ্জ", "keraniganj"],
  demra: ["ডেমরা", "demra"],
  bashundhara: ["বসুন্ধরা", "bashundhara"],
};

/* ── Canonical English name mappings ── */
const CANONICAL_DISTRICT_NAMES: Record<string, string> = {
  dhaka: "Dhaka", chattogram: "Chittagong", gazipur: "Gazipur", narayanganj: "Narayanganj",
  sylhet: "Sylhet", rajshahi: "Rajshahi", khulna: "Khulna", rangpur: "Rangpur",
  mymensingh: "Mymensingh", comilla: "Comilla", bogura: "Bogura", jessore: "Jessore",
  dinajpur: "Dinajpur", barishal: "Barishal", cox_bazar: "Cox's Bazar", tangail: "Tangail",
  narsingdi: "Narsingdi", manikganj: "Manikganj", munshiganj: "Munshiganj", faridpur: "Faridpur",
  kishoreganj: "Kishoreganj", noakhali: "Noakhali", brahmanbaria: "Brahmanbaria",
  habiganj: "Habiganj", moulvibazar: "Moulvibazar", sunamganj: "Sunamganj", chandpur: "Chandpur",
  lakshmipur: "Lakshmipur", feni: "Feni", pabna: "Pabna", sirajganj: "Sirajganj",
  natore: "Natore", naogaon: "Naogaon", chapainawabganj: "Chapainawabganj", joypurhat: "Joypurhat",
  satkhira: "Satkhira", bagerhat: "Bagerhat", narail: "Narail", jhenaidah: "Jhenaidah",
  magura: "Magura", kushtia: "Kushtia", meherpur: "Meherpur", chuadanga: "Chuadanga",
  pirojpur: "Pirojpur", jhalokati: "Jhalokati", barguna: "Barguna", patuakhali: "Patuakhali",
  bhola: "Bhola", gopalganj: "Gopalganj", madaripur: "Madaripur", shariatpur: "Shariatpur",
  rajbari: "Rajbari", thakurgaon: "Thakurgaon", panchagarh: "Panchagarh", nilphamari: "Nilphamari",
  lalmonirhat: "Lalmonirhat", kurigram: "Kurigram", gaibandha: "Gaibandha", sherpur: "Sherpur",
  jamalpur: "Jamalpur", netrokona: "Netrokona", bandarban: "Bandarban", rangamati: "Rangamati",
  khagrachari: "Khagrachhari",
};

const CANONICAL_THANA_NAMES: Record<string, string> = {
  mirpur: "Mirpur", uttara: "Uttara", dhanmondi: "Dhanmondi", gulshan: "Gulshan",
  banani: "Banani", mohammadpur: "Mohammadpur", motijheel: "Motijheel", jatrabari: "Jatrabari",
  tejgaon: "Tejgaon", badda: "Badda", khilkhet: "Khilkhet", savar: "Savar",
  tongi: "Tongi", keraniganj: "Keraniganj", demra: "Demra", bashundhara: "Bashundhara",
};

/** Look up canonical English name for a matched candidate */
export function toCanonicalName(
  matchedName: string,
  synonymsDict: Record<string, string[]>,
  canonicalDict: Record<string, string>
): string {
  const lower = matchedName.toLowerCase();
  for (const [key, synonyms] of Object.entries(synonymsDict)) {
    if (key === lower || synonyms.some(s => s.toLowerCase() === lower) || lower.includes(key)) {
      if (canonicalDict[key]) return canonicalDict[key];
    }
  }
  return matchedName;
}

/* ── Normalize address text ── */
export function normalizeAddress(text: string): string {
  if (!text) return "";
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[,।\.\-\/:;'"()]+/g, " ");
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

/* ── Find best match (enhanced with romanization) ── */
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
  const romanizedQuery = normalizeRomanization(normalizedQuery);
  const queryWords = normalizedQuery.split(" ").filter((w) => w.length >= 2 || /^\d+$/.test(w));

  // 0. Variation dictionary lookup: resolve district name from input
  const resolvedDistrict = resolveDistrict(normalizedQuery);
  if (resolvedDistrict) {
    for (const c of candidates) {
      if (c.name.toLowerCase() === resolvedDistrict.toLowerCase()) {
        return { best: c, score: 1.0 };
      }
      // Fuzzy match resolved name against candidate
      if (diceCoefficient(c.name.toLowerCase(), resolvedDistrict.toLowerCase()) > 0.85) {
        return { best: c, score: 0.98 };
      }
    }
  }

  // 1. All-words-present match
  let allWordsMatches: { candidate: { id: number; name: string }; totalWords: number }[] = [];
  for (const c of candidates) {
    const cWords = c.name.toLowerCase().split(/\s+/).filter(w => w.length >= 1);
    const matched = cWords.filter(cw => queryWords.some(qw => {
      if (cw.length <= 3 || qw.length <= 3) return qw === cw;
      return qw === cw || qw.includes(cw) || cw.includes(qw);
    }));
    if (matched.length === cWords.length) {
      allWordsMatches.push({ candidate: c, totalWords: cWords.length });
    }
  }
  if (allWordsMatches.length > 0) {
    allWordsMatches.sort((a, b) => b.totalWords - a.totalWords);
    return { best: allWordsMatches[0].candidate, score: 1.0 };
  }

  // 2. Substring contains match
  const containsMatches: { candidate: { id: number; name: string } }[] = [];
  for (const c of candidates) {
    const cName = c.name.toLowerCase();
    if (normalizedQuery.includes(cName) || cName.includes(normalizedQuery)) {
      containsMatches.push({ candidate: c });
    }
  }
  if (containsMatches.length > 0) {
    containsMatches.sort((a, b) => a.candidate.name.length - b.candidate.name.length);
    return { best: containsMatches[0].candidate, score: 0.95 };
  }

  // 3. Romanization-normalized matching
  for (const c of candidates) {
    const romanizedCandidate = normalizeRomanization(c.name.toLowerCase());
    if (romanizedQuery.includes(romanizedCandidate) || romanizedCandidate.includes(romanizedQuery)) {
      return { best: c, score: 0.92 };
    }
    // Check romanized words
    const romanizedWords = romanizedQuery.split(" ").filter(w => w.length >= 3);
    for (const word of romanizedWords) {
      if (word === romanizedCandidate || romanizedCandidate.includes(word) || word.includes(romanizedCandidate)) {
        return { best: c, score: 0.90 };
      }
    }
  }

  // 4. Check synonyms
  if (synonymsDict) {
    for (const [_key, synonyms] of Object.entries(synonymsDict)) {
      const matchedSynonym = synonyms.some((s) => normalizedQuery.includes(s.toLowerCase()));
      if (matchedSynonym) {
        for (const c of candidates) {
          const cName = c.name.toLowerCase();
          if (synonyms.some((s) => cName.includes(s.toLowerCase()) || s.toLowerCase().includes(cName))) {
            return { best: c, score: 0.95 };
          }
        }
      }
    }
  }

  // 5. Word-level matching
  for (const c of candidates) {
    const cName = c.name.toLowerCase();
    const words = normalizedQuery.split(" ");
    for (const word of words) {
      if (word.length >= 3 && (cName.includes(word) || word.includes(cName))) {
        return { best: c, score: 0.85 };
      }
    }
  }

  // 6. Fuzzy match using Dice coefficient (with romanization)
  let bestScore = 0;
  let bestCandidate: { id: number; name: string } | null = null;

  const fuzzyWords = normalizedQuery.split(" ").filter((w) => w.length >= 3);

  for (const c of candidates) {
    const cName = c.name.toLowerCase();
    const romanizedCName = normalizeRomanization(cName);
    
    for (const word of fuzzyWords) {
      // Standard dice
      const score = diceCoefficient(word, cName);
      if (score > bestScore) { bestScore = score; bestCandidate = c; }
      // Romanized dice
      const romanizedWord = normalizeRomanization(word);
      const rScore = diceCoefficient(romanizedWord, romanizedCName);
      if (rScore > bestScore) { bestScore = rScore; bestCandidate = c; }
    }
    // Full query scores
    const fullScore = diceCoefficient(normalizedQuery, cName);
    if (fullScore > bestScore) { bestScore = fullScore; bestCandidate = c; }
    const rFullScore = diceCoefficient(romanizedQuery, romanizedCName);
    if (rFullScore > bestScore) { bestScore = rFullScore; bestCandidate = c; }
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

  const cityCandidates = cities.map((c) => ({ id: c.city_id, name: c.city_name }));
  const cityMatch = findBestMatch(normalized, cityCandidates, DISTRICT_SYNONYMS);

  if (!cityMatch.best || cityMatch.score < 0.70) {
    return {
      cityId: cityMatch.best?.id || null,
      cityName: cityMatch.best?.name || "",
      cityScore: cityMatch.score,
      zoneId: null, zoneName: "", zoneScore: 0, success: false,
    };
  }

  const zoneCandidates = zones.map((z) => ({ id: z.zone_id, name: z.zone_name }));
  const zoneMatch = findBestMatch(normalized, zoneCandidates, THANA_SYNONYMS);

  const success = cityMatch.score >= 0.70 && (zoneMatch.best ? zoneMatch.score >= 0.65 : false);

  const canonicalCity = toCanonicalName(cityMatch.best.name, DISTRICT_SYNONYMS, CANONICAL_DISTRICT_NAMES);
  const canonicalZone = zoneMatch.best
    ? toCanonicalName(zoneMatch.best.name, THANA_SYNONYMS, CANONICAL_THANA_NAMES)
    : "";

  return {
    cityId: cityMatch.best.id,
    cityName: canonicalCity,
    cityScore: cityMatch.score,
    zoneId: zoneMatch.best?.id || null,
    zoneName: canonicalZone,
    zoneScore: zoneMatch.score,
    success,
  };
}

export const CONFIDENCE_THRESHOLDS = {
  CITY_MIN: 0.70,
  ZONE_MIN: 0.65,
};
