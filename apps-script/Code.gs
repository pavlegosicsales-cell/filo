/**
 * Mala matura NBG — website enquiry backend
 * -----------------------------------------
 * Writes each submission to the bound Google Sheet and sends one branded
 * notification email.
 *
 * The site sends a GET with URL params (Apps Script 302-redirects POSTs and
 * turns them into GETs, which loses e.postData). doPost is kept for a JSON body
 * in case the front end ever changes.
 */

/* ================= CONFIG ================= */

// Razvojno sanduce dok se testira. Posle potvrde se menja na adresu
// profesorki (mirjana.gosic@gmail.com) i objavljuje nova verzija.
var NOTIFY_TO   = 'pavlegosic9@gmail.com';
var SENDER_NAME = 'Mala matura NBG';
var BRAND       = 'Mala matura NBG';
// Tabela sa prijavama, link stoji u podnozju svake poruke. Prazno je sakriva.
var SHEET_URL   = '';
// Ostaviti prazno kada je skript vezan za tabelu. Popuniti ako je samostalan.
var SHEET_ID    = '';

/* ================= PALETTE =================
   Preuzeto iz styles.css sajta.
   `brand` mora da prolazi kontrast kao tekst na beloj podlozi, pa je zelena
   (#497E64, odnos 4.6:1), a ne narandzasta (#E8722C, samo 2.7:1).
   Narandzasta zato radi samo kao linija na vrhu kartice, gde kontrast ne vazi.
   `brandDark` je pozadina glavnog dugmeta, tamnozelena kao na sajtu. */

var C = {
  page:      '#F4F0E5', // krem podloga iza kartice
  card:      '#FFFFFF', // sama kartica
  panel:     '#F6F3EA', // panel sa porukom
  line:      '#E6E1D3', // tanke linije
  brand:     '#497E64', // eyebrow i linija uz panel
  accent:    '#E8722C', // narandzasta linija na vrhu kartice
  brandDark: '#1B3428', // pozadina glavnog dugmeta
  ink:       '#14261D', // naslovi i vrednosti
  body:      '#3C4046', // tekst poruke
  muted:     '#45564B', // oznake i podnozje
  onBrand:   '#FFFFFF'  // tekst na glavnom dugmetu
};

// Zaobljeni uglovi kartice, panela i dugmadi. Outlook na Windowsu ih iseca
// na prave uglove, sto ne smeta jer nista bitno ne zavisi od radijusa.
var RADIUS = '16px'; // kartica
var RPILL  = '8px';  // paneli i dugmad

// Jedno pismo svuda. Veb fontovi se ne ucitavaju u posti.
var SANS = 'Helvetica,Arial,sans-serif';

/* ================= ENTRY POINTS ================= */

function doGet(e) {
  var d = readParams_(e);
  if (!d.ime && !d.email && !d.poruka) {
    return json_({ ok: true, service: BRAND + ' enquiry endpoint' });
  }
  return handle_(d);
}

function doPost(e) {
  var d = readParams_(e);
  if (e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      for (var k in body) if (body[k]) d[k] = body[k];
    } catch (err) { /* nije JSON, parametri su vec procitani */ }
  }
  return handle_(d);
}

function handle_(d) {
  var sheetErr = '';
  // Namerno razdvojeno: neuspeo upis u tabelu ne sme da kosta prijavu.
  try { saveRow_(d); } catch (err) { sheetErr = String(err); }
  try {
    sendEmail_(d);
  } catch (err) {
    return json_({ ok: false, error: String(err), sheetError: sheetErr });
  }
  return json_({ ok: true, sheetError: sheetErr });
}

function readParams_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  return {
    ime:     p.ime     || '',
    telefon: p.telefon || '',
    email:   p.email   || '',
    predmet: p.predmet || '',
    termin:  p.termin  || '',
    cilj:    p.cilj    || '',
    poruka:  p.poruka  || '',
    strana:  p.strana  || ''
  };
}

/* ================= SHEET ================= */

function saveRow_(d) {
  var ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Nema tabele: vezati skript za tabelu ili postaviti SHEET_ID.');
  var sheet = ss.getSheets()[0];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Primljeno', 'Ime roditelja', 'Telefon', 'Email', 'Predmet', 'Termin', 'Ciljana škola', 'Poruka', 'Strana']);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    d.ime || '', d.telefon || '', d.email || '',
    d.predmet || '', d.termin || '', d.cilj || '',
    d.poruka || '', d.strana || ''
  ]);
}

/* ================= EMAIL ================= */

function sendEmail_(d) {
  MailApp.sendEmail(NOTIFY_TO, buildSubject_(d), buildPlain_(d), {
    name: SENDER_NAME,
    htmlBody: buildHtml_(d),
    replyTo: d.email || undefined   // odgovor ide pravo roditelju
  });
}

