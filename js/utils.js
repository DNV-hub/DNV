// ==================== UTILIDADES COMPARTIDAS ====================
function csvEscape(val) {
  val = (val === undefined || val === null) ? '' : String(val);
  if (/[",\n;]/.test(val)) {
    return '"' + val.replace(/"/g,'""') + '"';
  }
  return val;
}
function csvRow(arr) {
  return arr.map(csvEscape).join(',');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}
