/**
 * Pathao Address Dictionary — Dhaka-first scoring-based zone/area mapper.
 * 
 * Structure:
 * - normalization: bn→en alias map + abbreviation map
 * - scoring_weights: points for alias/keyword matches
 * - confidence: base, divisor, thresholds
 * - hard_rules: pattern → force zone (checked FIRST)
 * - cities.Dhaka.zones: each zone has aliases, strong/weak/negative keywords, areas
 * - cities.Dhaka.ambiguous_tokens: tokens that need disambiguation signals
 */

/* ── Normalization Maps ── */

export const BN_EN_ALIAS_MAP: Record<string, string> = {
  // Bengali script → English (Dhaka)
  "ঢাকা": "dhaka", "ধানমন্ডি": "dhanmondi", "ধানমণ্ডি": "dhanmondi",
  "মিরপুর": "mirpur", "উত্তরা": "uttara", "গুলশান": "gulshan",
  "বনানী": "banani", "মোহাম্মদপুর": "mohammadpur", "মহম্মদপুর": "mohammadpur",
  "তেজগাঁও": "tejgaon", "ফার্মগেট": "farmgate", "মতিঝিল": "motijheel",
  "বাড্ডা": "badda", "রামপুরা": "rampura", "খিলগাঁও": "khilgaon",
  "মালিবাগ": "malibagh", "মুগদা": "mugda", "ডেমরা": "demra",
  "যাত্রাবাড়ী": "jatrabari", "শাহবাগ": "shahbagh",
  "মহাখালী": "mohakhali", "সাভার": "savar", "টঙ্গী": "tongi",
  "কেরানীগঞ্জ": "keraniganj", "গাজীপুর": "gazipur",
  "নারায়ণগঞ্জ": "narayanganj", "বসুন্ধরা": "bashundhara",
  "খিলক্ষেত": "khilkhet", "আগারগাঁও": "agargaon",
  "কাফরুল": "kafrul", "পল্লবী": "pallabi", "শেওড়াপাড়া": "shewrapara",
  "আদাবর": "adabor", "নিউমার্কেট": "new market",
  "বনশ্রী": "banasree", "লালবাগ": "lalbagh",
  "পান্থপথ": "panthapath", "কারওয়ান বাজার": "kawran bazar",
  "কাওরান বাজার": "kawran bazar", "গ্রীন রোড": "green road",
  // Bengali script → English (Chittagong)
  "চট্টগ্রাম": "chittagong", "চট্‌গ্রাম": "chittagong", "চট্টগ্রামহ": "chittagong",
  "আগ্রাবাদ": "agrabad", "নাসিরাবাদ": "nasirabad", "হালিশহর": "halishahar",
  "পাহাড়তলী": "pahartali", "পতেঙ্গা": "patenga", "বায়েজিদ": "bayazid",
  "ষোলশহর": "sholashahar", "ডবলমুরিং": "double mooring",
  "জলসা": "jalsha", "চকবাজার": "chawkbazar",
  "কোতোয়ালী": "kotwali", "বাকলিয়া": "bakalia",
  "খুলশী": "khulshi", "ওয়াসা": "wasa",
  // Bengali script → English (Sylhet)
  "সিলেট": "sylhet", "সিলেটহ": "sylhet",
  "আম্বরখানা": "ambarkhana", "জিন্দাবাজার": "zindabazar",
  "শাহজালাল": "shahjalal", "সুবিদবাজার": "subid bazar",
  "কুমারগাঁও": "kumargaon", "মজুমদারী": "mojumdari",
  "টিলাগড়": "tilagarh", "শাহপরাণ": "shahparan",
  // Bengali script → English (Rajshahi)
  "রাজশাহী": "rajshahi", "রাজশাহি": "rajshahi",
  "সাহেব বাজার": "saheb bazar", "বোয়ালিয়া": "boalia",
  "রাজপাড়া": "rajpara", "মতিহার": "motihar",
  "শাহমখদুম": "shah makhdum", "উপশহর": "upashahar",
  // Common Bengali words in addresses
  "রোড": "road", "সড়ক": "road", "লেন": "lane", "গলি": "lane",
  "বাড়ি": "house", "ফ্ল্যাট": "flat", "তলা": "floor",
  "পাশে": "beside", "পিছনে": "behind", "সামনে": "front",
  "এর": "er", "এ": "e", "তে": "te",
};

export const ABBREVIATION_MAP: Record<string, string> = {
  "r/a": "residential area",
  "dohs": "dohs",
  "ctg": "chittagong",
  "b.baria": "brahmanbaria",
  "n.ganj": "narayanganj",
  "mohd.pur": "mohammadpur",
  "mohd pur": "mohammadpur",
  "sec": "sector",
  "sec.": "sector",
  "blk": "block",
  "blk.": "block",
  "rd": "road",
  "rd.": "road",
  "ave": "avenue",
  "ave.": "avenue",
  "stn": "station",
  "univ": "university",
  "govt": "government",
  "natl": "national",
  "intl": "international",
};