function buildSubject_(d) {
  var who  = d.ime || 'Nova prijava';
  var tail = d.predmet ? ' (' + d.predmet + ')' : '';
  return BRAND + ' prijava: ' + who + tail;
}

function buildPlain_(d) {
  return [
    'NOVA PRIJAVA SA SAJTA ' + BRAND.toUpperCase(),
    '',
    'Roditelj:  ' + (d.ime || ''),
    'Telefon:   ' + (d.telefon || ''),
    'Email:     ' + (d.email || ''),
    'Predmet:   ' + (d.predmet || ''),
    'Termin:    ' + (d.termin || ''),
    'Škola:     ' + (d.cilj || ''),
    '',
    'PORUKA',
    (d.poruka || '(nije napisana)'),
    '',
    'Poslato sa sajta ' + BRAND + (d.strana ? ' (' + d.strana + ')' : '') + '.'
  ].join('\n');
}

/**
 * Pravila su namerna, vidi reference/gotchas.md:
 *  - samo tabele i inline stilovi, bez flex/grid, bez veb fontova i slika
 *  - !important na svakoj boji i bgcolor na svakom bloku (tamni rezim Gmaila
 *    i Outlook.com ne smeju da prefarbaju poruku)
 *  - color-scheme meta sprecava Apple Mail da invertuje
 *  - nista bitno ne zavisi od border-radius (Outlook ga bezbolno iseca)
 *  - dugmad su tabelarne celije sa ispunom, ne stilizovani linkovi
 */
