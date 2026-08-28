/**
 * Development seed catalogue for Meemi Art.
 *
 * This file is *development data only*. It is never imported by the app —
 * only by `prisma/seed.ts`, which refuses to run unless ALLOW_SEED is set.
 *
 * Photography is sourced from Unsplash and stands in for real product shots.
 * Every image id here has been checked to resolve.
 */

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

export const categories = [
  {
    name: "Crochet Bags",
    slug: "crochet-bags",
    icon: "ShoppingBag",
    sortOrder: 1,
    description:
      "Totes, shoulder bags and pouches worked in sturdy cotton yarn. Structured enough for everyday carry, soft enough to fold away.",
    image: img("photo-1594223274512-ad4803739b7c"),
  },
  {
    name: "Crochet Flowers",
    slug: "crochet-flowers",
    icon: "Flower",
    sortOrder: 2,
    description:
      "Single stems and small posies that never wilt. Wired for shaping, made to sit in a vase or pin to a lapel.",
    image: img("photo-1487070183336-b863922373d4"),
  },
  {
    name: "Crochet Bouquets",
    slug: "crochet-bouquets",
    icon: "Sparkles",
    sortOrder: 3,
    description:
      "Arranged bouquets built stem by stem. A gift that keeps its colour long after fresh flowers would have gone.",
    image: img("photo-1519378058457-4c29a0a2efac"),
  },
  {
    name: "Crochet Plushies",
    slug: "crochet-plushies",
    icon: "Rabbit",
    sortOrder: 4,
    description:
      "Amigurumi characters worked at a tight gauge with safety-locked details and a firm, huggable stuff.",
    image: img("photo-1566576912321-d58ddd7a6088"),
  },
  {
    name: "Crochet Accessories",
    slug: "crochet-accessories",
    icon: "Watch",
    sortOrder: 5,
    description:
      "Keyrings, scrunchies, coasters and the small finishing pieces that carry the most texture per square inch.",
    image: img("photo-1520903920243-00d872a2d1c9"),
  },
  {
    name: "Crochet Gifts",
    slug: "crochet-gifts",
    icon: "Gift",
    sortOrder: 6,
    description:
      "Ready-to-give sets, boxed and finished by hand. Chosen to work as a present without any further wrapping.",
    image: img("photo-1513885535751-8b9238bd345a"),
  },
] as const;

type SeedProduct = {
  name: string;
  slug: string;
  brand: string;
  category: string;
  priceCents: number;
  compareAtCents?: number;
  shortDescription: string;
  description: string;
  material: string;
  care: string;
  dimensions?: string;
  processingTime?: string;
  isCustomizable?: boolean;
  featured?: boolean;
  images: string[];
  sizes: string[];
  colors: { name: string; hex: string }[];
};

const ONE_SIZE = ["One size"];

