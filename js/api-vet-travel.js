/* --- Vet Records --- */
async function getVetRecords(petId) {
  const { data, error } = await db()
    .from('vet_records')
    .select('*')
    .eq('pet_id', petId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function addVetRecord(record) {
  const { data, error } = await db()
    .from('vet_records')
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteVetRecord(id) {
  const { error } = await db()
    .from('vet_records')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/* --- Vet Upload Links --- */
async function createVetLink(petId, vetName, clinicName, duration, durationUnit) {
  const token = await getAccessToken();
  const res = await fetch(API_BASE + '/vet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ action: 'create', petId, vetName, clinicName, duration, durationUnit }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create vet link');
  return data.link;
}

async function listVetLinks(petId) {
  const token = await getAccessToken();
  const res = await fetch(API_BASE + '/vet?action=list&petId=' + encodeURIComponent(petId), {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load vet links');
  return data.links || [];
}

async function revokeVetLink(linkId) {
  const token = await getAccessToken();
  const res = await fetch(API_BASE + '/vet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ action: 'revoke', linkId }),
  });
  if (!res.ok) throw new Error('Failed to revoke vet link');
}

async function uploadVaccinationViaVetLink(vetToken, vaccineName, dateGiven, nextDueDate, notes) {
  const res = await fetch(API_BASE + '/vet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'vaccination', token: vetToken, vaccine_name: vaccineName, date_given: dateGiven, next_due_date: nextDueDate, notes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upload vaccination');
  return data;
}

async function uploadRecordViaVetLink(vetToken, fileName, fileUrl, recordType, notes) {
  const res = await fetch(API_BASE + '/vet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'record', token: vetToken, file_name: fileName, file_url: fileUrl, record_type: recordType, notes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upload record');
  return data;
}

/* --- Vaccinations --- */
async function getVaccinations(petId) {
  const { data, error } = await db()
    .from('vaccinations')
    .select('*')
    .eq('pet_id', petId)
    .order('date_given', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function addVaccination(record) {
  const { data, error } = await db()
    .from('vaccinations')
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateVaccination(id, updates) {
  const { data, error } = await db()
    .from('vaccinations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteVaccination(id) {
  const { error } = await db()
    .from('vaccinations')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/* --- Travel Documents --- */
async function getTravelDocuments(petId) {
  const { data, error } = await db()
    .from('travel_documents')
    .select('*')
    .eq('pet_id', petId)
    .order('generated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function saveTravelDocument(doc) {
  const { data, error } = await db()
    .from('travel_documents')
    .insert(doc)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTravelDocument(id) {
  const { error } = await db()
    .from('travel_documents')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/* --- Pet Travel Profile --- */
async function updatePetTravelProfile(petId, updates) {
  const { data, error } = await db()
    .from('pets')
    .update(updates)
    .eq('id', petId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
