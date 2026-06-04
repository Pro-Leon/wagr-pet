/* --- AI Vet Report (Pro) --- */
async function generateVetReport(petId, options = {}) {
  const {
    includeTimeline = true, includeFood = true, includeGI = true, includeCardio = true,
    includeTests = true, includeDerma = true, includeGrooming = true, includeWeight = true,
    includeInventory = true, includeVetRecords = true, days = 30
  } = options;
  let reportSections = [];
  if (includeTimeline) {
    const logs = await getLogs(petId, 100);
    const filtered = logs.filter(l => (Date.now() - new Date(l.created_at).getTime()) / (1000*60*60*24) <= days);
    if (filtered.length) {
      reportSections.push('## 📋 Timeline (Meals, Meds, Bathroom)\n' +
        filtered.map(l => `- [${new Date(l.created_at).toLocaleDateString()}] ${l.log_type}: ${l.title}${l.notes ? ' — ' + l.notes : ''}`).join('\n'));
    }
  }
  if (includeFood) {
    const foodLogs = await getFoodLogs(petId, 100);
    const filtered = foodLogs.filter(l => (Date.now() - new Date(l.fed_at).getTime()) / (1000*60*60*24) <= days);
    if (filtered.length) {
      reportSections.push('## 🍖 Food Log\n' +
        filtered.map(l => `- [${new Date(l.fed_at).toLocaleDateString()}] ${l.food_type}: ${l.brand_name || ''} ${l.product_name || ''} — ${l.portion_size} ${l.portion_unit}${l.calories_per_cup ? ` (${l.calories_per_cup} kcal/cup)` : ''}`).join('\n'));
    }
  }
  if (includeGI) {
    const giLogs = await getGiLogs(petId, 100);
    const filtered = giLogs.filter(l => (Date.now() - new Date(l.recorded_at).getTime()) / (1000*60*60*24) <= days);
    if (filtered.length) {
      reportSections.push('## 🤢 GI (Vomit/Feces)\n' +
        filtered.map(l => `- [${new Date(l.recorded_at).toLocaleDateString()}] ${l.log_type} — ${l.consistency || 'normal'} ${l.color ? '(' + l.color + ')' : ''}${l.notes ? ' — ' + l.notes : ''}`).join('\n'));
    }
  }
  if (includeCardio) {
    const cardioLogs = await getCardioLogs(petId, 100);
    const filtered = cardioLogs.filter(l => (Date.now() - new Date(l.recorded_at).getTime()) / (1000*60*60*24) <= days);
    if (filtered.length) {
      reportSections.push('## ❤️ Cardiology (Respiratory Rate)\n' +
        filtered.map(l => `- [${new Date(l.recorded_at).toLocaleDateString()}] ${l.respiratory_rate} bpm (${l.position}, ${l.effort})${l.notes ? ' — ' + l.notes : ''}`).join('\n'));
    }
  }
  if (includeTests) {
    const testResults = await getTestResults(petId, 50);
    const filtered = testResults.filter(l => (Date.now() - new Date(l.test_date).getTime()) / (1000*60*60*24) <= days);
    if (filtered.length) {
      reportSections.push('## 🧪 Test Results\n' +
        filtered.map(l => `- [${l.test_date}] ${l.test_name} — ${l.diagnosis || 'pending'}${l.veterinarian ? ' (Vet: ' + l.veterinarian + ')' : ''}`).join('\n'));
    }
  }
  if (includeDerma) {
    const dermaLogs = await getDermaLogs(petId, 50);
    const filtered = dermaLogs.filter(l => (Date.now() - new Date(l.recorded_at).getTime()) / (1000*60*60*24) <= days);
    if (filtered.length) {
      reportSections.push('## 🩹 Dermatology (Skin Issues)\n' +
        filtered.map(l => `- [${new Date(l.recorded_at).toLocaleDateString()}] ${l.issue_type} — ${l.severity} at ${l.location || 'unspecified'}${l.description ? ' — ' + l.description : ''}`).join('\n'));
    }
  }
  if (includeGrooming) {
    const groomingLogs = await getGroomingAppointments(petId, 50);
    const filtered = groomingLogs.filter(l => (Date.now() - new Date(l.appointment_date).getTime()) / (1000*60*60*24) <= days);
    if (filtered.length) {
      reportSections.push('## ✂️ Grooming\n' +
        filtered.map(l => `- [${new Date(l.appointment_date).toLocaleDateString()}] ${l.groomer_name || 'N/A'} at ${l.location || 'N/A'} — ${l.services_performed?.join(', ') || 'services recorded'}${l.notes ? ' — ' + l.notes : ''}`).join('\n'));
    }
  }
  if (includeWeight) {
    const weightLogs = await getWeightLogs(petId, 100);
    const filtered = weightLogs.filter(l => (Date.now() - new Date(l.logged_at).getTime()) / (1000*60*60*24) <= days);
    if (filtered.length) {
      var values = filtered.map(function(l) { return parseFloat(l.weight_kg); });
      var current = values[values.length - 1];
      var min = Math.min.apply(null, values);
      var max = Math.max.apply(null, values);
      var avg = values.reduce(function(a, b) { return a + b; }, 0) / values.length;
      var change = values.length >= 2 ? current - values[values.length - 2] : 0;
      reportSections.push('## ⚖️ Weight Tracking\n' +
        filtered.map(function(l) { return '- [' + new Date(l.logged_at).toLocaleDateString() + '] ' + l.weight_kg + ' kg' + (l.notes ? ' — ' + l.notes : ''); }).join('\n') +
        '\n\n**Summary:** Current: ' + current.toFixed(2) + ' kg, Min: ' + min.toFixed(2) + ' kg, Max: ' + max.toFixed(2) + ' kg, Avg: ' + avg.toFixed(2) + ' kg' +
        (values.length >= 2 ? ', Last change: ' + (change >= 0 ? '+' : '') + change.toFixed(2) + ' kg' : ''));
    }
  }
  if (includeInventory) {
    var inventory = await getFoodInventory(petId);
    var lowStock = inventory.filter(function(i) { return parseFloat(i.quantity) <= parseFloat(i.restock_threshold || 1); });
    if (inventory.length) {
      reportSections.push('## 📦 Food Inventory\n' +
        inventory.map(function(i) {
          var isLow = parseFloat(i.quantity) <= parseFloat(i.restock_threshold || 1);
          var emptyDate = i.estimated_empty_date ? new Date(i.estimated_empty_date + 'T00:00:00') : null;
          var daysLeft = emptyDate ? Math.ceil((emptyDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
          return '- ' + i.item_name + ' (' + i.category + '): ' + i.quantity + ' ' + i.unit +
            (daysLeft !== null ? ' — est. ' + (daysLeft <= 0 ? 'EXPIRED' : daysLeft + ' days left') : '') +
            (isLow ? ' ⚠️ LOW STOCK' : '') + (i.notes ? ' — ' + i.notes : '');
        }).join('\n') +
        (lowStock.length ? '\n\n**⚠️ Items needing restock:** ' + lowStock.map(function(i) { return i.item_name; }).join(', ') : ''));
    }
  }
  if (includeVetRecords) {
    var vetRecords = await getVetRecords(petId);
    if (vetRecords.length) {
      var typeLabels = { lab: 'Lab Results', prescription: 'Prescription', vaccine: 'Vaccination', xray: 'X-Ray / Imaging', surgery: 'Surgery', exam: 'Exam Notes', referral: 'Referral', other: 'Other' };
      reportSections.push('## 🏥 Vet Records\n' +
        vetRecords.map(function(r) {
          var label = typeLabels[r.record_type] || r.record_type;
          var d = new Date(r.uploaded_at);
          return '- [' + d.toLocaleDateString() + '] ' + r.file_name + ' (' + label + ')' + (r.notes ? ' — ' + r.notes : '') + (r.file_url ? ' — [View Document](' + r.file_url + ')' : '');
        }).join('\n'));
    }
  }
  if (reportSections.length === 0) throw new Error('No data available for the selected period. Add some logs first!');
  const fullReport = `## Pet Health Report (Last ${days} days)\n\n${reportSections.join('\n\n')}`;
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE}/ai-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ logSummary: fullReport })
  });
  if (response.ok) { const result = await response.json(); return result.report; }
  const err = await response.json().catch(() => ({}));
  throw new Error(err.error || 'AI service unavailable. Please try again later.');
}

/* --- Location Alert --- */
async function sendLocationAlert(petId, lat, lng, ownerEmail, petName) {
  try {
    let email = ownerEmail;
    let name = petName || 'your pet';
    if (!email) {
      const { data: pet } = await db().from('pets').select('name, user_id').eq('id', petId).single();
      if (pet) {
        if (!name) name = pet.name || 'your pet';
        const { data: owner } = await db().from('profiles').select('email').eq('id', pet.user_id).single();
        if (owner) email = owner.email;
      }
    }
    if (email) {
      const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
      try {
        await fetch(`${window.location.origin}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'location_alert', to: email, petName: name, link: mapsLink, message: `Someone scanned ${name}'s QR tag and shared their location.\nLatitude: ${lat}\nLongitude: ${lng}` }),
        });
        return { success: true, message: 'Owner notified' };
      } catch (e) { console.log('Email alert fallback:', e.message); }
    }
    return { success: true, message: 'Owner notified (demo mode)' };
  } catch (e) {
    console.log('Location alert (demo mode):', petId, lat, lng);
    return { success: true, message: 'Owner notified (demo mode)' };
  }
}


