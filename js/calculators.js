/* ========================================
   Wagr — Free Tier Calculators
   ======================================== */

/* --- Toxicity Database --- */
const TOXICITY_DB = [
  { name: 'Chocolate', severity: 'high', symptoms: 'Vomiting, diarrhea, rapid heart rate, seizures, tremors', action: 'Contact vet immediately. Note the amount and type of chocolate consumed.', keywords: ['chocolate', 'cocoa', 'dark chocolate', 'milk chocolate', 'white chocolate'] },
  { name: 'Grapes / Raisins', severity: 'high', symptoms: 'Kidney failure, vomiting, lethargy, dehydration', action: 'Seek emergency vet care immediately. Even small amounts can be toxic.', keywords: ['grapes', 'raisins', 'sultanas', 'currants'] },
  { name: 'Xylitol', severity: 'critical', symptoms: 'Rapid blood sugar drop, seizures, liver failure', action: 'Emergency vet visit required immediately. Check gum, peanut butter, and sugar-free products.', keywords: ['xylitol', 'birch sugar', 'sugar free', 'sugar-free gum'] },
  { name: 'Onions / Garlic', severity: 'high', symptoms: 'Red blood cell damage, anemia, weakness, pale gums', action: 'Contact your vet. Damage is cumulative — repeated small exposures are dangerous.', keywords: ['onion', 'garlic', 'leek', 'chive', 'shallot', 'scallion'] },
  { name: 'Avocado', severity: 'moderate', symptoms: 'Vomiting, diarrhea, myocardial damage (persin toxin)', action: 'Monitor for symptoms. The pit is a choking hazard. Contact vet if large amount consumed.', keywords: ['avocado', 'guacamole'] },
  { name: 'Macadamia Nuts', severity: 'moderate', symptoms: 'Weakness, vomiting, tremors, hyperthermia', action: 'Contact vet. Symptoms usually appear within 12 hours.', keywords: ['macadamia', 'macadamia nuts'] },
  { name: 'Alcohol', severity: 'critical', symptoms: 'Dangerous drops in blood sugar, blood pressure, body temperature. Respiratory failure.', action: 'Emergency vet immediately. Even small amounts can be lethal.', keywords: ['alcohol', 'beer', 'wine', 'liquor', 'ethanol', 'isopropanol'] },
  { name: 'Caffeine', severity: 'high', symptoms: 'Restlessness, rapid breathing, heart palpitations, tremors', action: 'Contact vet. Avoid coffee, tea, energy drinks, and caffeine pills.', keywords: ['caffeine', 'coffee', 'tea', 'energy drink', 'espresso'] },
  { name: 'Cooked Bones', severity: 'high', symptoms: 'Internal puncturing, choking, intestinal blockage', action: 'Emergency vet if swallowed. Never feed cooked bones of any kind.', keywords: ['cooked bones', 'chicken bones', 'rib bones', 'splinter'] },
  { name: 'Grapes / Raisins', severity: 'high', symptoms: 'Kidney failure, vomiting, lethargy', action: 'Emergency vet care immediately.', keywords: ['grape', 'raisin'] },
  { name: 'Antifreeze', severity: 'critical', symptoms: 'Kidney failure, seizures, death within hours', action: 'Emergency vet immediately. Even small amounts are lethal.', keywords: ['antifreeze', 'ethylene glycol', 'coolant'] },
  { name: 'Ibuprofen / NSAIDs', severity: 'high', symptoms: 'Stomach ulcers, kidney failure, neurological symptoms', action: 'Contact vet immediately. Never give human pain medication.', keywords: ['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'nsaid', 'aspirin'] },
  { name: 'Rodenticide', severity: 'critical', symptoms: 'Internal bleeding, seizures, organ failure', action: 'Emergency vet immediately. Bring the product packaging.', keywords: ['rat poison', 'rodenticide', 'mouse poison', 'd-con'] },
  { name: 'Lily Plants', severity: 'high', symptoms: 'Kidney failure (cats), gastrointestinal distress', action: 'Contact vet. Remove any plant material from mouth.', keywords: ['lily', 'lilies', 'easter lily', 'tiger lily', 'daylily'] },
  { name: 'Daffodil', severity: 'moderate', symptoms: 'Vomiting, diarrhea, abdominal pain, cardiac arrhythmias', action: 'Contact vet. All parts of the plant are toxic, especially the bulbs.', keywords: ['daffodil', 'narcissus', 'jonquil'] },
  { name: 'Sago Palm', severity: 'critical', symptoms: 'Liver failure, vomiting, black tar-like stool, seizures', action: 'Emergency vet immediately. Mortality rate is high without treatment.', keywords: ['sago palm', 'cycad', 'coontie'] },
];

function searchToxicity(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().trim();
  const results = [];
  const seen = new Set();

  TOXICITY_DB.forEach(item => {
    if (seen.has(item.name)) return;
    const match = item.keywords.some(kw => kw.includes(q) || q.includes(kw));
    if (match) {
      results.push(item);
      seen.add(item.name);
    }
  });

  return results;
}

/* --- Calorie Calculator --- */
function calculateCalories(weightKg, lifeStage, activityLevel) {
  // RER (Resting Energy Requirement) = 70 × (body weight in kg)^0.75
  const rer = 70 * Math.pow(weightKg, 0.75);

  // Multipliers based on life stage and activity
  let multiplier = 1.6; // default adult moderate
  if (lifeStage === 'puppy_4') multiplier = 3.0;
  else if (lifeStage === 'puppy_6') multiplier = 2.5;
  else if (lifeStage === 'puppy_12') multiplier = 2.0;
  else if (lifeStage === 'adult_low') multiplier = 1.2;
  else if (lifeStage === 'adult_moderate') multiplier = 1.6;
  else if (lifeStage === 'adult_high') multiplier = 2.0;
  else if (lifeStage === 'senior') multiplier = 1.2;
  else if (lifeStage === 'overweight') multiplier = 1.0;
  else if (lifeStage === 'pregnant') multiplier = 2.0;
  else if (lifeStage === 'lactating') multiplier = 2.5;

  const dailyCalories = Math.round(rer * multiplier);

  // Macro estimates (approximate for typical dog food)
  const proteinG = Math.round(dailyCalories * 0.25 / 4);
  const fatG = Math.round(dailyCalories * 0.15 / 9);
  const carbG = Math.round(dailyCalories * 0.60 / 4);

  // Suggested meal portions (2 meals/day for adults, 3 for puppies)
  const mealsPerDay = lifeStage.startsWith('puppy') ? 3 : 2;
  const perMeal = Math.round(dailyCalories / mealsPerDay);

  return {
    rer: Math.round(rer),
    dailyCalories,
    proteinG,
    fatG,
    carbG,
    mealsPerDay,
    perMeal,
    weightKg,
    lifeStage,
    activityLevel
  };
}

/* --- Life Stage Descriptions --- */
function getLifeStageLabel(value) {
  const labels = {
    'puppy_4': 'Puppy (up to 4 months)',
    'puppy_6': 'Puppy (4-6 months)',
    'puppy_12': 'Puppy (6-12 months)',
    'adult_low': 'Adult — Inactive',
    'adult_moderate': 'Adult — Moderate Activity',
    'adult_high': 'Adult — Very Active',
    'senior': 'Senior (7+ years)',
    'overweight': 'Weight Loss Plan',
    'pregnant': 'Pregnant',
    'lactating': 'Lactating/Nursing'
  };
  return labels[value] || value;
}

/* --- Severity Styling --- */
function severityColor(severity) {
  const colors = {
    critical: '#dc2626',
    high: '#ea580c',
    moderate: '#d97706',
    low: '#65a30d'
  };
  return colors[severity] || '#6b7280';
}

function severityLabel(severity) {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

/* --- LocalStorage Persistence for Calculators --- */
const CalculatorStorage = {
  save(key, data) {
    try {
      localStorage.setItem(`houndos_calc_${key}`, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  },

  load(key) {
    try {
      return JSON.parse(localStorage.getItem(`houndos_calc_${key}`));
    } catch (e) { return null; }
  }
};
