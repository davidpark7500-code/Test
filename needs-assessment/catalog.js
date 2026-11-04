// Editable configuration for the Customer Needs Assessment.
// Change categories, prompts, frustrations, and product lines here — no other code changes needed.
// Product lines are a starting point only: verify names and availability against your market's current catalog.

window.CATALOG = {
  // Client priorities. They pick their top 2, in order.
  values: [
    { id: "price", label: "Saving money" },
    { id: "convenience", label: "Convenience / delivered to the door" },
    { id: "eco", label: "Eco-friendly / less plastic" },
    { id: "performance", label: "Works better" },
    { id: "ingredients", label: "Gentler ingredients" },
  ],

  sensitivities: [
    "Prefers fragrance-free",
    "Describes skin as sensitive",
    "Allergy-conscious household",
    "Prefers plant-based / vegetarian",
    "Avoids certain ingredients (see notes)",
  ],

  categories: [
    {
      id: "home",
      name: "Home cleaning",
      icon: "🧽",
      prompts: [
        "What do you use on kitchen counters and bathrooms?",
        "Anything separate for glass, floors, or tough grease?",
        "Where do you usually buy it, and how often?",
      ],
      frustrations: [
        { id: "too-many", label: "Too many different bottles", values: ["convenience", "eco"] },
        { id: "smell", label: "Harsh smell / fumes", values: ["ingredients"] },
        { id: "cost", label: "Costs add up", values: ["price"] },
        { id: "weak", label: "Doesn't clean well enough", values: ["performance"] },
        { id: "plastic", label: "Lots of plastic waste", values: ["eco"] },
        { id: "runout", label: "Always running out", values: ["convenience"] },
      ],
      lines: ["Amway Home™ L.O.C.™ cleaners"],
      talkingPoint: "Concentrates: bring a cost-per-use comparison against what they pay now.",
    },
    {
      id: "laundry",
      name: "Laundry",
      icon: "🧺",
      prompts: [
        "What detergent and softener do you use?",
        "How many loads a week, roughly?",
        "Any problems with stains, odors, or skin irritation from clothes?",
      ],
      frustrations: [
        { id: "stains", label: "Stains don't come out", values: ["performance"] },
        { id: "cost", label: "Expensive per load", values: ["price"] },
        { id: "scent", label: "Scent too strong", values: ["ingredients"] },
        { id: "bulky", label: "Heavy / bulky jugs", values: ["convenience", "eco"] },
        { id: "runout", label: "Always running out", values: ["convenience"] },
      ],
      lines: ["Amway Home™ SA8™ laundry"],
      talkingPoint: "Compare cost per load using their loads per week.",
    },
    {
      id: "dish",
      name: "Dishes",
      icon: "🍽️",
      prompts: [
        "Dishwasher, hand-washing, or both? What do you use?",
        "Happy with how the dishes come out?",
      ],
      frustrations: [
        { id: "spots", label: "Spots / residue", values: ["performance"] },
        { id: "hands", label: "Dries out hands", values: ["ingredients"] },
        { id: "cost", label: "Costs add up", values: ["price"] },
        { id: "runout", label: "Always running out", values: ["convenience"] },
      ],
      lines: ["Amway Home™ Dish Drops™"],
      talkingPoint: "Concentrated dish care: show how long one bottle lasts.",
    },
    {
      id: "personal",
      name: "Personal care (body, hair, oral)",
      icon: "🧴",
      prompts: [
        "What shampoo, body wash, deodorant, and toothpaste does the household use?",
        "Does everyone use the same thing, or does each person have their own?",
      ],
      frustrations: [
        { id: "dry", label: "Leaves hair or skin feeling dry", values: ["performance", "ingredients"] },
        { id: "ingredients", label: "Unsure what's in it", values: ["ingredients"] },
        { id: "cost", label: "Costs add up across the family", values: ["price"] },
        { id: "clutter", label: "Shower clutter / too many products", values: ["convenience"] },
        { id: "runout", label: "Always running out", values: ["convenience"] },
      ],
      lines: ["G&H™ body care", "Satinique™ hair care", "Glister™ oral care"],
      talkingPoint: "Focus on the one product they complained about, not the whole bathroom.",
    },
    {
      id: "skin",
      name: "Skin care & beauty",
      icon: "✨",
      prompts: [
        "What's your daily routine — cleanser, moisturizer, sunscreen, makeup?",
        "What do you like about it? What would you change?",
      ],
      frustrations: [
        { id: "results", label: "Not seeing the results they want", values: ["performance"] },
        { id: "cost", label: "Too expensive", values: ["price"] },
        { id: "complicated", label: "Routine is too complicated", values: ["convenience"] },
        { id: "ingredients", label: "Unsure about ingredients", values: ["ingredients"] },
      ],
      lines: ["Artistry™ skin care"],
      talkingPoint: "Match their routine length. If they want simple, recommend 2–3 steps, not a full system.",
      caution: "Talk about routine and preferences only. Do not promise to treat skin conditions.",
    },
    {
      id: "nutrition",
      name: "Nutrition & wellness",
      icon: "🥗",
      prompts: [
        "Do you take any vitamins or supplements now? Which ones?",
        "What do you like or dislike about them: taste, pill size, cost, remembering to take them?",
        "Where do you buy them?",
      ],
      frustrations: [
        { id: "swallow", label: "Pills hard to swallow", values: ["convenience"] },
        { id: "forget", label: "Forgets to take them", values: ["convenience"] },
        { id: "cost", label: "Costs add up", values: ["price"] },
        { id: "quality", label: "Unsure about quality or sourcing", values: ["ingredients", "performance"] },
        { id: "toomany", label: "Too many bottles", values: ["convenience"] },
      ],
      lines: ["Nutrilite™"],
      talkingPoint: "Talk about sourcing, quality, and convenience. Never claim a product treats or prevents a condition.",
      caution: "Ask about preferences, not health conditions. Don't record diagnoses or medications. Health questions go to their doctor.",
    },
    {
      id: "water",
      name: "Water & air",
      icon: "💧",
      prompts: [
        "What do you drink at home: tap, bottled, pitcher filter?",
        "How many cases of bottled water a month, if any?",
        "Do you use an air purifier?",
      ],
      frustrations: [
        { id: "taste", label: "Doesn't like the tap water taste", values: ["performance"] },
        { id: "bottles", label: "Buying / hauling bottled water", values: ["convenience", "eco", "price"] },
        { id: "filters", label: "Pitcher filters are a hassle", values: ["convenience"] },
        { id: "air", label: "Concerned about indoor air (dust, pets, cooking)", values: ["performance"] },
      ],
      lines: ["eSpring™ water treatment", "Atmosphere™ air treatment"],
      talkingPoint: "Big-ticket item: show total annual bottled-water spend vs. system cost. No pressure.",
    },
    {
      id: "kitchen",
      name: "Kitchen & cookware",
      icon: "🍳",
      prompts: [
        "How often do you cook at home?",
        "What cookware do you use? How old is it?",
      ],
      frustrations: [
        { id: "worn", label: "Cookware worn / coating peeling", values: ["performance"] },
        { id: "time", label: "Cooking takes too long", values: ["convenience"] },
        { id: "healthier", label: "Wants to cook with less oil", values: ["ingredients"] },
      ],
      lines: ["iCook™ cookware"],
      talkingPoint: "Only raise this if they're already replacing cookware.",
    },
  ],
};
