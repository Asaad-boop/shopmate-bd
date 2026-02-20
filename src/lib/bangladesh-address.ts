/**
 * Bangladesh District → Thana/Zone mapping (Bengali + English)
 * Used for auto-parsing addresses.
 */

export interface ParseResult {
  district: string | null;
  thana: string | null;
}

// District → Thanas (Bengali)
const LOCATIONS_BN: Record<string, string[]> = {
  "ঢাকা": ["মিরপুর", "উত্তরা", "মোহাম্মদপুর", "ধানমন্ডি", "গুলশান", "বনানী", "রামপুরা", "বাড্ডা", "খিলগাঁও", "যাত্রাবাড়ী", "মতিঝিল", "পল্টন", "লালবাগ", "হাজারীবাগ", "শ্যামলী", "আজিমপুর", "নিউমার্কেট", "এলিফ্যান্ট রোড", "মালিবাগ", "শান্তিনগর", "তেজগাঁও", "কান্তমারা", "শাহবাগ", "কাকরাইল", "ফার্মগেট", "আগারগাঁও", "সাভার", "কেরানীগঞ্জ", "দোহার", "নবাবগঞ্জ", "টঙ্গী", "ডেমরা", "কদমতলী", "ওয়ারী", "সূত্রাপুর", "চকবাজার", "কমলাপুর", "জুরাইন", "দক্ষিণখান", "উত্তরখান", "তুরাগ", "পল্লবী", "শাহ আলী", "আদাবর", "কলাবাগান"],
  "চট্টগ্রাম": ["কোতোয়ালি", "পাঁচলাইশ", "বাকলিয়া", "চান্দগাঁও", "হালিশহর", "পতেঙ্গা", "বন্দর", "ডবলমুরিং", "খুলশি", "আকবরশাহ", "বায়েজিদ", "পাহাড়তলী", "সীতাকুণ্ড", "মীরসরাই", "ফটিকছড়ি", "হাটহাজারী", "রাউজান", "রাঙ্গুনিয়া", "আনোয়ারা", "বোয়ালখালী", "পটিয়া", "চন্দনাইশ", "সাতকানিয়া", "লোহাগাড়া", "বাঁশখালী", "সন্দ্বীপ"],
  "সিলেট": ["কোতোয়ালি", "জালালাবাদ", "শাহপরান", "মোগলাবাজার", "দক্ষিণ সুরমা", "বিশ্বনাথ", "বালাগঞ্জ", "ওসমানীনগর", "গোলাপগঞ্জ", "জৈন্তাপুর", "কানাইঘাট", "কোম্পানিগঞ্জ"],
  "রাজশাহী": ["বোয়ালিয়া", "মতিহার", "শাহমখদুম", "রাজপাড়া", "পবা", "চারঘাট", "তানোর", "গোদাগাড়ী", "দুর্গাপুর", "পুঠিয়া", "বাগমারা", "মোহনপুর"],
  "খুলনা": ["কোতোয়ালি", "সোনাডাঙ্গা", "খালিশপুর", "দৌলতপুর", "ফুলতলা", "ডুমুরিয়া", "বটিয়াঘাটা", "দাকোপ", "কয়রা", "পাইকগাছা", "তেরখাদা", "রূপসা"],
  "বরিশাল": ["কোতোয়ালি", "বন্দর", "চরমোনাই", "বাবুগঞ্জ", "বাকেরগঞ্জ", "গৌরনদী", "আগৈলঝাড়া", "মেহেন্দিগঞ্জ", "মুলাদী", "হিজলা", "উজিরপুর"],
  "কুমিল্লা": ["কোতোয়ালি", "আদর্শ সদর", "চৌদ্দগ্রাম", "দাউদকান্দি", "দেবিদ্বার", "হোমনা", "লাকসাম", "মুরাদনগর", "নাঙ্গলকোট", "বরুড়া", "ব্রাহ্মণপাড়া", "বুড়িচং", "চান্দিনা", "মেঘনা", "তিতাস", "মনোহরগঞ্জ"],
  "নারায়ণগঞ্জ": ["সদর", "বন্দর", "আড়াইহাজার", "রূপগঞ্জ", "সোনারগাঁও"],
  "গাজীপুর": ["গাজীপুর সদর", "কালীগঞ্জ", "কাপাসিয়া", "শ্রীপুর", "টঙ্গী"],
  "ময়মনসিংহ": ["কোতোয়ালি", "ভালুকা", "ত্রিশাল", "ফুলবাড়িয়া", "মুক্তাগাছা", "গফরগাঁও", "ঈশ্বরগঞ্জ", "নান্দাইল", "গৌরীপুর", "ফুলপুর", "হালুয়াঘাট", "তারাকান্দা"],
  "রংপুর": ["কোতোয়ালি", "গঙ্গাচড়া", "তারাগঞ্জ", "বদরগঞ্জ", "মিঠাপুকুর", "পীরগাছা", "পীরগঞ্জ", "কাউনিয়া"],
  "দিনাজপুর": ["কোতোয়ালি", "বিরামপুর", "বীরগঞ্জ", "বোচাগঞ্জ", "চিরিরবন্দর", "ফুলবাড়ী", "ঘোড়াঘাট", "হাকিমপুর", "খানসামা", "নবাবগঞ্জ", "পার্বতীপুর"],
  "যশোর": ["কোতোয়ালি", "মনিরামপুর", "অভয়নগর", "বাঘারপাড়া", "চৌগাছা", "ঝিকরগাছা", "কেশবপুর", "শার্শা"],
  "বগুড়া": ["বগুড়া সদর", "শাহজাহানপুর", "শেরপুর", "কাহালু", "গাবতলী", "নন্দীগ্রাম", "সারিয়াকান্দি", "সোনাতলা", "ধুনট", "শিবগঞ্জ", "আদমদীঘি", "দুপচাঁচিয়া"],
  "পাবনা": ["পাবনা সদর", "ঈশ্বরদী", "বেড়া", "ভাঙ্গুড়া", "চাটমোহর", "ফরিদপুর", "সুজানগর", "আটঘরিয়া", "সাঁথিয়া"],
  "নোয়াখালী": ["নোয়াখালী সদর", "বেগমগঞ্জ", "চাটখিল", "কোম্পানিগঞ্জ", "হাতিয়া", "সেনবাগ", "সোনাইমুড়ী", "সুবর্ণচর", "কবিরহাট"],
  "ফেনী": ["ফেনী সদর", "ছাগলনাইয়া", "দাগনভূঁইয়া", "ফুলগাজী", "পরশুরাম", "সোনাগাজী"],
  "টাঙ্গাইল": ["টাঙ্গাইল সদর", "মধুপুর", "ঘাটাইল", "কালিহাতি", "নাগরপুর", "মির্জাপুর", "গোপালপুর", "সখিপুর", "বাসাইল", "দেলদুয়ার", "ধনবাড়ী", "ভূঞাপুর"],
  "কিশোরগঞ্জ": ["কিশোরগঞ্জ সদর", "ভৈরব", "কটিয়াদি", "কুলিয়ারচর", "পাকুন্দিয়া", "হোসেনপুর", "তাড়াইল", "করিমগঞ্জ", "বাজিতপুর", "অষ্টগ্রাম", "নিকলী", "মিঠামইন", "ইটনা"],
  "ফরিদপুর": ["ফরিদপুর সদর", "আলফাডাঙ্গা", "ভাঙ্গা", "বোয়ালমারী", "চরভদ্রাসন", "মধুখালী", "নগরকান্দা", "সদরপুর", "সালথা"],
  "মুন্সীগঞ্জ": ["মুন্সীগঞ্জ সদর", "গজারিয়া", "লৌহজং", "সিরাজদিখান", "শ্রীনগর", "টঙ্গীবাড়ী"],
  "মানিকগঞ্জ": ["মানিকগঞ্জ সদর", "শিবালয়", "সাটুরিয়া", "হরিরামপুর", "ঘিওর", "দৌলতপুর", "সিংগাইর"],
  "নরসিংদী": ["নরসিংদী সদর", "বেলাবো", "মনোহরদী", "পলাশ", "রায়পুরা", "শিবপুর"],
  "মাদারীপুর": ["মাদারীপুর সদর", "কালকিনি", "রাজৈর", "শিবচর"],
  "শরীয়তপুর": ["শরীয়তপুর সদর", "ডামুড্যা", "গোসাইরহাট", "নড়িয়া", "জাজিরা", "ভেদরগঞ্জ"],
  "গোপালগঞ্জ": ["গোপালগঞ্জ সদর", "কাশিয়ানী", "কোটালীপাড়া", "মুকসুদপুর", "টুঙ্গিপাড়া"],
  "ব্রাহ্মণবাড়িয়া": ["ব্রাহ্মণবাড়িয়া সদর", "আশুগঞ্জ", "নবীনগর", "বাঞ্ছারামপুর", "কসবা", "আখাউড়া", "সরাইল", "নাসিরনগর", "বিজয়নগর"],
  "চাঁদপুর": ["চাঁদপুর সদর", "হাইমচর", "কচুয়া", "মতলব উত্তর", "মতলব দক্ষিণ", "ফরিদগঞ্জ", "হাজীগঞ্জ", "শাহরাস্তি"],
  "লক্ষ্মীপুর": ["লক্ষ্মীপুর সদর", "রায়পুর", "রামগঞ্জ", "রামগতি", "কমলনগর"],
  "কক্সবাজার": ["কক্সবাজার সদর", "চকরিয়া", "কুতুবদিয়া", "মহেশখালী", "পেকুয়া", "রামু", "টেকনাফ", "উখিয়া"],
  "রাঙ্গামাটি": ["রাঙ্গামাটি সদর", "কাপ্তাই", "কাউখালী", "বাঘাইছড়ি", "বরকল", "জুরাছড়ি", "লংগদু", "নানিয়ারচর", "রাজস্থলী", "বিলাইছড়ি"],
  "খাগড়াছড়ি": ["খাগড়াছড়ি সদর", "দীঘিনালা", "মাটিরাঙ্গা", "মানিকছড়ি", "লক্ষ্মীছড়ি", "পানছড়ি", "রামগড়", "মহালছড়ি", "গুইমারা"],
  "বান্দরবান": ["বান্দরবান সদর", "থানচি", "রোয়াংছড়ি", "রুমা", "আলীকদম", "লামা", "নাইক্ষ্যংছড়ি"],
  "সাতক্ষীরা": ["সাতক্ষীরা সদর", "কলারোয়া", "তালা", "শ্যামনগর", "আশাশুনি", "দেবহাটা", "কালিগঞ্জ"],
  "বাগেরহাট": ["বাগেরহাট সদর", "চিতলমারী", "ফকিরহাট", "কচুয়া", "মোল্লাহাট", "মোংলা", "মোরেলগঞ্জ", "রামপাল", "শরণখোলা"],
  "ঝিনাইদহ": ["ঝিনাইদহ সদর", "কালীগঞ্জ", "কোটচাঁদপুর", "মহেশপুর", "শৈলকুপা", "হরিণাকুন্ডু"],
  "কুষ্টিয়া": ["কুষ্টিয়া সদর", "কুমারখালী", "খোকসা", "মিরপুর", "ভেড়ামারা", "দৌলতপুর"],
  "মাগুরা": ["মাগুরা সদর", "মোহাম্মদপুর", "শালিখা", "শ্রীপুর"],
  "মেহেরপুর": ["মেহেরপুর সদর", "গাংনী", "মুজিবনগর"],
  "চুয়াডাঙ্গা": ["চুয়াডাঙ্গা সদর", "আলমডাঙ্গা", "দামুড়হুদা", "জীবননগর"],
  "নড়াইল": ["নড়াইল সদর", "কালিয়া", "লোহাগড়া"],
  "জামালপুর": ["জামালপুর সদর", "বকশীগঞ্জ", "দেওয়ানগঞ্জ", "ইসলামপুর", "মাদারগঞ্জ", "মেলান্দহ", "সরিষাবাড়ী"],
  "শেরপুর": ["শেরপুর সদর", "নকলা", "ঝিনাইগাতী", "নালিতাবাড়ী", "শ্রীবরদী"],
  "নেত্রকোনা": ["নেত্রকোনা সদর", "আটপাড়া", "বারহাট্টা", "দুর্গাপুর", "কলমাকান্দা", "কেন্দুয়া", "খালিয়াজুরী", "মদন", "মোহনগঞ্জ", "পূর্বধলা"],
  "হবিগঞ্জ": ["হবিগঞ্জ সদর", "আজমিরীগঞ্জ", "বাহুবল", "বানিয়াচং", "চুনারুঘাট", "লাখাই", "মাধবপুর", "নবীগঞ্জ"],
  "মৌলভীবাজার": ["মৌলভীবাজার সদর", "কমলগঞ্জ", "কুলাউড়া", "বড়লেখা", "জুড়ী", "রাজনগর", "শ্রীমঙ্গল"],
  "সুনামগঞ্জ": ["সুনামগঞ্জ সদর", "ছাতক", "জামালগঞ্জ", "দোয়ারাবাজার", "তাহিরপুর", "ধর্মপাশা", "জগন্নাথপুর", "বিশ্বম্ভরপুর", "শাল্লা", "দক্ষিণ সুনামগঞ্জ", "মধ্যনগর"],
  "নওগাঁ": ["নওগাঁ সদর", "আত্রাই", "বদলগাছি", "ধামইরহাট", "মান্দা", "মহাদেবপুর", "নিয়ামতপুর", "পত্নীতলা", "পোরশা", "রাণীনগর", "সাপাহার"],
  "নাটোর": ["নাটোর সদর", "বড়াইগ্রাম", "বাগাতিপাড়া", "গুরুদাসপুর", "লালপুর", "সিংড়া"],
  "চাঁপাইনবাবগঞ্জ": ["চাঁপাইনবাবগঞ্জ সদর", "গোমস্তাপুর", "নাচোল", "ভোলাহাট", "শিবগঞ্জ"],
  "সিরাজগঞ্জ": ["সিরাজগঞ্জ সদর", "বেলকুচি", "চৌহালি", "কামারখন্দ", "কাজীপুর", "রায়গঞ্জ", "শাহজাদপুর", "তাড়াশ", "উল্লাপাড়া"],
  "জয়পুরহাট": ["জয়পুরহাট সদর", "আক্কেলপুর", "কালাই", "খেতলাল", "পাঁচবিবি"],
  "ঠাকুরগাঁও": ["ঠাকুরগাঁও সদর", "বালিয়াডাঙ্গি", "হরিপুর", "পীরগঞ্জ", "রাণীশংকৈল"],
  "পঞ্চগড়": ["পঞ্চগড় সদর", "আটোয়ারী", "বোদা", "দেবীগঞ্জ", "তেতুলিয়া"],
  "নীলফামারী": ["নীলফামারী সদর", "ডিমলা", "ডোমার", "জলঢাকা", "কিশোরগঞ্জ", "সৈয়দপুর"],
  "লালমনিরহাট": ["লালমনিরহাট সদর", "আদিতমারী", "কালীগঞ্জ", "হাতীবান্ধা", "পাটগ্রাম"],
  "কুড়িগ্রাম": ["কুড়িগ্রাম সদর", "ভুরুঙ্গামারী", "চিলমারী", "নাগেশ্বরী", "ফুলবাড়ী", "রাজারহাট", "রৌমারী", "উলিপুর", "রাজিবপুর"],
  "গাইবান্ধা": ["গাইবান্ধা সদর", "ফুলছড়ি", "গোবিন্দগঞ্জ", "পলাশবাড়ী", "সাদুল্লাপুর", "সাঘাটা", "সুন্দরগঞ্জ"],
  "ভোলা": ["ভোলা সদর", "বোরহানউদ্দিন", "চরফ্যাশন", "দৌলতখান", "লালমোহন", "মনপুরা", "তজুমুদ্দিন"],
  "পটুয়াখালী": ["পটুয়াখালী সদর", "বাউফল", "দশমিনা", "দুমকি", "গলাচিপা", "কলাপাড়া", "মির্জাগঞ্জ", "রাঙ্গাবালী"],
  "পিরোজপুর": ["পিরোজপুর সদর", "ভান্ডারিয়া", "কাউখালী", "মঠবাড়িয়া", "নাজিরপুর", "নেছারাবাদ", "জিয়ানগর"],
  "ঝালকাঠি": ["ঝালকাঠি সদর", "কাঠালিয়া", "নলছিটি", "রাজাপুর"],
  "বরগুনা": ["বরগুনা সদর", "আমতলী", "বামনা", "বেতাগী", "পাথরঘাটা", "তালতলী"],
};

