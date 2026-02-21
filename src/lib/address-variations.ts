/**
 * Comprehensive Bangladesh address variation dictionary.
 * Maps all 64 districts with Bengali romanization variations,
 * common misspellings, and Bangla script.
 * 
 * RULE: Output is ALWAYS English. Input can be Bangla or English.
 */

export interface AddressVariation {
  standard: string;
  variations: string[];
}

/**
 * Romanization normalizer — reduces text to a canonical form
 * so that "Cumilla", "Comilla", "Kumilla" all produce similar tokens.
 */
export function normalizeRomanization(text: string): string {
  if (!text) return "";
  let s = text.toLowerCase().trim();
  // Vowel swaps: oo→u, ee→i
  s = s.replace(/oo/g, "u").replace(/ee/g, "i");
  // Consonant swaps: ph→f, bh→b, kh→k, sh→s, ch→c, th→t, dh→d, gh→g
  s = s.replace(/ph/g, "f").replace(/bh/g, "b").replace(/kh/g, "k");
  s = s.replace(/sh/g, "s").replace(/ch/g, "c").replace(/th/g, "t");
  s = s.replace(/dh/g, "d").replace(/gh/g, "g");
  // Double → single: tt→t, ll→l, rr→r, ss→s, nn→n, mm→m, dd→d, pp→p
  s = s.replace(/tt/g, "t").replace(/ll/g, "l").replace(/rr/g, "r");
  s = s.replace(/ss/g, "s").replace(/nn/g, "n").replace(/mm/g, "m");
  s = s.replace(/dd/g, "d").replace(/pp/g, "p");
  // Common ending normalizations: pore/poor→pur, gonj/gunj/gunge/gang→ganj, baria/barry/baree→bari
  s = s.replace(/pore\b/g, "pur").replace(/poor\b/g, "pur").replace(/pure\b/g, "pur");
  s = s.replace(/gonj\b/g, "ganj").replace(/gunj\b/g, "ganj").replace(/gunge\b/g, "ganj").replace(/gang\b/g, "ganj");
  s = s.replace(/grom\b/g, "gram").replace(/graam\b/g, "gram");
  s = s.replace(/baria\b/g, "bari").replace(/barry\b/g, "bari").replace(/baree\b/g, "bari");
  // Vowel normalization: a/o/u ambiguity in middle positions
  // (light touch — just normalize common patterns)
  return s;
}