export const products: SeedProduct[] = [
  // ------------------------------------------------------------- bags
  {
    name: "Marlow Market Tote",
    slug: "marlow-market-tote",
    brand: "Meemi Art",
    category: "crochet-bags",
    priceCents: 8800,
    compareAtCents: 11_000,
    shortDescription: "Roomy everyday tote in mercerised cotton",
    description:
      "A market tote worked in tight single crochet so the fabric holds its shape under weight rather than sagging into a net. The base is doubled and the handles are worked into the body rather than sewn on, which is the join that usually fails first. Fits a laptop, a lunch and a paperback with room left over.",
    material: "100% mercerised cotton yarn, cotton drill lining",
    care: "Hand wash cool, reshape damp, dry flat away from direct sun.",
    dimensions: "38cm W × 34cm H × 11cm D, 24cm handle drop",
    processingTime: "Made to order in 5–7 days",
    isCustomizable: true,
    featured: true,
    images: [img("photo-1594223274512-ad4803739b7c"), img("photo-1591561954557-26941169b49e")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Undyed", hex: "#E4D7C3" },
      { name: "Clay", hex: "#A34A26" },
      { name: "Charcoal", hex: "#3A3632" },
    ],
  },
  {
    name: "Isla Shoulder Bag",
    slug: "isla-shoulder-bag",
    brand: "Meemi Art",
    category: "crochet-bags",
    priceCents: 6800,
    shortDescription: "Compact shoulder bag with a magnetic closure",
    description:
      "Worked in a dense half-double crochet that gives the bag a smooth, almost woven face. Lined in cotton with an interior slip pocket and closed with a magnetic snap set into a reinforced tab, so the opening keeps its shape rather than stretching over time.",
    material: "Recycled cotton blend yarn, cotton lining, brass hardware",
    care: "Spot clean. Hand wash cool if needed and dry flat.",
    dimensions: "26cm W × 18cm H × 8cm D",
    processingTime: "Made to order in 5–7 days",
    featured: true,
    images: [img("photo-1591561954557-26941169b49e"), img("photo-1548036328-c9fa89d128fa")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Oat", hex: "#D8C7AC" },
      { name: "Moss", hex: "#4A5443" },
    ],
  },
  {
    name: "Pebble Pouch",
    slug: "pebble-pouch",
    brand: "Meemi Art",
    category: "crochet-bags",
    priceCents: 3200,
    shortDescription: "Zip pouch for the small things",
    description:
      "A soft-sided pouch sized for cables, cosmetics or a passport. The zip is hand-set into a crocheted facing so there is no raw tape against the contents, and the base is worked flat so it stands rather than slumps.",
    material: "100% cotton yarn, metal zip",
    care: "Hand wash cool, dry flat.",
    dimensions: "20cm W × 13cm H",
    processingTime: "Ships in 1–2 days",
    images: [img("photo-1548036328-c9fa89d128fa"), img("photo-1584917865442-de89df76afd3")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Undyed", hex: "#E4D7C3" },
      { name: "Rust", hex: "#9C5433" },
      { name: "Slate", hex: "#5C636B" },
    ],
  },
  {
    name: "Harbour String Bag",
    slug: "harbour-string-bag",
    brand: "Meemi Art",
    category: "crochet-bags",
    priceCents: 4200,
    compareAtCents: 5400,
    shortDescription: "Open-mesh bag that packs down to nothing",
    description:
      "An open mesh worked in a strong linen-cotton blend that stretches to hold a surprising amount and then folds into a pocket. Intended as a genuine replacement for a carrier bag rather than an ornament.",
    material: "60% cotton, 40% linen yarn",
    care: "Machine wash cool in a bag, dry flat.",
    dimensions: "34cm W × 40cm H unstretched",
    processingTime: "Ships in 1–2 days",
    images: [img("photo-1553062407-98eeb64c6a62"), img("photo-1594223274512-ad4803739b7c")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Natural", hex: "#E8DCC8" },
      { name: "Ochre", hex: "#B5822F" },
    ],
  },

  // ------------------------------------------------------------- flowers
  {
    name: "Single Stem Rose",
    slug: "single-stem-rose",
    brand: "Meemi Art",
    category: "crochet-flowers",
    priceCents: 1400,
    shortDescription: "One wired rose, petal by petal",
    description:
      "Each petal is worked separately and joined by hand, then set on a florist-wire stem wrapped in green tape so it can be bent and posed. Sold as a single stem — build a posy from whatever colours you like.",
    material: "Cotton yarn, florist wire, floral tape",
    care: "Dust gently. Reshape petals with your fingers.",
    dimensions: "Bloom 6cm across, stem 32cm",
    processingTime: "Ships in 1–2 days",
    featured: true,
    images: [img("photo-1487070183336-b863922373d4"), img("photo-1518895949257-7621c3c786d7")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Dusty Rose", hex: "#C08B86" },
      { name: "Ivory", hex: "#EFE6D7" },
      { name: "Deep Red", hex: "#8C2F2A" },
      { name: "Clay", hex: "#A34A26" },
    ],
  },
  {
    name: "Tulip Trio",
    slug: "tulip-trio",
    brand: "Meemi Art",
    category: "crochet-flowers",
    priceCents: 3600,
    shortDescription: "Three wired tulips with folded leaves",
    description:
      "Three tulips worked in a smooth cotton that holds the cup shape of the bloom without stuffing. Leaves are worked long and wired so they can be curved around the stems. Sits well in a narrow vase or tied with a ribbon as a small gift.",
    material: "Cotton yarn, florist wire",
    care: "Dust gently. Reshape by hand.",
    dimensions: "Stems 34cm",
    processingTime: "Made to order in 3–5 days",
    isCustomizable: true,
    images: [img("photo-1518895949257-7621c3c786d7"), img("photo-1487070183336-b863922373d4")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Butter", hex: "#E3C878" },
      { name: "Blush", hex: "#DDB0AC" },
      { name: "White", hex: "#F2EDE4" },
    ],
  },
  {
    name: "Lavender Bunch",
    slug: "lavender-bunch",
    brand: "Meemi Art",
    category: "crochet-flowers",
    priceCents: 2800,
    shortDescription: "Slim stems with bobble florets",
    description:
      "Bobble stitches worked up a wired stem give the texture of lavender without the mess of dried stalks. Five stems bound at the base with cotton twine.",
    material: "Cotton yarn, florist wire, cotton twine",
    care: "Dust gently.",
    dimensions: "Stems 30cm, bundle of 5",
    processingTime: "Ships in 1–2 days",
    images: [img("photo-1499002238440-d264edd596ec"), img("photo-1468327768560-75b778cbb551")],
    sizes: ONE_SIZE,
    colors: [{ name: "Heather", hex: "#8E7FA6" }],
  },

  // ------------------------------------------------------------- bouquets
  {
    name: "Everyday Posy",
    slug: "everyday-posy",
    brand: "Meemi Art",
    category: "crochet-bouquets",
    priceCents: 7400,
    compareAtCents: 8900,
    shortDescription: "Nine stems, arranged and wrapped",
    description:
      "A mixed posy of roses, tulips and small filler blooms, arranged by hand and wrapped in unbleached paper with a cotton tie. Built to sit as it arrives — no arranging needed — and to keep its colour indefinitely.",
    material: "Cotton yarn, florist wire, unbleached wrap",
    care: "Dust gently. Keep out of prolonged direct sun.",
    dimensions: "Approx. 34cm tall, 22cm across",
    processingTime: "Made to order in 7–10 days",
    isCustomizable: true,
    featured: true,
    images: [img("photo-1519378058457-4c29a0a2efac"), img("photo-1457089328109-e5d9bd499191")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Warm Neutrals", hex: "#DCC6AC" },
      { name: "Dusty Pinks", hex: "#C99A98" },
      { name: "Autumn", hex: "#A15C2C" },
    ],
  },
  {
    name: "Bridal Bouquet",
    slug: "bridal-bouquet",
    brand: "Meemi Art",
    category: "crochet-bouquets",
    priceCents: 16_500,
    shortDescription: "A keepsake bouquet made to your palette",
    description:
      "A full bridal bouquet worked to your chosen colours, with a wrapped and ribboned handle sized to hold comfortably. Because it does not wilt it can be made weeks ahead and kept afterwards. Colour matching is done from photographs before work begins.",
    material: "Cotton and viscose blend yarn, florist wire, satin ribbon",
    care: "Dust gently. Store in the box provided.",
    dimensions: "Approx. 28cm across, 30cm handle",
    processingTime: "Made to order in 3–4 weeks",
    isCustomizable: true,
    images: [img("photo-1457089328109-e5d9bd499191"), img("photo-1519378058457-4c29a0a2efac")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Ivory & Sage", hex: "#DFD9C7" },
      { name: "Blush & Cream", hex: "#E3C6C0" },
    ],
  },

  // ------------------------------------------------------------- plushies
  {
    name: "Otis the Bear",
    slug: "otis-the-bear",
    brand: "Meemi Art",
    category: "crochet-plushies",
    priceCents: 4800,
    shortDescription: "Amigurumi bear with jointed arms",
    description:
      "Worked at a tight gauge so the stuffing never shows through, with embroidered features rather than plastic eyes — safe from the first day for the youngest owners. The arms are button-jointed so they move and hold a pose.",
    material: "Cotton yarn, polyester fibre fill",
    care: "Surface wash only. Do not machine wash.",
    dimensions: "26cm seated",
    processingTime: "Made to order in 5–7 days",
    featured: true,
    images: [img("photo-1566576912321-d58ddd7a6088"), img("photo-1530325553241-4f6e7690cf36")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Honey", hex: "#C79A5B" },
      { name: "Oat", hex: "#D8C7AC" },
      { name: "Charcoal", hex: "#3A3632" },
    ],
  },
  {
    name: "Pip the Bunny",
    slug: "pip-the-bunny",
    brand: "Meemi Art",
    category: "crochet-plushies",
    priceCents: 4200,
    compareAtCents: 5200,
    shortDescription: "Long-eared bunny with a weighted base",
    description:
      "A sitting bunny with a lightly weighted base so it stays upright on a shelf. Ears are worked double-thickness to hold their shape, and all features are embroidered.",
    material: "Cotton yarn, polyester fibre fill, glass bead weight",
    care: "Surface wash only.",
    dimensions: "24cm seated, ears 12cm",
    processingTime: "Made to order in 5–7 days",
    images: [img("photo-1530325553241-4f6e7690cf36"), img("photo-1566576912321-d58ddd7a6088")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Cream", hex: "#EAE0CE" },
      { name: "Dusty Rose", hex: "#C08B86" },
    ],
  },
  {
    name: "Momo the Cat",
    slug: "momo-the-cat",
    brand: "Meemi Art",
    category: "crochet-plushies",
    priceCents: 4500,
    shortDescription: "Loaf-shaped cat that fits in one hand",
    description:
      "A small, dense plush worked in the round with no seams along the body. Sized to sit on a desk or a windowsill, with a tail that can be curled around the base.",
    material: "Cotton yarn, polyester fibre fill",
    care: "Surface wash only.",
    dimensions: "16cm long",
    processingTime: "Ships in 2–3 days",
    images: [img("photo-1592194996308-7b43878e84a6"), img("photo-1533738363-b7f9aef128ce")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Ginger", hex: "#B5702F" },
      { name: "Grey", hex: "#8C8B87" },
      { name: "Ink", hex: "#2C2A28" },
    ],
  },

  // ------------------------------------------------------------- accessories
  {
    name: "Bloom Keyring",
    slug: "bloom-keyring",
    brand: "Meemi Art",
    category: "crochet-accessories",
    priceCents: 1200,
    shortDescription: "A small flower on a brass ring",
    description:
      "A single worked bloom finished onto a solid brass split ring and lobster clasp. Small enough to live on a bag zip without catching, and firm enough not to flatten in a pocket.",
    material: "Cotton yarn, solid brass hardware",
    care: "Spot clean.",
    dimensions: "Bloom 5cm across",
    processingTime: "Ships in 1–2 days",
    images: [img("photo-1520903920243-00d872a2d1c9"), img("photo-1627123424574-724758594e93")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Clay", hex: "#A34A26" },
      { name: "Ivory", hex: "#EFE6D7" },
      { name: "Moss", hex: "#4A5443" },
      { name: "Dusty Rose", hex: "#C08B86" },
    ],
  },
  {
    name: "Ribbed Scrunchie",
    slug: "ribbed-scrunchie",
    brand: "Meemi Art",
    category: "crochet-accessories",
    priceCents: 900,
    shortDescription: "Soft cotton scrunchie with real hold",
    description:
      "Worked over a strong elastic core in a ribbed stitch that grips without pulling. Cotton rather than synthetic, so it is kinder to hair and washes clean.",
    material: "Cotton yarn, covered elastic",
    care: "Hand wash cool, dry flat.",
    dimensions: "Approx. 10cm across relaxed",
    processingTime: "Ships in 1–2 days",
    images: [img("photo-1522338140262-f46f5913618a"), img("photo-1520903920243-00d872a2d1c9")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Undyed", hex: "#E4D7C3" },
      { name: "Rust", hex: "#9C5433" },
      { name: "Heather", hex: "#8E7FA6" },
      { name: "Charcoal", hex: "#3A3632" },
    ],
  },
  {
    name: "Textured Coaster Set",
    slug: "textured-coaster-set",
    brand: "Meemi Art",
    category: "crochet-accessories",
    priceCents: 2600,
    compareAtCents: 3200,
    shortDescription: "Set of four, worked in dense cotton",
    description:
      "Four coasters in a tight basket stitch that absorbs a ring of condensation and washes out clean. Blocked flat so they sit without curling at the edge.",
    material: "100% cotton yarn",
    care: "Machine wash cool, dry flat, re-block if needed.",
    dimensions: "11cm across, set of 4",
    processingTime: "Ships in 1–2 days",
    images: [img("photo-1616486338812-3dadae4b4ace"), img("photo-1584589167171-541ce45f1eea")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Undyed", hex: "#E4D7C3" },
      { name: "Slate", hex: "#5C636B" },
    ],
  },
  {
    name: "Chunky Beanie",
    slug: "chunky-beanie",
    brand: "Meemi Art",
    category: "crochet-accessories",
    priceCents: 3800,
    shortDescription: "Deep-cuff beanie in wool blend",
    description:
      "A ribbed beanie with a deep fold-back cuff, worked in a wool blend that holds warmth without itching. Crocheted in the round so there is no seam sitting across the forehead.",
    material: "70% wool, 30% acrylic blend yarn",
    care: "Hand wash cool, dry flat.",
    dimensions: "Fits 54–59cm head",
    processingTime: "Ships in 2–3 days",
    images: [img("photo-1576871337622-98d48d1cf531"), img("photo-1519415510236-718bdfcd89c8")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Oat", hex: "#D8C7AC" },
      { name: "Moss", hex: "#4A5443" },
      { name: "Ink", hex: "#2C2A28" },
    ],
  },

  // ------------------------------------------------------------- gifts
  {
    name: "New Home Gift Set",
    slug: "new-home-gift-set",
    brand: "Meemi Art",
    category: "crochet-gifts",
    priceCents: 6400,
    compareAtCents: 7800,
    shortDescription: "Coasters, a posy and a keyring, boxed",
    description:
      "A boxed set of four coasters, a three-stem posy and a bloom keyring, packed in a rigid kraft box with tissue and a blank card. Chosen to work as a present exactly as it arrives.",
    material: "Cotton yarn, kraft gift box",
    care: "See individual pieces.",
    dimensions: "Box 24cm × 18cm × 8cm",
    processingTime: "Made to order in 5–7 days",
    featured: true,
    images: [img("photo-1513885535751-8b9238bd345a"), img("photo-1549465220-1a8b9238cd48")],
    sizes: ONE_SIZE,
    colors: [{ name: "Warm Neutrals", hex: "#DCC6AC" }],
  },
  {
    name: "New Baby Gift Set",
    slug: "new-baby-gift-set",
    brand: "Meemi Art",
    category: "crochet-gifts",
    priceCents: 7200,
    shortDescription: "A plush, booties and a rattle, boxed",
    description:
      "A small bear, a pair of booties and a soft rattle, all worked in cotton with embroidered features and no small parts. Boxed with tissue and a blank card.",
    material: "100% cotton yarn, polyester fibre fill",
    care: "Surface wash the plush. Hand wash booties cool.",
    dimensions: "Box 26cm × 20cm × 9cm",
    processingTime: "Made to order in 7–10 days",
    isCustomizable: true,
    images: [img("photo-1549465220-1a8b9238cd48"), img("photo-1530325553241-4f6e7690cf36")],
    sizes: ONE_SIZE,
    colors: [
      { name: "Cream", hex: "#EAE0CE" },
      { name: "Sage", hex: "#9BA88E" },
    ],
  },
  {
    name: "Gift Card",
    slug: "gift-card",
    brand: "Meemi Art",
    category: "crochet-gifts",
    priceCents: 5000,
    shortDescription: "Let them choose their own piece",
    description:
      "A digital gift card delivered by email, redeemable against anything in the shop. No expiry, and the balance can be spent across more than one order.",
    material: "Digital — nothing is shipped",
    care: "—",
    processingTime: "Delivered by email within minutes",
    images: [img("photo-1607344645866-009c320b63e0"), img("photo-1513885535751-8b9238bd345a")],
    sizes: ONE_SIZE,
    colors: [{ name: "Digital", hex: "#E4D7C3" }],
  },
];