// English → Bengali district mapping
const DISTRICT_EN_TO_BN: Record<string, string> = {
  "dhaka": "ঢাকা", "chittagong": "চট্টগ্রাম", "chattogram": "চট্টগ্রাম", "sylhet": "সিলেট",
  "rajshahi": "রাজশাহী", "khulna": "খুলনা", "barisal": "বরিশাল", "barishal": "বরিশাল",
  "comilla": "কুমিল্লা", "cumilla": "কুমিল্লা", "narayanganj": "নারায়ণগঞ্জ",
  "gazipur": "গাজীপুর", "mymensingh": "ময়মনসিংহ", "rangpur": "রংপুর",
  "dinajpur": "দিনাজপুর", "jessore": "যশোর", "jashore": "যশোর", "bogra": "বগুড়া", "bogura": "বগুড়া",
  "pabna": "পাবনা", "noakhali": "নোয়াখালী", "feni": "ফেনী", "tangail": "টাঙ্গাইল",
  "kishoreganj": "কিশোরগঞ্জ", "faridpur": "ফরিদপুর", "munshiganj": "মুন্সীগঞ্জ",
  "manikganj": "মানিকগঞ্জ", "narsingdi": "নরসিংদী", "madaripur": "মাদারীপুর",
  "shariatpur": "শরীয়তপুর", "gopalganj": "গোপালগঞ্জ", "brahmanbaria": "ব্রাহ্মণবাড়িয়া",
  "chandpur": "চাঁদপুর", "lakshmipur": "লক্ষ্মীপুর", "coxs bazar": "কক্সবাজার", "cox's bazar": "কক্সবাজার",
  "coxsbazar": "কক্সবাজার", "rangamati": "রাঙ্গামাটি", "khagrachhari": "খাগড়াছড়ি", "khagrachari": "খাগড়াছড়ি",
  "bandarban": "বান্দরবান", "satkhira": "সাতক্ষীরা", "bagerhat": "বাগেরহাট",
  "jhenaidah": "ঝিনাইদহ", "kushtia": "কুষ্টিয়া", "magura": "মাগুরা", "meherpur": "মেহেরপুর",
  "chuadanga": "চুয়াডাঙ্গা", "narail": "নড়াইল", "jamalpur": "জামালপুর", "sherpur": "শেরপুর",
  "netrokona": "নেত্রকোনা", "habiganj": "হবিগঞ্জ", "moulvibazar": "মৌলভীবাজার",
  "sunamganj": "সুনামগঞ্জ", "naogaon": "নওগাঁ", "natore": "নাটোর",
  "chapainawabganj": "চাঁপাইনবাবগঞ্জ", "sirajganj": "সিরাজগঞ্জ", "joypurhat": "জয়পুরহাট",
  "thakurgaon": "ঠাকুরগাঁও", "panchagarh": "পঞ্চগড়", "nilphamari": "নীলফামারী",
  "lalmonirhat": "লালমনিরহাট", "kurigram": "কুড়িগ্রাম", "gaibandha": "গাইবান্ধা",
  "bhola": "ভোলা", "patuakhali": "পটুয়াখালী", "pirojpur": "পিরোজপুর",
  "jhalokathi": "ঝালকাঠি", "jhalokati": "ঝালকাঠি", "barguna": "বরগুনা",
};