/** All 64 districts with romanization variations */
export const ADDRESS_VARIATIONS: Record<string, AddressVariation> = {
  "Dhaka": {
    standard: "Dhaka",
    variations: ["dhaka","dacca","daka","dhak","ঢাকা","ঢাক"]
  },
  "Chittagong": {
    standard: "Chittagong",
    variations: ["chittagong","chattogram","chottogram","ctg","chatgram","chitagong","chatogram","cittagong","চট্টগ্রাম","চট্‌গ্রাম"]
  },
  "Gazipur": {
    standard: "Gazipur",
    variations: ["gazipur","gajipur","ghazipur","gazepur","gazipoor","gajipoor","গাজীপুর","গাজিপুর"]
  },
  "Narayanganj": {
    standard: "Narayanganj",
    variations: ["narayanganj","naraynganj","narayangonj","narayangunge","narayangung","naryanganj","narayongunj","narayangunj","নারায়ণগঞ্জ","নারায়নগঞ্জ"]
  },
  "Sylhet": {
    standard: "Sylhet",
    variations: ["sylhet","silhet","silet","sillet","silat","shylhet","sylhat","selhet","সিলেট"]
  },
  "Rajshahi": {
    standard: "Rajshahi",
    variations: ["rajshahi","rajsahi","rajshahee","rajshai","rajshah","rajshahe","রাজশাহী","রাজশাহি"]
  },
  "Khulna": {
    standard: "Khulna",
    variations: ["khulna","kulna","khulnah","khulana","খুলনা"]
  },
  "Rangpur": {
    standard: "Rangpur",
    variations: ["rangpur","rangpoor","rongpur","ranpur","rrangpur","rongpoor","rangpure","রংপুর","রঙপুর"]
  },
  "Mymensingh": {
    standard: "Mymensingh",
    variations: ["mymensingh","maimansingh","mymensing","mimensingh","momenshahi","maimensingh","mymansingh","ময়মনসিংহ","ময়মনসিং"]
  },
  "Barishal": {
    standard: "Barishal",
    variations: ["barishal","barisal","barrishal","borishal","borrisshal","borrisal","barrisal","বরিশাল"]
  },
  "Comilla": {
    standard: "Comilla",
    variations: ["comilla","cumilla","kumilla","comila","cumila","camilla","comillah","kumila","comilah","কুমিল্লা","কমিল্লা","কুমিলা"]
  },
  "Bogura": {
    standard: "Bogura",
    variations: ["bogura","bogra","boggra","bogorah","bogurra","বগুড়া"]
  },
  "Jessore": {
    standard: "Jessore",
    variations: ["jessore","jashore","jessor","jasor","jassore","যশোর"]
  },
  "Dinajpur": {
    standard: "Dinajpur",
    variations: ["dinajpur","dinajpore","dinajpoor","dinapur","dynajpur","dinajpure","দিনাজপুর"]
  },
  "Cox's Bazar": {
    standard: "Cox's Bazar",
    variations: ["coxsbazar","cox's bazar","coxbazar","coxs bazar","coxsbazaar","coxbazaar","coxs bazaar","cox bazar","কক্সবাজার"]
  },
  "Tangail": {
    standard: "Tangail",
    variations: ["tangail","tangayl","tangile","tangal","tangael","tanggail","tangaile","টাঙ্গাইল"]
  },
  "Narsingdi": {
    standard: "Narsingdi",
    variations: ["narsingdi","norshinghi","nersingdi","narshingi","norsingdi","narshingdi","norshingi","nersingi","narsinghi","norsinghi","nrshingdi","narshingi","নরসিংদী","নরসিংদি","নরশিংদী"]
  },
  "Manikganj": {
    standard: "Manikganj",
    variations: ["manikganj","manikgonj","manikgunj","manikgang","মানিকগঞ্জ"]
  },
  "Munshiganj": {
    standard: "Munshiganj",
    variations: ["munshiganj","munshigonj","monshiganj","munshigang","মুন্সিগঞ্জ","মুন্সীগঞ্জ"]
  },
  "Faridpur": {
    standard: "Faridpur",
    variations: ["faridpur","faripur","faridpoor","pharidpur","faridpore","faredpur","ফরিদপুর"]
  },
  "Kishoreganj": {
    standard: "Kishoreganj",
    variations: ["kishoreganj","kishorganj","kishorgonj","kishoregonj","kisorganj","kishoregung","কিশোরগঞ্জ"]
  },
  "Noakhali": {
    standard: "Noakhali",
    variations: ["noakhali","noakhally","nowakhali","noakhalie","noakhale","নোয়াখালী","নোয়াখালি"]
  },
  "Brahmanbaria": {
    standard: "Brahmanbaria",
    variations: ["brahmanbaria","brahmanberia","brahmonbaria","bramanbaria","brahmanbaree","brahmanbarry","b.baria","bbaria","brahmanbarria","ব্রাহ্মণবাড়িয়া"]
  },
  "Habiganj": {
    standard: "Habiganj",
    variations: ["habiganj","habigonj","habigunge","habigunj","হবিগঞ্জ"]
  },
  "Moulvibazar": {
    standard: "Moulvibazar",
    variations: ["moulvibazar","moulvibazaar","moulvi bazar","molvibazar","moulbibazar","moulvibajaar","মৌলভীবাজার","মৌলভিবাজার"]
  },
  "Sunamganj": {
    standard: "Sunamganj",
    variations: ["sunamganj","sunamgonj","sonamganj","sunaomganj","sounamganj","sunamgunj","সুনামগঞ্জ"]
  },
  "Chandpur": {
    standard: "Chandpur",
    variations: ["chandpur","chandpoor","chanpur","candpur","চাঁদপুর","চাদপুর"]
  },
  "Lakshmipur": {
    standard: "Lakshmipur",
    variations: ["lakshmipur","laksmipur","laxmipur","lockhipur","loksmipur","lockhmipur","লক্ষ্মীপুর","লক্ষিপুর"]
  },
  "Feni": {
    standard: "Feni",
    variations: ["feni","pheni","feny","fenii","ফেনী","ফেনি"]
  },
  "Pabna": {
    standard: "Pabna",
    variations: ["pabna","pabana","pavna","pobna","পাবনা"]
  },
  "Sirajganj": {
    standard: "Sirajganj",
    variations: ["sirajganj","sirajgonj","shirajganj","sirajgunj","sirajgunge","sirajgang","সিরাজগঞ্জ"]
  },
  "Natore": {
    standard: "Natore",
    variations: ["natore","nathor","natoar","nattor","nater","নাটোর"]
  },
  "Naogaon": {
    standard: "Naogaon",
    variations: ["naogaon","naogoan","nawgaon","naogaun","naogawn","নওগাঁ","নওগা"]
  },
  "Chapainawabganj": {
    standard: "Chapainawabganj",
    variations: ["chapainawabganj","chapai nawabganj","chapainababganj","chapai","nawabganj","chapainobabganj","চাঁপাইনবাবগঞ্জ","চাপাইনবাবগঞ্জ"]
  },
  "Joypurhat": {
    standard: "Joypurhat",
    variations: ["joypurhat","joipurhat","joypurhet","joypur hat","জয়পুরহাট"]
  },
  "Satkhira": {
    standard: "Satkhira",
    variations: ["satkhira","satkhera","satkheera","shatkhira","satkirah","satkhirah","সাতক্ষীরা","সাতক্ষিরা"]
  },
  "Bagerhat": {
    standard: "Bagerhat",
    variations: ["bagerhat","bagerhet","বাগেরহাট"]
  },
  "Narail": {
    standard: "Narail",
    variations: ["narail","norail","narrail","narael","noraeel","নড়াইল"]
  },
  "Jhenaidah": {
    standard: "Jhenaidah",
    variations: ["jhenaidah","jhenaidha","jenaidah","jhenaida","zenaidah","jhenaidhah","ঝিনাইদহ"]
  },
  "Magura": {
    standard: "Magura",
    variations: ["magura","magoora","magurra","magorah","মাগুরা"]
  },
  "Kushtia": {
    standard: "Kushtia",
    variations: ["kushtia","kushtiya","kushthia","koshtia","kooshtia","কুষ্টিয়া","কুস্টিয়া"]
  },
  "Meherpur": {
    standard: "Meherpur",
    variations: ["meherpur","meherpoor","meharpur","মেহেরপুর"]
  },
  "Chuadanga": {
    standard: "Chuadanga",
    variations: ["chuadanga","chuyadanga","choyadanga","চুয়াডাঙ্গা"]
  },
  "Pirojpur": {
    standard: "Pirojpur",
    variations: ["pirojpur","pirojpoor","pirjpur","pirojpure","পিরোজপুর"]
  },
  "Jhalokati": {
    standard: "Jhalokati",
    variations: ["jhalokati","jhalokathi","jhalakathi","jhalokaty","ঝালকাঠি"]
  },
  "Barguna": {
    standard: "Barguna",
    variations: ["barguna","bargoona","bargunah","bargona","বরগুনা"]
  },
  "Patuakhali": {
    standard: "Patuakhali",
    variations: ["patuakhali","patoakhali","patuakali","patwakhali","patuakhalee","পটুয়াখালী","পটুয়াখালি"]
  },
  "Bhola": {
    standard: "Bhola",
    variations: ["bhola","bola","bholla","vola","bhohla","ভোলা"]
  },
  "Gopalganj": {
    standard: "Gopalganj",
    variations: ["gopalganj","gopalgonj","gopalgang","gopalgunj","গোপালগঞ্জ"]
  },
  "Madaripur": {
    standard: "Madaripur",
    variations: ["madaripur","madaripoor","madareepur","madaripure","মাদারীপুর","মাদারিপুর"]
  },
  "Shariatpur": {
    standard: "Shariatpur",
    variations: ["shariatpur","shatiatpur","sharihatpur","sariatpur","শরীয়তপুর","শরিয়তপুর"]
  },
  "Rajbari": {
    standard: "Rajbari",
    variations: ["rajbari","rajbaree","rajbary","rajbaari","রাজবাড়ী","রাজবাড়ি"]
  },
  "Jamalpur": {
    standard: "Jamalpur",
    variations: ["jamalpur","jamalpoor","jamalpure","jamalpor","জামালপুর"]
  },
  "Netrokona": {
    standard: "Netrokona",
    variations: ["netrokona","netrokone","netrkona","nettrokona","netrokana","নেত্রকোণা","নেত্রকোনা"]
  },
  "Sherpur": {
    standard: "Sherpur",
    variations: ["sherpur","sherpoor","sher pur","sharpur","শেরপুর"]
  },
  "Gaibandha": {
    standard: "Gaibandha",
    variations: ["gaibandha","gaybandha","gaibanda","geybandha","গাইবান্ধা"]
  },
  "Lalmonirhat": {
    standard: "Lalmonirhat",
    variations: ["lalmonirhat","lalmanirhat","lalmoneerhat","lalmaneerhat","lalmoniirhat","লালমনিরহাট"]
  },
  "Nilphamari": {
    standard: "Nilphamari",
    variations: ["nilphamari","nilphamary","nealfamari","nilfamari","nilphamarii","nilphamery","নীলফামারী","নীলফামারি"]
  },
  "Kurigram": {
    standard: "Kurigram",
    variations: ["kurigram","kurigraam","kurigam","kurigrame","koorikgram","kurigramm","কুড়িগ্রাম"]
  },
  "Thakurgaon": {
    standard: "Thakurgaon",
    variations: ["thakurgaon","thakurgoan","thakurgawn","thakurgaun","ঠাকুরগাঁও","ঠাকুরগাও"]
  },
  "Panchagarh": {
    standard: "Panchagarh",
    variations: ["panchagarh","panchagor","panchagar","panchaghar","পঞ্চগড়"]
  },
  "Bandarban": {
    standard: "Bandarban",
    variations: ["bandarban","bandarbon","bandorban","bandorbon","বান্দরবান"]
  },
  "Rangamati": {
    standard: "Rangamati",
    variations: ["rangamati","rangamathy","rongamati","rangamatti","রাঙামাটি","রাঙ্গামাটি"]
  },
  "Khagrachhari": {
    standard: "Khagrachhari",
    variations: ["khagrachhari","khagrachari","khagrachori","kagrachhari","khagra chari","খাগড়াছড়ি"]
  },
};