/**
 * Review copy used to populate the `Review` table. These are seeded rows, not
 * invented marketing testimonials — the storefront renders whatever is actually
 * in the database.
 */
export const reviewPool = [
  { rating: 5, title: "Better than the photos", body: "The stitch work is really even and the colour is richer in person. You can tell it was made by someone who cared how the inside looked too." },
  { rating: 5, title: "Arrived beautifully packed", body: "Wrapped in tissue with a handwritten note. It felt like a proper gift before I'd even opened it." },
  { rating: 4, title: "Lovely, slightly smaller than expected", body: "Really well made and the yarn feels lovely. Worth checking the dimensions before ordering — it's a little smaller than I pictured." },
  { rating: 5, title: "Held up to daily use", body: "I've carried this most days for four months. No stretching at the handles and it still holds its shape." },
  { rating: 5, title: "Bought a second one", body: "Ordered one as a gift, liked it so much I kept it and ordered another. The made-to-order wait was worth it." },
  { rating: 4, title: "Great quality", body: "Exactly as described and the finish is clean throughout. Took a few days longer than I hoped but they kept me updated." },
  { rating: 5, title: "The colour is perfect", body: "I asked about matching a shade and they were genuinely helpful. The finished piece is spot on." },
  { rating: 5, title: "My daughter won't put it down", body: "Soft, sturdy, and no loose parts to worry about. It's already been through the wash once and came out fine." },
  { rating: 3, title: "Nice but took a while", body: "The piece itself is lovely and well made. The made-to-order time was longer than I'd planned for, so order early if it's for an occasion." },
  { rating: 5, title: "Worth it", body: "You can see where the time went. The details that don't show from the front are just as neat." },
  { rating: 4, title: "Really pleased", body: "Sits exactly as it should and the texture is lovely up close. Would buy from here again." },
  { rating: 5, title: "Still looks new", body: "Six months on a sunny windowsill and the colour hasn't faded at all." },
] as const;