// English thana → { district_bn, thana_bn }
const THANA_EN_MAP: Record<string, { district: string; thana: string }> = {
  "mirpur": { district: "ঢাকা", thana: "মিরপুর" },
  "uttara": { district: "ঢাকা", thana: "উত্তরা" },
  "mohammadpur": { district: "ঢাকা", thana: "মোহাম্মদপুর" },
  "dhanmondi": { district: "ঢাকা", thana: "ধানমন্ডি" },
  "gulshan": { district: "ঢাকা", thana: "গুলশান" },
  "banani": { district: "ঢাকা", thana: "বনানী" },
  "rampura": { district: "ঢাকা", thana: "রামপুরা" },
  "badda": { district: "ঢাকা", thana: "বাড্ডা" },
  "khilgaon": { district: "ঢাকা", thana: "খিলগাঁও" },
  "jatrabari": { district: "ঢাকা", thana: "যাত্রাবাড়ী" },
  "motijheel": { district: "ঢাকা", thana: "মতিঝিল" },
  "paltan": { district: "ঢাকা", thana: "পল্টন" },
  "lalbagh": { district: "ঢাকা", thana: "লালবাগ" },
  "hazaribagh": { district: "ঢাকা", thana: "হাজারীবাগ" },
  "shyamoli": { district: "ঢাকা", thana: "শ্যামলী" },
  "farmgate": { district: "ঢাকা", thana: "ফার্মগেট" },
  "agargaon": { district: "ঢাকা", thana: "আগারগাঁও" },
  "tejgaon": { district: "ঢাকা", thana: "তেজগাঁও" },
  "shahbag": { district: "ঢাকা", thana: "শাহবাগ" },
  "malibagh": { district: "ঢাকা", thana: "মালিবাগ" },
  "shantinagar": { district: "ঢাকা", thana: "শান্তিনগর" },
  "savar": { district: "ঢাকা", thana: "সাভার" },
  "keraniganj": { district: "ঢাকা", thana: "কেরানীগঞ্জ" },
  "tongi": { district: "গাজীপুর", thana: "টঙ্গী" },
  "demra": { district: "ঢাকা", thana: "ডেমরা" },
  "wari": { district: "ঢাকা", thana: "ওয়ারী" },
  "kolabaganr": { district: "ঢাকা", thana: "কলাবাগান" },
  "kolabagan": { district: "ঢাকা", thana: "কলাবাগান" },
  "dakkhin khan": { district: "ঢাকা", thana: "দক্ষিণখান" },
  "uttar khan": { district: "ঢাকা", thana: "উত্তরখান" },
  "turag": { district: "ঢাকা", thana: "তুরাগ" },
  "pallabi": { district: "ঢাকা", thana: "পল্লবী" },
  "adabor": { district: "ঢাকা", thana: "আদাবর" },
  "panchlaish": { district: "চট্টগ্রাম", thana: "পাঁচলাইশ" },
  "agrabad": { district: "চট্টগ্রাম", thana: "ডবলমুরিং" },
  "halishahar": { district: "চট্টগ্রাম", thana: "হালিশহর" },
  "khulshi": { district: "চট্টগ্রাম", thana: "খুলশি" },
  "pahartali": { district: "চট্টগ্রাম", thana: "পাহাড়তলী" },
  "sitakunda": { district: "চট্টগ্রাম", thana: "সীতাকুণ্ড" },
  "patenga": { district: "চট্টগ্রাম", thana: "পতেঙ্গা" },
  "gazipur sadar": { district: "গাজীপুর", thana: "গাজীপুর সদর" },
  "sreepur": { district: "গাজীপুর", thana: "শ্রীপুর" },
  "kaliakair": { district: "গাজীপুর", thana: "কালীগঞ্জ" },
  "rupganj": { district: "নারায়ণগঞ্জ", thana: "রূপগঞ্জ" },
  "sonargaon": { district: "নারায়ণগঞ্জ", thana: "সোনারগাঁও" },
  "srimangal": { district: "মৌলভীবাজার", thana: "শ্রীমঙ্গল" },
  "teknaf": { district: "কক্সবাজার", thana: "টেকনাফ" },
  "ukhiya": { district: "কক্সবাজার", thana: "উখিয়া" },
};