/* ── Scoring Weights ── */

export const SCORING_WEIGHTS = {
  zone_alias_match: 12,
  strong_keyword_match: 12,
  weak_keyword_match: 6,
  ambiguous_token_match: 2,
  negative_keyword_penalty: -25,
  multi_signal_bonus: 3,
  multi_signal_max: 9,
  area_alias_match: 20,
};

/* ── Confidence Config ── */

export const CONFIDENCE_CONFIG = {
  base: 0.55,
  diff_divisor: 30,
  manual_review_if_below: 0.80,
  close_score_diff_threshold: 6,
};

/* ── Hard Rules ── */

export interface HardRule {
  patterns: string[];        // all must match (AND logic)
  negative_patterns?: string[]; // none must match (exclusion)
  force_zone: string;
  reason: string;
}

export const HARD_RULES: HardRule[] = [
  // A) Bashundhara City = shopping mall near Panthapath, NOT Bashundhara R/A
  {
    patterns: ["bashundhara city"],
    negative_patterns: ["residential", "block", "apartment"],
    force_zone: "Panthapath",
    reason: "Bashundhara City is a shopping complex near Panthapath, not Bashundhara R/A",
  },
  {
    patterns: ["city shopping complex"],
    force_zone: "Panthapath",
    reason: "City Shopping Complex refers to Bashundhara City near Panthapath",
  },
  {
    patterns: ["bashundhara city shopping complex"],
    force_zone: "Panthapath",
    reason: "Bashundhara City Shopping Complex is near Panthapath",
  },
  {
    patterns: ["bashundhara", "shopping"],
    force_zone: "Panthapath",
    reason: "Bashundhara shopping complex is in Panthapath area",
  },
  {
    patterns: ["bashundhara", "complex"],
    negative_patterns: ["residential"],
    force_zone: "Panthapath",
    reason: "Bashundhara complex is near Panthapath",
  },
  // B) Bashundhara R/A signals
  {
    patterns: ["bashundhara", "residential"],
    force_zone: "Bashundhara R/A",
    reason: "Bashundhara Residential Area detected",
  },
  {
    patterns: ["bashundhara", "kuril"],
    force_zone: "Bashundhara R/A",
    reason: "Kuril near Bashundhara R/A",
  },
  {
    patterns: ["bashundhara", "j block"],
    force_zone: "Bashundhara R/A",
    reason: "J Block is in Bashundhara R/A",
  },
  {
    patterns: ["bashundhara", "k block"],
    force_zone: "Bashundhara R/A",
    reason: "K Block is in Bashundhara R/A",
  },
  {
    patterns: ["bashundhara", "i block"],
    force_zone: "Bashundhara R/A",
    reason: "I Block is in Bashundhara R/A",
  },
  // C) Kawran Bazar → Panthapath
  {
    patterns: ["kawran bazar"],
    force_zone: "Panthapath",
    reason: "Kawran Bazar is in Panthapath zone",
  },
  {
    patterns: ["karwan bazar"],
    force_zone: "Panthapath",
    reason: "Karwan Bazar is in Panthapath zone",
  },
  // Shah Ali → Mirpur-1 (NOT Mirpur-6)
  {
    patterns: ["shah ali"],
    force_zone: "Mirpur-1",
    reason: "Shah Ali Bagh/Garden is in Mirpur-1",
  },
  // Pallabi → Mirpur-12
  {
    patterns: ["pallabi"],
    force_zone: "Mirpur-12",
    reason: "Pallabi is in Mirpur-12 zone",
  },
  // Kafrul → Mirpur-14
  {
    patterns: ["kafrul"],
    force_zone: "Mirpur-14",
    reason: "Kafrul is in Mirpur-14 zone",
  },
  // Shewrapara / Agargaon → Mirpur-6
  {
    patterns: ["shewrapara"],
    force_zone: "Mirpur-6",
    reason: "Shewrapara is in Mirpur-6 zone",
  },
  {
    patterns: ["agargaon"],
    force_zone: "Mirpur-6",
    reason: "Agargaon is in Mirpur-6 zone",
  },
  // Science Lab → Dhanmondi
  {
    patterns: ["science lab"],
    force_zone: "Dhanmondi",
    reason: "Science Lab is in Dhanmondi area",
  },
  // Elephant Road → New Market
  {
    patterns: ["elephant road"],
    force_zone: "New Market",
    reason: "Elephant Road is in New Market zone",
  },
  // Nilkhet → New Market
  {
    patterns: ["nilkhet"],
    force_zone: "New Market",
    reason: "Nilkhet is in New Market zone",
  },
  // Postogola → Jatrabari
  {
    patterns: ["postogola"],
    force_zone: "Jatrabari",
    reason: "Postogola is in Jatrabari zone",
  },
  // Diabari → Uttara Sector 14
  {
    patterns: ["diabari"],
    force_zone: "Uttara Sector 14",
    reason: "Diabari is in Uttara Sector 14",
  },
  // Joydebpur / Board Bazar → Gazipur Sadar
  {
    patterns: ["joydebpur"],
    force_zone: "Gazipur Sadar",
    reason: "Joydebpur is Gazipur Sadar",
  },
  {
    patterns: ["board bazar"],
    force_zone: "Gazipur Sadar",
    reason: "Board Bazar is in Gazipur Sadar",
  },
  // Fatullah → Fatullah (Narayanganj)
  {
    patterns: ["fatullah"],
    force_zone: "Fatullah",
    reason: "Fatullah is a specific zone in Narayanganj",
  },
  // Purbachal / Jolshiri → Purbachal
  {
    patterns: ["purbachal"],
    force_zone: "Purbachal",
    reason: "Purbachal is a specific zone",
  },
  {
    patterns: ["jolshiri"],
    force_zone: "Purbachal",
    reason: "Jolshiri is in Purbachal zone",
  },
];

