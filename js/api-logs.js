/* --- Logs --- */
async function getLogs(petId, limit = 50, lookbackDays = null) {
  let query = db()
    .from('pet_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (lookbackDays) {
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', since);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function addLog(log) {
  const { data, error } = await db()
    .from('pet_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteLog(logId) {
  const { error } = await db()
    .from('pet_logs')
    .delete()
    .eq('id', logId);
  if (error) throw error;
}

/* --- Food Logs --- */
async function getFoodLogs(petId, limit = 50) {
  const { data, error } = await db()
    .from('food_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('fed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addFoodLog(foodLog) {
  const { data, error } = await db()
    .from('food_logs')
    .insert(foodLog)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateFoodLog(foodLogId, updates) {
  const { data, error } = await db()
    .from('food_logs')
    .update(updates)
    .eq('id', foodLogId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteFoodLog(foodLogId) {
  const { error } = await db()
    .from('food_logs')
    .delete()
    .eq('id', foodLogId);
  if (error) throw error;
}

/* --- Nutritional Analysis --- */
async function analyzeNutrition(foodData) {
  const { food_type, portion_size, portion_unit, ingredients, brand_name, product_name } = foodData;
  const nutritionalProfiles = {
    commercial: { protein: 25, fat: 15, fiber: 4, carbs: 50, moisture: 6 },
    homemade: { protein: 18, fat: 12, fiber: 2, carbs: 65, moisture: 3 },
    raw: { protein: 35, fat: 25, fiber: 2, carbs: 30, moisture: 8 },
    treat: { protein: 20, fat: 10, fiber: 3, carbs: 62, moisture: 5 },
    supplement: { protein: 30, fat: 5, fiber: 1, carbs: 55, moisture: 9 }
  };
  const profile = nutritionalProfiles[food_type] || nutritionalProfiles.commercial;
  const caloriesPerCup = food_type === 'commercial' ? 350 : food_type === 'raw' ? 400 : 300;
  let adjustedProfile = { ...profile };
  if (ingredients) {
    if (ingredients.toLowerCase().includes('chicken') || ingredients.toLowerCase().includes('beef')) {
      adjustedProfile.protein += 5; adjustedProfile.fat += 3;
    }
    if (ingredients.toLowerCase().includes('rice') || ingredients.toLowerCase().includes('potato')) {
      adjustedProfile.carbs += 5; adjustedProfile.protein -= 2;
    }
    if (ingredients.toLowerCase().includes('vegetable') || ingredients.toLowerCase().includes('carrot')) {
      adjustedProfile.fiber += 2; adjustedProfile.carbs -= 2;
    }
  }
  const total = adjustedProfile.protein + adjustedProfile.fat + adjustedProfile.fiber + adjustedProfile.carbs + adjustedProfile.moisture;
  adjustedProfile.protein = Math.round((adjustedProfile.protein / total) * 100);
  adjustedProfile.fat = Math.round((adjustedProfile.fat / total) * 100);
  adjustedProfile.fiber = Math.round((adjustedProfile.fiber / total) * 100);
  adjustedProfile.carbs = Math.round((adjustedProfile.carbs / total) * 100);
  adjustedProfile.moisture = Math.round((adjustedProfile.moisture / total) * 100);
  return { ...foodData, caloriesPerCup, protein_percentage: adjustedProfile.protein, fat_percentage: adjustedProfile.fat, fiber_percentage: adjustedProfile.fiber, carbs_percentage: adjustedProfile.carbs, moisture_percentage: adjustedProfile.moisture, nutritional_analyzed: true, analysis_source: 'calculated' };
}

async function barcodeLookup(barcode) {
  const mockDatabase = {
    '123456789012': { brand_name: 'Premium Pet Co', product_name: 'Healthy Kibble Chicken & Rice', food_type: 'commercial', calories_per_cup: 350, protein_percentage: 25, fat_percentage: 15, fiber_percentage: 4, carbs_percentage: 50, moisture_percentage: 6 },
    '234567890123': { brand_name: 'Natural Pets', product_name: 'Organic Beef Recipe', food_type: 'commercial', calories_per_cup: 380, protein_percentage: 28, fat_percentage: 18, fiber_percentage: 3, carbs_percentage: 45, moisture_percentage: 6 }
  };
  return mockDatabase[barcode] || null;
}