// Build a fast lookup: variation → standard name
let _variationLookup: Map<string, string> | null = null;

export function getVariationLookup(): Map<string, string> {
  if (_variationLookup) return _variationLookup;
  _variationLookup = new Map<string, string>();
  for (const [, entry] of Object.entries(ADDRESS_VARIATIONS)) {
    // Add the standard name itself
    _variationLookup.set(entry.standard.toLowerCase(), entry.standard);
    // Add all variations
    for (const v of entry.variations) {
      _variationLookup.set(v.toLowerCase(), entry.standard);
    }
    // Add romanization-normalized versions
    for (const v of entry.variations) {
      const normalized = normalizeRomanization(v);
      if (normalized && !_variationLookup.has(normalized)) {
        _variationLookup.set(normalized, entry.standard);
      }
    }
  }
  return _variationLookup;
}

/**
 * Look up a district name from free text.
 * Tries: exact match → romanization-normalized match → substring scan.
 * Returns the standard English name or null.
 */
export function resolveDistrict(input: string): string | null {
  if (!input) return null;
  const lookup = getVariationLookup();
  const lower = input.toLowerCase().trim();
  
  // 1. Direct lookup
  if (lookup.has(lower)) return lookup.get(lower)!;
  
  // 2. Romanization-normalized lookup
  const normalized = normalizeRomanization(lower);
  if (lookup.has(normalized)) return lookup.get(normalized)!;
  
  // 3. Scan each word in the input against lookup
  const words = lower.replace(/[,।\.\-\/:;'"()]+/g, " ").split(/\s+/).filter(w => w.length >= 3);
  for (const word of words) {
    if (lookup.has(word)) return lookup.get(word)!;
    const normWord = normalizeRomanization(word);
    if (lookup.has(normWord)) return lookup.get(normWord)!;
  }
  
  // 4. Try compound words (2-word combos)
  for (let i = 0; i < words.length - 1; i++) {
    const compound = words[i] + " " + words[i + 1];
    if (lookup.has(compound)) return lookup.get(compound)!;
    const normCompound = normalizeRomanization(compound);
    if (lookup.has(normCompound)) return lookup.get(normCompound)!;
    // Also try without space
    const noSpace = words[i] + words[i + 1];
    if (lookup.has(noSpace)) return lookup.get(noSpace)!;
  }
  
  // 5. Fuzzy: check if any variation is a substring of input
  for (const [variation, standard] of lookup) {
    if (variation.length >= 4 && lower.includes(variation)) {
      return standard;
    }
  }
  
  return null;
}
