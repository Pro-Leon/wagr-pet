/* --- GI Logs (Vomit/Feces) --- */
async function getGiLogs(petId, limit = 50) {
  const { data, error } = await db()
    .from('gi_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addGiLog(log) {
  const { data, error } = await db()
    .from('gi_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateGiLog(logId, updates) {
  const { data, error } = await db()
    .from('gi_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteGiLog(logId) {
  const { error } = await db()
    .from('gi_logs')
    .delete()
    .eq('id', logId);
  if (error) throw error;
}

/* --- Cardiology Logs (Respiratory Rate) --- */
async function getCardioLogs(petId, limit = 50) {
  const { data, error } = await db()
    .from('cardio_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addCardioLog(log) {
  const { data, error } = await db()
    .from('cardio_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateCardioLog(logId, updates) {
  const { data, error } = await db()
    .from('cardio_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteCardioLog(logId) {
  const { error } = await db()
    .from('cardio_logs')
    .delete()
    .eq('id', logId);
  if (error) throw error;
}

/* --- Test Results --- */
async function getTestResults(petId, limit = 50) {
  const { data, error } = await db()
    .from('test_results')
    .select('*')
    .eq('pet_id', petId)
    .order('test_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addTestResult(result) {
  const { data, error } = await db()
    .from('test_results')
    .insert(result)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateTestResult(resultId, updates) {
  const { data, error } = await db()
    .from('test_results')
    .update(updates)
    .eq('id', resultId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTestResult(resultId) {
  const { error } = await db()
    .from('test_results')
    .delete()
    .eq('id', resultId);
  if (error) throw error;
}

/* --- Dermatology Logs --- */
async function getDermaLogs(petId, limit = 50) {
  const { data, error } = await db()
    .from('derma_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addDermaLog(log) {
  const { data, error } = await db()
    .from('derma_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateDermaLog(logId, updates) {
  const { data, error } = await db()
    .from('derma_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteDermaLog(logId) {
  const { error } = await db()
    .from('derma_logs')
    .delete()
    .eq('id', logId);
  if (error) throw error;
}

/* --- Generate Symptom Report for Vet --- */
async function generateSymptomReport(petId, startDate, endDate) {
  const pet = await db().from('pets').select('*').eq('id', petId).single();
  const giLogs = await getGiLogs(petId);
  const cardioLogs = await getCardioLogs(petId);
  const testResults = await getTestResults(petId);
  const dermaLogs = await getDermaLogs(petId);
  let report = `# Symptom Report for ${pet.data.name}\n`;
  report += `**Breed:** ${pet.data.breed || 'Not specified'}\n`;
  report += `**Date Range:** ${startDate} to ${endDate}\n\n`;
  if (giLogs.length > 0) {
    report += `## GI Tracking (Vomit/Feces)\n`;
    giLogs.forEach(log => {
      report += `- **${log.log_type}** - ${log.consistency || ''} ${log.color || ''}\n`;
      report += `  Date: ${new Date(log.recorded_at).toLocaleDateString()}\n`;
      if (log.notes) report += `  Notes: ${log.notes}\n`;
    });
    report += '\n';
  }
  if (cardioLogs.length > 0) {
    report += `## Cardiology (Respiratory Rate)\n`;
    cardioLogs.forEach(log => {
      report += `- **${log.respiratory_rate} breaths/min** - ${log.position || ''} ${log.effort || ''}\n`;
      report += `  Date: ${new Date(log.recorded_at).toLocaleDateString()}\n`;
      if (log.notes) report += `  Notes: ${log.notes}\n`;
    });
    report += '\n';
  }
  if (testResults.length > 0) {
    report += `## Test Results\n`;
    testResults.forEach(r => {
      report += `- **${r.test_name}** - ${r.test_date}\n`;
      if (r.diagnosis) report += `  Diagnosis: ${r.diagnosis}\n`;
      if (r.veterinarian) report += `  Vet: ${r.veterinarian}\n`;
    });
    report += '\n';
  }
  if (dermaLogs.length > 0) {
    report += `## Dermatology (Skin Issues)\n`;
    dermaLogs.forEach(log => {
      report += `- **${log.issue_type}** - ${log.severity} - ${log.location || ''}\n`;
      report += `  Date: ${new Date(log.recorded_at).toLocaleDateString()}\n`;
      if (log.description) report += `  Description: ${log.description}\n`;
    });
    report += '\n';
  }
  return report;
}

/* --- Grooming Appointments --- */
async function getGroomingAppointments(petId, limit = 50) {
  const { data, error } = await db()
    .from('grooming_appointments')
    .select('*')
    .eq('pet_id', petId)
    .order('appointment_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addGroomingAppointment(appointment) {
  const { data, error } = await db()
    .from('grooming_appointments')
    .insert(appointment)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateGroomingAppointment(id, updates) {
  const { data, error } = await db()
    .from('grooming_appointments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteGroomingAppointment(id) {
  const { error } = await db()
    .from('grooming_appointments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/* --- Weight Logs --- */
async function getWeightLogs(petId, limit = 100) {
  const { data, error } = await db()
    .from('weight_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('logged_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addWeightLog(log) {
  const { data, error } = await db()
    .from('weight_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateWeightLog(id, updates) {
  const { data, error } = await db()
    .from('weight_logs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteWeightLog(id) {
  const { error } = await db()
    .from('weight_logs')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