/* ── Zone definitions for Dhaka ── */

export interface ZoneArea {
  aliases: string[];
}

export interface ZoneDefinition {
  aliases: string[];
  strong_keywords: string[];
  weak_keywords: string[];
  negative_keywords: string[];
  areas: Record<string, ZoneArea>;
}

export interface AmbiguousToken {
  possible_zones: string[];
  disambiguation_signals: Record<string, string>; // signal_keyword → zone
}

export interface CityDefinition {
  zones: Record<string, ZoneDefinition>;
  ambiguous_tokens: Record<string, AmbiguousToken>;
}

export const DHAKA_CITY: CityDefinition = {
  zones: {
    // ── Mirpur Zones ──
    "Mirpur-1": {
      aliases: ["mirpur 1", "mirpur-1", "mirpur1"],
      strong_keywords: ["shah ali", "shahali", "shah ali bagh", "shah ali bag", "shah ali garden", "shahali bagh", "shahali garden"],
      weak_keywords: ["mirpur"],
      negative_keywords: ["mirpur 2", "mirpur 6", "mirpur 10", "mirpur 11", "mirpur 12", "mirpur 13", "mirpur 14", "pallabi", "kafrul", "shewrapara", "agargaon"],
      areas: {
        "Shah Ali Bagh": { aliases: ["shah ali bagh", "shah ali bag", "shahali bagh", "shahali bag"] },
        "Shah Ali Garden": { aliases: ["shah ali garden", "shahali garden"] },
        "Mirpur-1 General": { aliases: ["mirpur 1", "mirpur-1", "mirpur1"] },
      },
    },
    "Mirpur-2": {
      aliases: ["mirpur 2", "mirpur-2", "mirpur2"],
      strong_keywords: [],
      weak_keywords: ["mirpur"],
      negative_keywords: ["mirpur 1", "mirpur 6", "mirpur 10", "pallabi"],
      areas: {},
    },
    "Mirpur-6": {
      aliases: ["mirpur 6", "mirpur-6", "mirpur6"],
      strong_keywords: ["shewrapara", "sewrapara", "shewra para", "agargaon", "sher e bangla nagar", "sher-e-bangla"],
      weak_keywords: ["mirpur"],
      negative_keywords: ["mirpur 1", "mirpur 2", "mirpur 10", "shah ali"],
      areas: {
        "Shewrapara": { aliases: ["shewrapara", "sewrapara", "shewra para"] },
        "Agargaon": { aliases: ["agargaon"] },
        "Sher-e-Bangla Nagar": { aliases: ["sher e bangla", "sher-e-bangla", "sher e bangla nagar"] },
      },
    },
    "Mirpur-10": {
      aliases: ["mirpur 10", "mirpur-10", "mirpur10"],
      strong_keywords: ["mazar road", "mirpur ten", "mirpur 10 roundabout", "mirpur 10 gol chattar"],
      weak_keywords: ["mirpur"],
      negative_keywords: ["mirpur 1", "mirpur 2", "mirpur 6", "mirpur 11", "mirpur 12"],
      areas: {
        "Mirpur-10 Roundabout": { aliases: ["roundabout", "gol chattar", "golchattar"] },
        "Mazar Road": { aliases: ["mazar road", "mazar rd"] },
      },
    },
    "Mirpur-11": {
      aliases: ["mirpur 11", "mirpur-11", "mirpur11"],
      strong_keywords: [],
      weak_keywords: ["mirpur"],
      negative_keywords: ["mirpur 1", "mirpur 10", "mirpur 12"],
      areas: {},
    },
    "Mirpur-12": {
      aliases: ["mirpur 12", "mirpur-12", "mirpur12"],
      strong_keywords: ["pallabi", "palabi"],
      weak_keywords: ["mirpur"],
      negative_keywords: ["mirpur 1", "mirpur 10", "mirpur 11", "mirpur 13", "mirpur 14"],
      areas: {
        "Pallabi": { aliases: ["pallabi", "palabi"] },
      },
    },
    "Mirpur-13": {
      aliases: ["mirpur 13", "mirpur-13", "mirpur13"],
      strong_keywords: [],
      weak_keywords: ["mirpur"],
      negative_keywords: ["mirpur 12", "mirpur 14"],
      areas: {},
    },
    "Mirpur-14": {
      aliases: ["mirpur 14", "mirpur-14", "mirpur14"],
      strong_keywords: ["kafrul", "kaafrul"],
      weak_keywords: ["mirpur"],
      negative_keywords: ["mirpur 1", "mirpur 12", "mirpur 13"],
      areas: {
        "Kafrul": { aliases: ["kafrul", "kaafrul"] },
      },
    },
    "Mirpur DOHS": {
      aliases: ["mirpur dohs"],
      strong_keywords: [],
      weak_keywords: ["mirpur", "dohs"],
      negative_keywords: [],
      areas: {},
    },

    // ── Dhanmondi ──
    "Dhanmondi": {
      aliases: ["dhanmondi", "dhanmandi", "dhanmondy"],
      strong_keywords: ["shankar", "jigatola", "science lab", "sobhanbag", "kalabagan", "lake circus"],
      weak_keywords: ["dhanmandi"],
      negative_keywords: [],
      areas: {
        "Shankar": { aliases: ["shankar"] },
        "Jigatola": { aliases: ["jigatola"] },
        "Science Lab": { aliases: ["science lab"] },
        "Kalabagan": { aliases: ["kalabagan"] },
        "Lake Circus": { aliases: ["lake circus"] },
      },
    },
    "New Market": {
      aliases: ["new market", "newmarket"],
      strong_keywords: ["nilkhet", "elephant road", "gauchia"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Nilkhet": { aliases: ["nilkhet"] },
        "Elephant Road": { aliases: ["elephant road"] },
        "Gauchia": { aliases: ["gauchia", "gausia"] },
      },
    },

    // ── Mohammadpur ──
    "Mohammadpur": {
      aliases: ["mohammadpur", "mohammedpur", "muhammadpur"],
      strong_keywords: ["lalmatia", "tajmahal road", "ring road", "town hall", "mohammadpur bus stand", "japan garden city"],
      weak_keywords: [],
      negative_keywords: ["adabor"],
      areas: {
        "Lalmatia": { aliases: ["lalmatia"] },
        "Tajmahal Road": { aliases: ["tajmahal road", "taj mahal road"] },
        "Ring Road": { aliases: ["ring road"] },
        "Japan Garden City": { aliases: ["japan garden city", "japan garden"] },
      },
    },
    "Adabor": {
      aliases: ["adabor"],
      strong_keywords: [],
      weak_keywords: ["mohammadpur"],
      negative_keywords: [],
      areas: {},
    },

    // ── Gulshan ──
    "Gulshan-1": {
      aliases: ["gulshan 1", "gulshan-1", "gulshan1"],
      strong_keywords: ["niketan", "police plaza"],
      weak_keywords: ["gulshan"],
      negative_keywords: ["gulshan 2"],
      areas: {
        "Niketan": { aliases: ["niketan"] },
        "Police Plaza": { aliases: ["police plaza"] },
      },
    },
    "Gulshan-2": {
      aliases: ["gulshan 2", "gulshan-2", "gulshan2"],
      strong_keywords: [],
      weak_keywords: ["gulshan"],
      negative_keywords: ["gulshan 1"],
      areas: {},
    },

    // ── Banani / Baridhara / Bashundhara ──
    "Banani": {
      aliases: ["banani", "bananii"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: ["banani dohs"],
      areas: {},
    },
    "Banani DOHS": {
      aliases: ["banani dohs"],
      strong_keywords: [],
      weak_keywords: ["banani", "dohs"],
      negative_keywords: [],
      areas: {},
    },
    "Baridhara": {
      aliases: ["baridhara"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: ["baridhara dohs"],
      areas: {},
    },
    "Baridhara DOHS": {
      aliases: ["baridhara dohs"],
      strong_keywords: [],
      weak_keywords: ["baridhara", "dohs"],
      negative_keywords: [],
      areas: {},
    },
    "Bashundhara R/A": {
      aliases: ["bashundhara r/a", "bashundhara residential", "bashundhara residential area"],
      strong_keywords: ["block a bashundhara", "block b bashundhara", "block c bashundhara", "block d bashundhara", "bashundhara block"],
      weak_keywords: ["residential area", "r/a"],
      negative_keywords: ["bashundhara city", "shopping", "complex", "mall"],
      areas: {},
    },

    // ── Uttara Sectors ──
    ...Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => i + 1).map(n => [
        `Uttara Sector ${n}`,
        {
          aliases: [`uttara sector ${n}`, `uttara sec ${n}`, `sector ${n} uttara`],
          strong_keywords: [],
          weak_keywords: ["uttara"],
          negative_keywords: Array.from({ length: 14 }, (_, j) => j + 1).filter(j => j !== n).map(j => `sector ${j}`),
          areas: {},
        } as ZoneDefinition,
      ])
    ),
    "Abdullahpur Uttara": {
      aliases: ["abdullahpur", "abdullahpur uttara"],
      strong_keywords: [],
      weak_keywords: ["uttara"],
      negative_keywords: ["sector"],
      areas: {},
    },
    "Turag": {
      aliases: ["turag"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },

    // ── Tejgaon / Farmgate / Panthapath / Karwan Bazar / Green Road ──
    "Tejgaon": {
      aliases: ["tejgaon", "tegaon"],
      strong_keywords: ["tejgaon industrial", "tejgaon i/a"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Tejgaon Industrial Area": { aliases: ["tejgaon industrial", "tejgaon i/a", "industrial area tejgaon"] },
      },
    },
    "Farmgate": {
      aliases: ["farmgate", "farm gate"],
      strong_keywords: ["khamarbari", "farmgate bus stand"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Panthapath": {
      aliases: ["panthapath", "panth path", "pantho path"],
      strong_keywords: ["bashundhara city", "kawran bazar", "karwan bazar", "kawranbazar", "karwanbazar", "green road"],
      weak_keywords: ["garden road", "panth path"],
      negative_keywords: [],
      areas: {
        "Kawran Bazar": { aliases: ["kawran bazar", "karwan bazar", "kawranbazar", "karwanbazar", "kaoran bazar"] },
        "Bashundhara City": { aliases: ["bashundhara city", "bashundhara city shopping", "bashundhara shopping"] },
        "Green Road": { aliases: ["green road", "greenroad"] },
      },
    },
    "Karwan Bazar": {
      aliases: ["karwan bazar", "kawran bazar", "kawranbazar", "karwanbazar"],
      strong_keywords: [],
      weak_keywords: ["bazar"],
      negative_keywords: ["panthapath", "bashundhara city"],
      areas: {},
    },
    "Green Road": {
      aliases: ["green road", "greenroad"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: ["panthapath"],
      areas: {},
    },

    // ── Motijheel / Paltan / Arambagh ──
    "Motijheel": {
      aliases: ["motijheel", "motijeel", "motijhil"],
      strong_keywords: ["dilkusha"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Dilkusha": { aliases: ["dilkusha"] },
      },
    },
    "Paltan": {
      aliases: ["paltan", "purana paltan"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Arambagh": {
      aliases: ["arambagh"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },

    // ── Badda / Rampura / Khilgaon / Malibagh / Mugda / Banasree / Aftabnagar ──
    "Badda": {
      aliases: ["badda", "bada", "merul badda"],
      strong_keywords: ["merul badda", "north badda", "south badda", "middle badda"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Merul Badda": { aliases: ["merul badda", "merul"] },
        "North Badda": { aliases: ["north badda", "uttar badda"] },
        "South Badda": { aliases: ["south badda", "dakhkhin badda"] },
        "Middle Badda": { aliases: ["middle badda", "moddho badda"] },
      },
    },
    "Rampura": {
      aliases: ["rampura", "ram pura"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Khilgaon": {
      aliases: ["khilgaon", "khilgoan"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Malibagh": {
      aliases: ["malibagh", "malibag"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Mugda": {
      aliases: ["mugda", "mughda"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Banasree": {
      aliases: ["banasree", "banashree"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Aftabnagar": {
      aliases: ["aftabnagar", "aftab nagar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },

    // ── Demra / Jatrabari / Shyampur / Kadamtali ──
    "Demra": {
      aliases: ["demra"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Jatrabari": {
      aliases: ["jatrabari", "jatra bari"],
      strong_keywords: ["postogola"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Postogola": { aliases: ["postogola"] },
      },
    },
    "Shyampur": {
      aliases: ["shyampur", "syampur"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Kadamtali": {
      aliases: ["kadamtali", "kadamtoli"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },

    // ── Wari / Old Dhaka ──
    "Wari": {
      aliases: ["wari"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Lalbagh": {
      aliases: ["lalbagh", "lalbag"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Hazaribagh": {
      aliases: ["hazaribagh", "hazari bagh"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Kamrangirchar": {
      aliases: ["kamrangirchar", "kamrangir char"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Chawkbazar": {
      aliases: ["chawkbazar", "chawk bazar", "chowk bazar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },

    // ── Shahbagh / Ramna ──
    "Shahbagh": {
      aliases: ["shahbagh", "shahbag"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Ramna": {
      aliases: ["ramna"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Segunbagicha": {
      aliases: ["segunbagicha", "segun bagicha"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Kakrail": {
      aliases: ["kakrail"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },

    // ── Mohakhali / Khilkhet / Kuril / Nikunja ──
    "Mohakhali": {
      aliases: ["mohakhali"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: ["mohakhali dohs"],
      areas: {},
    },
    "Mohakhali DOHS": {
      aliases: ["mohakhali dohs"],
      strong_keywords: [],
      weak_keywords: ["mohakhali", "dohs"],
      negative_keywords: [],
      areas: {},
    },
    "Khilkhet": {
      aliases: ["khilkhet"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Kuril": {
      aliases: ["kuril"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Nikunja": {
      aliases: ["nikunja", "nikunjo"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },

    // ── Outskirts ──
    "Savar": {
      aliases: ["savar"],
      strong_keywords: ["hemayetpur", "ashulia"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Ashulia": { aliases: ["ashulia"] },
        "Hemayetpur": { aliases: ["hemayetpur"] },
      },
    },
    "Tongi": {
      aliases: ["tongi"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Keraniganj": {
      aliases: ["keraniganj", "keranigonj"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Cantonment": {
      aliases: ["cantonment", "dhaka cantonment", "dhaka cantt"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Airport": {
      aliases: ["airport", "shahjalal airport"],
      strong_keywords: ["shahjalal"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Purbachal": {
      aliases: ["purbachal"],
      strong_keywords: ["jolshiri"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Jolshiri": { aliases: ["jolshiri"] },
      },
    },

    // ── Gazipur (if city=Dhaka in Pathao) ──
    "Gazipur Sadar": {
      aliases: ["gazipur sadar", "gazipur", "gajipur"],
      strong_keywords: ["board bazar", "joydebpur"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Board Bazar": { aliases: ["board bazar", "board bazaar"] },
        "Joydebpur": { aliases: ["joydebpur", "joydebpoor"] },
      },
    },
    "Kaliakair": {
      aliases: ["kaliakair"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },

    // ── Narayanganj ──
    "Narayanganj Sadar": {
      aliases: ["narayanganj sadar", "narayanganj"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: ["siddhirganj", "fatullah"],
      areas: {},
    },
    "Siddhirganj": {
      aliases: ["siddhirganj"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Fatullah": {
      aliases: ["fatullah"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
  },

  ambiguous_tokens: {
    "bashundhara": {
      possible_zones: ["Bashundhara R/A", "Panthapath"],
      disambiguation_signals: {
        "residential": "Bashundhara R/A",
        "r/a": "Bashundhara R/A",
        "block": "Bashundhara R/A",
        "apartment": "Bashundhara R/A",
        "city": "Panthapath",
        "shopping": "Panthapath",
        "complex": "Panthapath",
        "mall": "Panthapath",
        "kawran": "Panthapath",
        "karwan": "Panthapath",
        "panthapath": "Panthapath",
      },
    },
    "dohs": {
      possible_zones: ["Mirpur DOHS", "Mohakhali DOHS", "Banani DOHS", "Baridhara DOHS"],
      disambiguation_signals: {
        "mirpur": "Mirpur DOHS",
        "mohakhali": "Mohakhali DOHS",
        "banani": "Banani DOHS",
        "baridhara": "Baridhara DOHS",
      },
    },
    "mirpur": {
      possible_zones: ["Mirpur-1", "Mirpur-2", "Mirpur-6", "Mirpur-10", "Mirpur-11", "Mirpur-12", "Mirpur-13", "Mirpur-14", "Mirpur DOHS"],
      disambiguation_signals: {
        "1": "Mirpur-1", "shah ali": "Mirpur-1",
        "2": "Mirpur-2",
        "6": "Mirpur-6", "shewrapara": "Mirpur-6", "agargaon": "Mirpur-6",
        "10": "Mirpur-10", "mazar": "Mirpur-10",
        "11": "Mirpur-11",
        "12": "Mirpur-12", "pallabi": "Mirpur-12",
        "13": "Mirpur-13",
        "14": "Mirpur-14", "kafrul": "Mirpur-14",
        "dohs": "Mirpur DOHS",
      },
    },
    "gulshan": {
      possible_zones: ["Gulshan-1", "Gulshan-2"],
      disambiguation_signals: {
        "1": "Gulshan-1", "niketan": "Gulshan-1", "police plaza": "Gulshan-1",
        "2": "Gulshan-2",
      },
    },
    "uttara": {
      possible_zones: Array.from({ length: 14 }, (_, i) => `Uttara Sector ${i + 1}`),
      disambiguation_signals: Object.fromEntries(
        Array.from({ length: 14 }, (_, i) => [`${i + 1}`, `Uttara Sector ${i + 1}`])
      ),
    },
  },
};

/* ── Chittagong City Definition ── */

export const CHITTAGONG_CITY: CityDefinition = {
  zones: {
    "Agrabad": {
      aliases: ["agrabad", "agrabadh"],
      strong_keywords: ["agrabad commercial", "agrabad access road"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Agrabad Commercial Area": { aliases: ["agrabad commercial", "commercial area agrabad"] },
        "Agrabad Access Road": { aliases: ["agrabad access road", "access road"] },
      },
    },
    "Nasirabad": {
      aliases: ["nasirabad", "nasirabadh"],
      strong_keywords: ["nasirabad housing", "cda avenue"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "CDA Avenue": { aliases: ["cda avenue", "cda"] },
        "Nasirabad Housing": { aliases: ["nasirabad housing"] },
      },
    },
    "Khulshi": {
      aliases: ["khulshi", "khulsi"],
      strong_keywords: ["khulshi hill", "radisson"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Halishahar": {
      aliases: ["halishahar", "halishahr", "halishohor"],
      strong_keywords: ["halishahar housing"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Halishahar Housing Estate": { aliases: ["halishahar housing", "housing estate halishahar"] },
      },
    },
    "Pahartali": {
      aliases: ["pahartali", "pahartoli"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Patenga": {
      aliases: ["patenga", "patanga"],
      strong_keywords: ["patenga beach", "patenga sea beach"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Bayazid": {
      aliases: ["bayazid", "bayezid", "bayajid"],
      strong_keywords: ["bayazid bostami"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Sholashahar": {
      aliases: ["sholashahar", "soloshohor", "16 no shahar"],
      strong_keywords: ["sholashahar railway"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Double Mooring": {
      aliases: ["double mooring", "double muring"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Kotwali": {
      aliases: ["kotwali", "kotowali"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Bakalia": {
      aliases: ["bakalia", "bokolia"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Chandgaon": {
      aliases: ["chandgaon", "chand gaon"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "GEC Circle": {
      aliases: ["gec circle", "gec mor", "gec"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Muradpur": {
      aliases: ["muradpur", "muradpoor"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Oxygen": {
      aliases: ["oxygen", "oxygen mor"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Chawkbazar CTG": {
      aliases: ["chawkbazar", "chawk bazar", "chowk bazar"],
      strong_keywords: [],
      weak_keywords: ["chittagong", "chattogram"],
      negative_keywords: [],
      areas: {},
    },
    "Lalkhan Bazar": {
      aliases: ["lalkhan bazar", "lal khan bazar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Dampara": {
      aliases: ["dampara", "dam para"],
      strong_keywords: ["dampara stadium"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Wasa Circle": {
      aliases: ["wasa", "wasa circle", "wasa mor"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Anderkilla": {
      aliases: ["anderkilla", "ander killa"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Karnaphuli": {
      aliases: ["karnaphuli", "kornofuli"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "EPZ": {
      aliases: ["epz", "export processing zone", "kepz", "chittagong epz"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Sitakunda": {
      aliases: ["sitakunda", "sitakundo"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Anwara": {
      aliases: ["anwara", "anowara"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
  },
  ambiguous_tokens: {
    "chawkbazar": {
      possible_zones: ["Chawkbazar CTG"],
      disambiguation_signals: {
        "chittagong": "Chawkbazar CTG",
        "chattogram": "Chawkbazar CTG",
      },
    },
  },
};

/* ── Sylhet City Definition ── */

export const SYLHET_CITY: CityDefinition = {
  zones: {
    "Ambarkhana": {
      aliases: ["ambarkhana", "amberkhana", "amber khana"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Zindabazar": {
      aliases: ["zindabazar", "jindabazar", "zinda bazar", "jinda bazar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Subid Bazar": {
      aliases: ["subid bazar", "subidbazar", "sobid bazar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Kumargaon": {
      aliases: ["kumargaon", "kumar gaon"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Tilagarh": {
      aliases: ["tilagarh", "tila garh", "tilagar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Shahparan": {
      aliases: ["shahparan", "shah paran", "shahporon"],
      strong_keywords: ["shah paran dargah"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Modina Market": {
      aliases: ["modina market", "madina market"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Upashahar": {
      aliases: ["upashahar", "uposhohor", "upa shahar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Pathantula": {
      aliases: ["pathantula", "pathantoola"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Mirabazar": {
      aliases: ["mirabazar", "mira bazar", "mirza bazar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Chouhatta": {
      aliases: ["chouhatta", "chowatta", "chow hatta"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Shibganj Sylhet": {
      aliases: ["shibganj", "shibgonj"],
      strong_keywords: [],
      weak_keywords: ["sylhet"],
      negative_keywords: [],
      areas: {},
    },
    "Rikabi Bazar": {
      aliases: ["rikabi bazar", "rikabibazar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Nayasarak": {
      aliases: ["nayasarak", "naya sarak", "noya sarak"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Kazitula": {
      aliases: ["kazitula", "kazi tula"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "South Surma": {
      aliases: ["south surma", "dakhkhin surma"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Jalalabad": {
      aliases: ["jalalabad", "jalalabadh"],
      strong_keywords: ["jalalabad housing"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Jalalabad Housing": { aliases: ["jalalabad housing"] },
      },
    },
    "Sylhet Sadar": {
      aliases: ["sylhet sadar"],
      strong_keywords: [],
      weak_keywords: ["sylhet"],
      negative_keywords: [],
      areas: {},
    },
  },
  ambiguous_tokens: {},
};

/* ── Rajshahi City Definition ── */

export const RAJSHAHI_CITY: CityDefinition = {
  zones: {
    "Saheb Bazar": {
      aliases: ["saheb bazar", "shaheb bazar", "saheb bazaar"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Boalia": {
      aliases: ["boalia", "bowalia"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Rajpara": {
      aliases: ["rajpara", "raj para"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Motihar": {
      aliases: ["motihar", "motihaar", "motihor"],
      strong_keywords: ["rajshahi university", "ru campus"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {
        "Rajshahi University": { aliases: ["rajshahi university", "ru campus", "ru"] },
      },
    },
    "Shah Makhdum": {
      aliases: ["shah makhdum", "shah mokhdum", "shahmokhdum"],
      strong_keywords: ["shah makhdum dargah"],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Upashahar Rajshahi": {
      aliases: ["upashahar", "uposhohor", "upa shahar"],
      strong_keywords: [],
      weak_keywords: ["rajshahi"],
      negative_keywords: [],
      areas: {},
    },
    "Talaimari": {
      aliases: ["talaimari", "talai mari"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Kazla": {
      aliases: ["kazla", "kajla"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Laxmipur Rajshahi": {
      aliases: ["laxmipur", "lokkhipur"],
      strong_keywords: [],
      weak_keywords: ["rajshahi"],
      negative_keywords: [],
      areas: {},
    },
    "Padma Residential Area": {
      aliases: ["padma residential", "padma r/a", "padma residential area"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Binodpur": {
      aliases: ["binodpur", "binodpoor"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Katakhali": {
      aliases: ["katakhali", "kata khali"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "New Market Rajshahi": {
      aliases: ["new market rajshahi", "rajshahi new market"],
      strong_keywords: [],
      weak_keywords: ["new market"],
      negative_keywords: [],
      areas: {},
    },
    "Rajshahi Court": {
      aliases: ["rajshahi court", "court area"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
    "Hetemkhan": {
      aliases: ["hetemkhan", "hetem khan"],
      strong_keywords: [],
      weak_keywords: [],
      negative_keywords: [],
      areas: {},
    },
  },
  ambiguous_tokens: {
    "upashahar": {
      possible_zones: ["Upashahar Rajshahi"],
      disambiguation_signals: {
        "rajshahi": "Upashahar Rajshahi",
      },
    },
    "new market": {
      possible_zones: ["New Market Rajshahi"],
      disambiguation_signals: {
        "rajshahi": "New Market Rajshahi",
      },
    },
  },
};

/* ── City Registry ── */

export const CITY_DEFINITIONS: Record<string, CityDefinition> = {
  "Dhaka": DHAKA_CITY,
  "Chittagong": CHITTAGONG_CITY,
  "Sylhet": SYLHET_CITY,
  "Rajshahi": RAJSHAHI_CITY,
};

/** City detection keywords — used when no city is explicitly selected */
export const CITY_DETECTION_KEYWORDS: Record<string, string[]> = {
  "Chittagong": ["chittagong", "chattogram", "chottogram", "ctg", "চট্টগ্রাম"],
  "Sylhet": ["sylhet", "silhet", "সিলেট"],
  "Rajshahi": ["rajshahi", "rajsahi", "রাজশাহী"],
  "Dhaka": ["dhaka", "dacca", "ঢাকা"],
};