function buildHtml_(d) {
  var ime = d.ime || 'Roditelj';

  // Dugme se pojavljuje samo kada je vrednost stvarno upotrebljiva.
  var cifre    = String(d.telefon || '').replace(/[^\d+]/g, '');
  var zovljiv  = cifre.replace(/\D/g, '').length >= 6;
  var tel      = 'tel:' + cifre;
  var mejljiv  = /.+@.+\..+/.test(String(d.email || ''));

  var rows = [
    ['Roditelj', d.ime],
    ['Telefon',  d.telefon, zovljiv ? tel : ''],
    ['Email',    d.email,   mejljiv ? 'mailto:' + esc_(d.email) : ''],
    ['Predmet',  d.predmet],
    ['Termin',   d.termin],
    ['Škola',    d.cilj]
  ].filter(function (r) { return r[1]; }).map(function (r, i, all) {
    var border = (i === all.length - 1) ? '' : 'border-bottom:1px solid ' + C.line + ';';
    var value = r[2]
      ? '<a href="' + r[2] + '" style="color:' + C.ink + ' !important;text-decoration:none;' +
        'border-bottom:1px solid ' + C.line + ';">' + esc_(r[1]) + '</a>'
      : esc_(r[1]);
    return '<tr>' +
      '<td bgcolor="' + C.card + '" width="120" style="background-color:' + C.card + ' !important;' + border +
        'padding:15px 16px 15px 0;color:' + C.muted + ' !important;font:700 11px/1.35 ' + SANS + ';' +
        'letter-spacing:.13em;text-transform:uppercase;vertical-align:top;">' + r[0] + '</td>' +
      '<td bgcolor="' + C.card + '" style="background-color:' + C.card + ' !important;' + border +
        'padding:13px 0;color:' + C.ink + ' !important;font:400 17px/1.45 ' + SANS + ';">' + value + '</td>' +
    '</tr>';
  }).join('');

  var panel =
    '<tr><td bgcolor="' + C.panel + '" style="background-color:' + C.panel + ' !important;' +
      'border-left:3px solid ' + C.brand + ';border-radius:' + RPILL + ';padding:20px 22px;">' +
      '<div style="color:' + C.muted + ' !important;font:700 11px/1.2 ' + SANS + ';letter-spacing:.13em;' +
        'text-transform:uppercase;padding-bottom:10px;">Poruka</div>' +
      '<div style="color:' + C.body + ' !important;font:400 16px/1.65 ' + SANS + ';white-space:pre-wrap;">' +
        esc_(d.poruka || 'Poruka nije napisana.') + '</div>' +
    '</td></tr>';

  var solid = function (href, label) {
    return '<td bgcolor="' + C.brandDark + '" style="background-color:' + C.brandDark + ' !important;' +
      'border-radius:' + RPILL + ';padding:15px 30px;">' +
      '<a href="' + href + '" style="color:' + C.onBrand + ' !important;text-decoration:none;' +
      'font:700 13px/1 ' + SANS + ';letter-spacing:.1em;text-transform:uppercase;">' + label + '</a></td>';
  };
  var ghost = function (href, label) {
    return '<td bgcolor="' + C.card + '" style="background-color:' + C.card + ' !important;' +
      'border:1px solid ' + C.line + ';border-radius:' + RPILL + ';padding:14px 28px;">' +
      '<a href="' + href + '" style="color:' + C.ink + ' !important;text-decoration:none;' +
      'font:700 13px/1 ' + SANS + ';letter-spacing:.1em;text-transform:uppercase;">' + label + '</a></td>';
  };
  var mailHref = 'mailto:' + esc_(d.email) + '?subject=' +
    encodeURIComponent('Odgovor na vasu prijavu, ' + BRAND);

  var buttons = '';
  if (zovljiv && mejljiv) {
    buttons = solid(tel, 'Pozovi roditelja') +
      '<td width="10" style="width:10px;">&nbsp;</td>' + ghost(mailHref, 'Odgovori mejlom');
  } else if (zovljiv) {
    buttons = solid(tel, 'Pozovi roditelja');
  } else if (mejljiv) {
    buttons = solid(mailHref, 'Odgovori mejlom');
  }

  // Nema upotrebljivog kontakta: red se izbacuje umesto praznog pojasa.
  var actions = buttons
    ? '<tr><td class="pad" bgcolor="' + C.card + '" style="background-color:' + C.card + ' !important;padding:28px 40px 38px;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' + buttons + '</tr></table>' +
      '</td></tr>'
    : '<tr><td bgcolor="' + C.card + '" style="background-color:' + C.card + ' !important;height:34px;font-size:0;line-height:0;">&nbsp;</td></tr>';

  return '' +
'<!DOCTYPE html><html><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<meta name="color-scheme" content="light dark">' +
'<meta name="supported-color-schemes" content="light dark">' +
'<style>:root{color-scheme:light dark;supported-color-schemes:light dark;}' +
'@media (max-width:600px){.pad{padding-left:24px !important;padding-right:24px !important;}' +
'.hd{font-size:26px !important;}}</style></head>' +
'<body style="margin:0;padding:0;background-color:' + C.page + ' !important;" bgcolor="' + C.page + '">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
  'bgcolor="' + C.page + '" style="background-color:' + C.page + ' !important;">' +
'<tr><td align="center" style="padding:32px 12px 44px;">' +

  '<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="width:100%;max-width:600px;">' +

  '<tr><td style="padding:0;">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'bgcolor="' + C.card + '" style="background-color:' + C.card + ' !important;' +
    'border:1px solid ' + C.line + ';border-radius:' + RADIUS + ';">' +

    '<tr><td class="pad" bgcolor="' + C.card + '" style="background-color:' + C.card + ' !important;' +
      'border-top:4px solid ' + C.accent + ';border-radius:' + RADIUS + ' ' + RADIUS + ' 0 0;padding:34px 40px 28px;">' +
      '<div style="color:' + C.brand + ' !important;font:700 11px/1.2 ' + SANS + ';letter-spacing:.2em;' +
        'text-transform:uppercase;">' + esc_(BRAND) + '</div>' +
      '<div class="hd" style="color:' + C.ink + ' !important;font:700 32px/1.15 ' + SANS + ';' +
        'letter-spacing:-.01em;padding-top:14px;">Nova prijava</div>' +
      '<div style="color:' + C.muted + ' !important;font:400 15px/1.5 ' + SANS + ';padding-top:10px;">' +
        esc_(ime) + (d.predmet ? ' &middot; ' + esc_(d.predmet) : '') + '</div>' +
    '</td></tr>' +

    (rows ? '<tr><td class="pad" bgcolor="' + C.card + '" style="background-color:' + C.card + ' !important;padding:0 40px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
        'bgcolor="' + C.card + '" style="background-color:' + C.card + ' !important;' +
        'border-top:1px solid ' + C.line + ';">' + rows + '</table>' +
    '</td></tr>' : '') +

    '<tr><td class="pad" bgcolor="' + C.card + '" style="background-color:' + C.card + ' !important;padding:26px 40px 0;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + panel + '</table>' +
    '</td></tr>' +

    actions +

  '</table></td></tr>' +

    '<tr><td class="pad" bgcolor="' + C.page + '" style="background-color:' + C.page + ' !important;padding:20px 40px 0;">' +
      '<div style="color:' + C.muted + ' !important;font:700 11px/1.7 ' + SANS + ';letter-spacing:.12em;' +
        'text-transform:uppercase;">Prijava sa sajta' +
        (d.strana ? ' &nbsp;&middot;&nbsp; ' + esc_(d.strana) : '') + '</div>' +
      (SHEET_URL ? '<div style="padding-top:8px;"><a href="' + SHEET_URL + '" ' +
        'style="color:' + C.muted + ' !important;font:400 12px/1.7 ' + SANS + ';' +
        'text-decoration:underline;">Otvori tabelu sa svim prijavama</a></div>' : '') +
    '</td></tr>' +

  '</table>' +
  '<!--[if mso]></td></tr></table><![endif]-->' +
'</td></tr></table></body></html>';
}

/* ================= HELPERS ================= */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