// Build a reverse map: BN district name → all BN thana names (lowercase)
const districtBnLower = new Map<string, string>();
for (const [bn] of Object.entries(LOCATIONS_BN)) {
  districtBnLower.set(bn.toLowerCase(), bn);
}

/**
 * Parse a free-text address and try to detect district + thana.
 */
export function parseAddress(address: string): ParseResult {
  if (!address || address.trim().length < 3) return { district: null, thana: null };

  const text = address.toLowerCase().trim();
  // Split by common separators
  const tokens = text.split(/[,،\n\r।\-\/]+/).map((t) => t.trim()).filter(Boolean);
  // Also split each token by spaces for individual word matching
  const words = text.split(/[\s,،\n\r।\-\/]+/).filter(Boolean);

  let detectedDistrict: string | null = null;
  let detectedThana: string | null = null;

  // 1. Check English thana map first (most specific)
  for (const token of [...tokens, ...generatePhrases(words)]) {
    const trimmed = token.trim().toLowerCase();
    if (THANA_EN_MAP[trimmed]) {
      const match = THANA_EN_MAP[trimmed];
      if (!detectedDistrict) detectedDistrict = match.district;
      if (!detectedThana) detectedThana = match.thana;
    }
  }

  // 2. Check English district names
  if (!detectedDistrict) {
    for (const word of words) {
      if (DISTRICT_EN_TO_BN[word]) {
        detectedDistrict = DISTRICT_EN_TO_BN[word];
        break;
      }
    }
    // Try multi-word (e.g. "cox's bazar")
    if (!detectedDistrict) {
      for (const token of tokens) {
        const trimmed = token.trim().toLowerCase();
        if (DISTRICT_EN_TO_BN[trimmed]) {
          detectedDistrict = DISTRICT_EN_TO_BN[trimmed];
          break;
        }
      }
    }
  }

  // 3. Check Bengali district names
  if (!detectedDistrict) {
    for (const [districtBn] of Object.entries(LOCATIONS_BN)) {
      if (text.includes(districtBn.toLowerCase())) {
        detectedDistrict = districtBn;
        break;
      }
    }
  }

  // 4. Check Bengali thana names (search within detected district first, then all)
  if (!detectedThana) {
    const searchDistricts = detectedDistrict
      ? [[detectedDistrict, LOCATIONS_BN[detectedDistrict] || []]] as [string, string[]][]
      : Object.entries(LOCATIONS_BN);

    for (const [district, thanas] of searchDistricts) {
      for (const thana of thanas) {
        if (text.includes(thana.toLowerCase())) {
          detectedThana = thana;
          if (!detectedDistrict) detectedDistrict = district;
          break;
        }
      }
      if (detectedThana) break;
    }
  }

  // 5. If still no thana, check all districts' thanas
  if (!detectedThana && detectedDistrict) {
    // Already searched, skip
  } else if (!detectedThana && !detectedDistrict) {
    for (const [district, thanas] of Object.entries(LOCATIONS_BN)) {
      for (const thana of thanas) {
        if (text.includes(thana.toLowerCase())) {
          detectedThana = thana;
          detectedDistrict = district;
          break;
        }
      }
      if (detectedThana) break;
    }
  }

  return { district: detectedDistrict, thana: detectedThana };
}

/** Generate 2-3 word phrases from word list for matching */
function generatePhrases(words: string[]): string[] {
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
    if (i < words.length - 2) {
      phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }
  return phrases;
}

/** Get all district names (Bengali) */
export function getAllDistricts(): string[] {
  return Object.keys(LOCATIONS_BN);
}

/** Get thanas for a district (Bengali) */
export function getThanas(districtBn: string): string[] {
  return LOCATIONS_BN[districtBn] || [];
}