export const coupons = [
  {
    code: "WELCOME10",
    description: "10% off a first order — offered at newsletter signup.",
    type: "PERCENTAGE" as const,
    value: 10,
    minOrderCents: 0,
    maxUses: 1000,
    daysValid: 365,
  },
  {
    code: "FREESHIP",
    description: "Covers standard shipping on orders over $50.",
    type: "FIXED" as const,
    value: 595,
    minOrderCents: 5000,
    maxUses: null,
    daysValid: 180,
  },
  {
    code: "GIFTING20",
    description: "20% off gift sets. Minimum spend $100.",
    type: "PERCENTAGE" as const,
    value: 20,
    minOrderCents: 10_000,
    maxUses: 400,
    daysValid: 60,
  },
  {
    code: "TENOFF",
    description: "$10 off orders over $80.",
    type: "FIXED" as const,
    value: 1000,
    minOrderCents: 8000,
    maxUses: 250,
    daysValid: 90,
  },
  {
    code: "EXPIRED10",
    description: "Lapsed promotion — kept to exercise the expiry path in testing.",
    type: "PERCENTAGE" as const,
    value: 10,
    minOrderCents: 0,
    maxUses: 100,
    daysValid: -30,
  },
] as const;

export const customers = [
  { name: "Amara Okonkwo", email: "amara.okonkwo@example.com", city: "Portland", state: "OR", postalCode: "97205", line1: "1420 NW Glisan St" },
  { name: "Jonas Meier", email: "jonas.meier@example.com", city: "Seattle", state: "WA", postalCode: "98104", line1: "88 Yesler Way, Apt 12" },
  { name: "Priya Raman", email: "priya.raman@example.com", city: "Austin", state: "TX", postalCode: "78701", line1: "504 W 6th St" },
  { name: "Sofia Marchetti", email: "sofia.marchetti@example.com", city: "Chicago", state: "IL", postalCode: "60607", line1: "1201 W Randolph St" },
  { name: "Daniel Whitfield", email: "daniel.whitfield@example.com", city: "Boston", state: "MA", postalCode: "02116", line1: "77 Boylston St, Unit 4B" },
  { name: "Yuki Tanaka", email: "yuki.tanaka@example.com", city: "Denver", state: "CO", postalCode: "80202", line1: "1550 Wynkoop St" },
  { name: "Nadia Haddad", email: "nadia.haddad@example.com", city: "Brooklyn", state: "NY", postalCode: "11211", line1: "230 Bedford Ave" },
  { name: "Tomás Herrera", email: "tomas.herrera@example.com", city: "San Diego", state: "CA", postalCode: "92101", line1: "645 Front St" },
  { name: "Grace Lindqvist", email: "grace.lindqvist@example.com", city: "Minneapolis", state: "MN", postalCode: "55401", line1: "212 N 2nd St" },
  { name: "Marcus Bell", email: "marcus.bell@example.com", city: "Miami", state: "FL", postalCode: "33130", line1: "900 SW 8th St" },
  { name: "Lena Petrova", email: "lena.petrova@example.com", city: "Philadelphia", state: "PA", postalCode: "19106", line1: "142 Market St" },
  { name: "Noah Bergman", email: "noah.bergman@example.com", city: "Nashville", state: "TN", postalCode: "37203", line1: "1808 Division St" },
] as const;
