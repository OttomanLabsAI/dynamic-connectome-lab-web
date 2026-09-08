'use strict';
// Publications, Resources, Join us, Contact, 404 — content verbatim from the captured Google Site.
const fs = require('fs');
const path = require('path');
const { esc, socialList } = require('./layout');

// ── Publications ────────────────────────────────────────────────────────
const SECTION_META = {
  'PEER-REVIEWED JOURNALS': { key: 'journals', label: 'Journal articles' },
  'CONFERENCE PROCEEDINGS': { key: 'conference', label: 'Conference papers' },
  'BOOK CHAPTERS': { key: 'chapters', label: 'Book chapters' },
  'OTHER PUBLICATIONS': { key: 'other', label: 'Other' },
  'PRESS COVERAGE': { key: 'press', label: 'Press' },
};

function parsePublications(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const [tag, text, linkStr] = line.split(/ \|\|\| ?/).map(s => (s || '').trim());
    const links = linkStr ? linkStr.split(';').map(s => { const i = s.indexOf('|'); return { label: s.slice(0, i), href: s.slice(i + 1) }; }).filter(l => l.href) : [];
    if (tag === 'H2') { cur = { name: text, ...SECTION_META[text], entries: [] }; sections.push(cur); continue; }
    if (tag !== 'P' || !cur) continue;
    // A paragraph may hold two numbered entries (103 + 102 on the source page): split them.
    const parts = text.split(/\s(?=\d{1,3}\) )/);
    if (!/^\d{1,3}\) /.test(text)) {
      // orphan link paragraph (e.g. entry 64's PDF, entry 6's PDF/BibTeX) — attach to the previous entry
      if (cur.entries.length) { const prev = cur.entries[cur.entries.length - 1]; prev.links.push(...links); prev.text += ' ' + text; }
      continue;
    }
    parts.forEach((part, idx) => {
      const m = part.match(/^(\d{1,3})\)\s*(.*)$/);
      const entry = { n: +m[1], text: m[2].trim(), links: [] };
      if (parts.length === 1) entry.links = links;
      else {
        // assign links by which half their label appears in (both halves say [PDF]); keep order
        entry.links = links.filter((l, li) => li === idx);
      }
      cur.entries.push(entry);
    });
  }
  return sections;
}

const yearOf = t => { if (/\bin press\b/i.test(t)) return 'In press'; const m = t.match(/\b(20[0-3]\d|19\d\d)\b/g); return m ? +m[m.length - 1] : null; };

function cleanCitation(text) {
  // Drop the bracketed link labels that are now buttons; keep everything else verbatim.
  return text
    .replace(/\[(Article \(PDF\)|Article|Abstract|BibTeX|Supplementary Information(?: \(PDF\)| \(Data Sets\))?|PDF|Press release|Test \(PDF\))\]\.?/g, '')
    .replace(/\s+https?:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim();
}
function emphasiseTitle(text) {
  // Author list, then title, then venue. Bold the title for the two shapes on the source page:
  //   "Authors (YEAR). Title. Venue…"   and   "Surname AB, Surname C. Title. Venue, YEAR."
  let m = text.match(/^(.*?\(\d{4}\)\.?\s*)([^.]+(?:\.[^.]*?)?\.)\s(.*)$/);
  if (m && m[2].length < 260) return `${esc(m[1])}<b>${esc(m[2])}</b> ${esc(m[3])}`;
  const authorRun = /^((?:[A-Z][A-Za-z'’\-]+(?: [A-Z][A-Za-z'’\-]+)*,? [A-Z]{1,3}\.?(?:, | & |, & )?)+)\.\s(.*)$/;
  m = text.match(authorRun);
  if (m) {
    const rest = m[2];
    const t = rest.match(/^([^.]+(?:\.[^.]*?)?[.?])\s(.*)$/);
    if (t && t[1].length < 260) return `${esc(m[1])}. <b>${esc(t[1])}</b> ${esc(t[2])}`;
  }
  return esc(text);
}
const linkLabel = l => {
  const s = l.label.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (/^https?:/.test(s)) return /doi\.org/.test(l.href) ? 'DOI' : /youtube/.test(l.href) ? 'Video' : 'Link';
  return s === 'Article (PDF)' ? 'PDF' : s;
};

function renderPublications() {
  const sections = parsePublications(path.join(__dirname, 'content', 'publications.txt'));
  const total = sections.reduce((a, s) => a + s.entries.length, 0);
  const tabs = sections.map(s => `<li><label for="tab-${s.key}">${s.label}<small>${s.entries.length}</small></label></li>`).join('');
  const radios = sections.map((s, i) => `<input class="pub-radio" type="radio" name="pubtab" id="tab-${s.key}"${i === 0 ? ' checked' : ''}>`).join('');
  const panels = sections.map(s => {
    const groups = new Map();
    for (const e of s.entries) {
      const y = yearOf(e.text) || 'Undated';
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(e);
    }
    const rank = y => (y === 'In press' ? 1e5 : y === 'Undated' ? -1 : y);
    const years = [...groups.keys()].sort((a, b) => rank(b) - rank(a));
    const html = years.map(y => `<div class="year-group"><h3>${y}</h3><ul class="pubs">${groups.get(y).map(e =>
      `<li data-year="${y}"><span class="n">${e.n}</span><div class="cite"><p>${s.key === 'journals' || s.key === 'chapters' || s.key === 'conference' ? emphasiseTitle(cleanCitation(e.text)) : esc(cleanCitation(e.text))}</p>${e.links.length ? `<div class="links">${e.links.map(l => `<a href="${esc(l.href)}" rel="noopener">${esc(linkLabel(l))}</a>`).join('')}</div>` : ''}</div></li>`).join('')}</ul></div>`).join('');
    return `<div class="pub-panel" data-panel="${s.key}">${html}</div>`;
  }).join('');

  return {
    path: '/publications/', title: 'Publications',
    description: `${total} publications from the Dynamic Connectome Lab — journal articles, conference papers, book chapters and press coverage, searchable by year and keyword.`,
    head: `  <script src="/assets/js/publications.js" defer></script>\n`,
    body: `
<section class="hero-inner on-dark">
  <div class="wrap">
    <p class="kicker">Publications</p>
    <h1>Publications</h1>
    <p class="lede">${sections[0].entries.length} peer-reviewed articles since 2004, plus conference papers, book chapters and press coverage. Every PDF and link from the lab's list is kept.</p>
    <div class="actions"><a class="btn" href="https://scholar.google.co.uk/citations?user=Ha_ZNlkAAAAJ&amp;hl=en" rel="noopener">Google Scholar profile</a></div>
  </div>
</section>

<section>
  <div class="wrap pub-wrap">
    ${radios}
    <div class="pub-tools">
      <input type="search" id="pub-search" placeholder="Search authors, titles, journals, years…" aria-label="Search publications" autocomplete="off">
      <span class="pub-count" id="pub-count" aria-live="polite"></span>
    </div>
    <ul class="pub-tabs">${tabs}</ul>
    <div class="pub-body" id="pub-body">
      ${panels}
      <p class="pub-empty">Nothing matches that search in this list — try another tab or a shorter term.</p>
    </div>
  </div>
</section>
`,
  };
}

const PUB_JS = `// Publications search: filters the visible list by keyword; the tabs are CSS-only.
(function () {
  var input = document.getElementById('pub-search');
  var body = document.getElementById('pub-body');
  var count = document.getElementById('pub-count');
  if (!input || !body) return;
  var items = Array.prototype.slice.call(body.querySelectorAll('.pubs li'));
  var radios = Array.prototype.slice.call(document.querySelectorAll('.pub-radio'));
  function activePanel() {
    var r = radios.filter(function (x) { return x.checked; })[0];
    return r ? body.querySelector('[data-panel="' + r.id.replace('tab-', '') + '"]') : null;
  }
  function apply() {
    var q = input.value.trim().toLowerCase();
    var terms = q ? q.split(/\\s+/) : [];
    var shown = 0, panel = activePanel();
    items.forEach(function (li) {
      var t = li.textContent.toLowerCase();
      var ok = terms.every(function (w) { return t.indexOf(w) > -1; });
      li.hidden = !ok;
      if (ok && panel && panel.contains(li)) shown++;
    });
    body.querySelectorAll('.year-group').forEach(function (g) {
      g.style.display = g.querySelector('li:not([hidden])') ? '' : 'none';
    });
    body.classList.toggle('is-empty', shown === 0);
    var total = panel ? panel.querySelectorAll('li').length : items.length;
    count.textContent = q ? shown + ' of ' + total + ' shown' : total + ' entries';
  }
  input.addEventListener('input', apply);
  radios.forEach(function (r) { r.addEventListener('change', apply); });
  apply();
})();
`;

// ── Resources ───────────────────────────────────────────────────────────
const resources = {
  path: '/resources/', title: 'Resources',
  description: 'Lab facilities, open datasets (C. elegans, macaque cortex, highway and airline networks) and program code (VERTEX, BioDynaMo, SINOMO and more) from the Dynamic Connectome Lab.',
  body: `
<section class="hero-inner on-dark">
  <div class="wrap">
    <p class="kicker">Resources</p>
    <h1>Resources</h1>
    <p class="lede">What the lab works with, and what it shares: facilities, six datasets and eight code packages.</p>
  </div>
</section>

<section>
  <div class="wrap">
    <ul class="subnav" aria-label="On this page"><li><a href="#facilities">Lab facilities</a></li><li><a href="#datasets">Data sets</a></li><li><a href="#code">Program code</a></li></ul>
    <div class="section-head" id="facilities"><h2>Lab resources</h2></div>
    <div class="grid">
      <div class="card"><span class="tag">Stimulation</span><h3>Neuromodulation</h3>
        <p>Neuromodulation suite, next to the MRI Centre, with focused ultrasound (<a href="https://neurofus.com/" rel="noopener">NeuroFUS PRO</a>, one of three such systems at the university), vagus nerve ultrasound (NeurGear's <a href="https://zenbud.health/" rel="noopener">Zenbud</a>), transcranial magnetic stimulation (TMS), and temporal interference stimulation (TIS) neuromodulation systems.</p>
        <p>For testing ultrasound output, we also have a water tank, hydrophones, and a robotic system to scan for acoustic pressure. We are part of the leadership team of the 30-faculty <a href="https://www.nottingham.ac.uk/science/research/n3centre/n3centre.aspx" rel="noopener">N3 Centre for Neurotechnology, Neuromodulation, and Neurotherapeutics</a>.</p></div>
      <div class="card"><span class="tag">Imaging</span><h3>Neuroimaging and computing</h3>
        <p>We have access to several human MRI scanners (3T, 7T, 10.7T) and have our own 32-channel Ant-Neuro EEG system. We also have access to the Imaging HPC system which includes high-memory nodes and multiple compute nodes, along with storage, for data processing.</p>
        <p>The university is also hosting the <a href="https://mriuhf.ac.uk/" rel="noopener">National Centre for high-field MRI</a> including a 11.7T human MRI scanner.</p></div>
      <div class="card"><span class="tag">Testing</span><h3>Cognitive and physiological testing</h3>
        <p>The lab also includes facilities for assessing cognitive, psychometric, and physiological effects. This includes a Vive Pro Eye virtual reality system that allows for eye tracking and measurement of the pupil diameter. We can also look at physiological measures such as heart rate variability.</p></div>
    </div>
  </div>
</section>

<section class="band-panel">
  <div class="wrap">
    <div class="section-head" id="datasets"><h2>Data sets</h2><p class="muted">Please cite the source article when you use them</p></div>
    <h3>Development of C. elegans</h3>
    <div class="grid" style="margin:16px 0 36px">
      <div class="card"><span class="tag">Dataset</span><h3>C. elegans neuronal birth times</h3>
        <p>This zip file contains a comma-separated list (.csv) and a Matlab file (.mat) with the names of 279 neurones and their times of birth. Birth Time is in minutes obtained from Sulston et al. 1977 and 1983.</p>
        <div class="dl card-foot"><a href="https://www.dynamic-connectome.org/pubs/suppl/celegans279dev.zip" rel="noopener">celegans279dev.zip</a></div>
        <p class="cite-note">Cite: Varier S, Kaiser M (2011) Neural development features: Spatio-temporal development of the C. elegans neuronal network. PLoS Computational Biology 7:e1001044 (<a href="https://www.dynamic-connectome.org/pubs/Varier2011.pdf" rel="noopener">PDF</a>)</p></div>
    </div>
    <h3>Neuronal and cortical networks</h3>
    <div class="grid" style="margin:16px 0 36px">
      <div class="card"><span class="tag">Dataset</span><h3>Macaque cortical connectivity</h3>
        <p>Macaque cortical connectivity network within one hemisphere. The files include the adjacency matrix, the labels of the cortical regions, and the spatial positions of the regions as three-dimensional coordinates (the unit is mm).</p>
        <div class="dl card-foot"><a href="https://www.dynamic-connectome.org/pubs/suppl/mac95.mat" rel="noopener">mac95.mat</a><a href="https://www.dynamic-connectome.org/pubs/suppl/mac95.zip" rel="noopener">mac95.zip</a></div></div>
      <div class="card"><span class="tag">Dataset</span><h3>C. elegans local network</h3>
        <p>C. elegans local network of 131 frontal neurons. The files include the adjacency matrix, the labels of the neurons, and the spatial positions of the neurons as two-dimensional coordinates (unit is mm).</p>
        <div class="dl card-foot"><a href="https://www.dynamic-connectome.org/pubs/suppl/celegans131.mat" rel="noopener">celegans131.mat</a><a href="https://www.dynamic-connectome.org/pubs/suppl/celegans131.zip" rel="noopener">celegans131.zip</a></div></div>
      <div class="card"><span class="tag">Dataset</span><h3>C. elegans global network</h3>
        <p>C. elegans global network of 277 neurons. The files include the adjacency matrix, the labels of the neurons, and the spatial positions of the neurons as two-dimensional coordinates (unit is mm).</p>
        <div class="dl card-foot"><a href="https://www.dynamic-connectome.org/pubs/suppl/celegans277.mat" rel="noopener">celegans277.mat</a><a href="https://www.dynamic-connectome.org/pubs/suppl/celegans277.zip" rel="noopener">celegans277.zip</a></div></div>
    </div>
    <p class="cite-note" style="margin-bottom:36px">Cite: Kaiser M, Hilgetag CC (2006) Non-Optimal Component Placement, but Short Processing Paths, due to Long-Distance Projections in Neural Systems. PLoS Computational Biology 2:e95 (<a href="https://www.dynamic-connectome.org/pubs/Kaiser2006.pdf" rel="noopener">PDF</a>) · Kötter R (2004) Online retrieval, processing, and visualization of primate connectivity data from the CoCoMac database. Neuroinformatics 2:127-144 · Choe Y, McCormick BH, Koh W (2004) Network connectivity analysis on the temporally augmented C. elegans web: A pilot study. Society of Neuroscience Abstracts 30:921.9</p>
    <h3>Artificial networks</h3>
    <div class="grid" style="margin:16px 0 0">
      <div class="card"><span class="tag">Dataset</span><h3>German highway system</h3>
        <p>Contains Matlab file with the German highway system network (raw data from Autobahn-Informations-System, AIS from <a href="http://www.bast.de/" rel="noopener">www.bast.de</a>). It includes the adjacency matrix (value 1 if two locations are directly connected by a highway) and the labels of all 1,168 nodes.</p>
        <div class="dl card-foot"><a href="https://www.dynamic-connectome.org/download/autobahn.zip" rel="noopener">autobahn.zip</a></div>
        <p class="cite-note">Cite: Kaiser M., and Hilgetag C.-C. (2004) Spatial growth of real-world networks. Physical Review E 69:036103 (<a href="https://www.dynamic-connectome.org/pubs/Kaiser2004b.pdf" rel="noopener">PDF</a>)</p></div>
      <div class="card"><span class="tag">Dataset</span><h3>Flight connections, top 500 airports</h3>
        <p>Flight connections for the top 500 airports, based on total passenger volume, worldwide. The existence of flight connections between airports is based on flights within one year from 1 July 2007 to 30 June 2008. The zip file includes the matrix of connections between airports as well as a list of airport codes for each network node (csv files), and a Matlab .mat file with the same information.</p>
        <div class="dl card-foot"><a href="https://www.dynamic-connectome.org/pubs/suppl/air500.zip" rel="noopener">air500.zip</a></div>
        <p class="cite-note">Cite: Marcelino J. and Kaiser M. (2012) Critical paths in a metapopulation model of H1N1: Efficiently delaying influenza spreading through flight cancellation. PLoS Currents Influenza (<a href="https://www.dynamic-connectome.org/pubs/Marcelino2012PLoS_Currents.pdf" rel="noopener">PDF</a>)</p></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head" id="code"><h2>Program code</h2></div>
    <div class="grid-4">
      <div class="card"><span class="tag">Matlab / Octave</span><h3>VERTEX</h3><p>Matlab/Octave code for simulating activity and stimulation of brain tissue.</p><div class="dl card-foot"><a href="https://github.com/connectomelab/Vertex_git" rel="noopener">GitHub</a></div></div>
      <div class="card"><span class="tag">Platform</span><h3>BioDynaMo</h3><p>Environment for simulating tissue development.</p><div class="dl card-foot"><a href="https://biodynamo.org/" rel="noopener">biodynamo.org</a></div></div>
      <div class="card"><span class="tag">Matlab / Octave</span><h3>SINOMO — singular node motif detection</h3><p>Matlab/Octave code for detecting singular node motifs (characteristic nodes of a network). <a href="http://www.dynamic-connectome.org/pubs/suppl/sinomo/index.html" rel="noopener">Documentation of the routines</a>.</p><div class="dl card-foot"><a href="http://www.dynamic-connectome.org/pubs/suppl/sinomo/SINOMO.zip" rel="noopener">SINOMO.zip</a></div>
        <p class="cite-note">Cite: Echtermeyer C, Rodriguez F, Costa FdL, Kaiser M (2011). Automatic network fingerprinting through singular node motifs. PLoS ONE 6(1):e15765 (<a href="https://www.dynamic-connectome.org/pubs/Echtermeyer2011.pdf" rel="noopener">PDF</a>) and Costa LdF, Rodrigues FA, Hilgetag CC, Kaiser M (2009). Beyond the average: detecting global singular nodes from local features in complex networks. Europhysics Letters 87:18008 (<a href="https://www.dynamic-connectome.org/pubs/Costa2009EPL.PDF" rel="noopener">PDF</a>)</p></div>
      <div class="card"><span class="tag">Matlab</span><h3>Hierarchical networks</h3><p>Matlab code for generating hierarchical networks, simulating activity spreading, and calculating the proportion of simulation runs with limited sustained activity (LSA).</p><div class="dl card-foot"><a href="http://www.dynamic-connectome.org/pubs/suppl/Kaiser2010Frontiers.zip" rel="noopener">Kaiser2010Frontiers.zip</a></div>
        <p class="cite-note">Used for: Marcus Kaiser and Claus Hilgetag (2010). Optimal hierarchical modular topologies for producing limited sustained activation of neural networks. Frontiers in Neuroinformatics (<a href="https://www.dynamic-connectome.org/pubs/Kaiser2010Frontiers.pdf" rel="noopener">PDF</a>)</p></div>
      <div class="card"><span class="tag">Tool</span><h3>ADAPA</h3><p>Adapa is a free reusable tool to run parallel applications on multiple computing platforms, while being flexible enough to allow its users to use any familiar programming languages that they are acquainted with. The tool has been applied to the computation of correlation networks of multi-electrode array (MEA) recordings.</p><div class="dl card-foot"><a href="https://www.dynamic-connectome.org/pubs/suppl/ADAPA.zip" rel="noopener">ADAPA.zip</a></div>
        <p class="cite-note">See: Pedro Ribeiro, Jennifer Simonotto, Marcus Kaiser and Fernando Silva (2009). Parallel calculation of multi-electrode array correlation networks. Journal of Neuroscience Methods (<a href="https://www.dynamic-connectome.org/pubs/Ribeiro2009.PDF" rel="noopener">PDF</a>)</p></div>
      <div class="card"><span class="tag">Matlab</span><h3>Spatial growth script</h3><p>Matlab script for spatial networks generated by spatial growth.</p><div class="dl card-foot"><a href="https://www.dynamic-connectome.org/download/sng.m" rel="noopener">sng.m</a></div>
        <p class="cite-note">Algorithm: Kaiser M., and Hilgetag C.-C. (2004) Spatial growth of real-world networks. Physical Review E 69:036103 (<a href="https://www.dynamic-connectome.org/pubs/Kaiser2004b.pdf" rel="noopener">PDF</a>)</p></div>
      <div class="card"><span class="tag">Matlab</span><h3>Clustering coefficients &amp; small-world generation</h3><p>Matlab scripts for (1) the clustering coefficient definitions C1, C2, and C’, (2) the indirect definition disconnectedness D, and (3) the inverse generation of small-world networks starting with a random network instead of a regular network and therefore generating a higher percentage of leaf and isolated nodes.</p><div class="dl card-foot"><a href="https://www.dynamic-connectome.org/pubs/suppl/Kaiser2008NJP.zip" rel="noopener">Kaiser2008NJP.zip</a></div>
        <p class="cite-note">Algorithms: Kaiser M. (2008) Mean clustering coefficients – The role of isolated nodes and leafs on clustering measures for small-world networks. New Journal of Physics 10:083042 (<a href="https://www.dynamic-connectome.org/pubs/Kaiser2008NJP.pdf" rel="noopener">PDF</a>)</p></div>
    </div>
  </div>
</section>
`,
};

// ── Join us ─────────────────────────────────────────────────────────────
const joinUs = {
  path: '/join-us/', title: 'Join us',
  description: 'Internship, master’s, PhD and post-doc opportunities in the Dynamic Connectome Lab at the University of Nottingham, with funding routes by country.',
  body: `
<section class="hero-inner on-dark">
  <div class="wrap">
    <p class="kicker">Join us</p>
    <h1>Join the lab</h1>
    <p class="lede">Open positions will be announced soon. Follow the lab on X, Bluesky or LinkedIn to find out as soon as they are advertised — and get in touch if one of the interests below is yours.</p>
    <div class="actions">${socialList(['x', 'bluesky', 'linkedin'])}</div>
  </div>
</section>

<section>
  <div class="wrap two-col">
    <div>
      <p class="kicker">Research environment</p>
      <h2>The home of MRI</h2>
    </div>
    <div class="prose">
      <p>The University of Nottingham is the home of Magnetic Resonance Imaging (Nobel Prize for Sir Peter Mansfield in 2003). Our lab is part of the Precision Imaging Beacon which aims to become an internationally leading centre for imaging in precision medicine with a focus in chronic mental health disorders. The Beacon brings together researchers who develop novel medical imaging techniques with clinicians and scientists who use them.</p>
      <p>The wider research environment includes high-field MRI (11.7T), mobile MEG (OPM), and computational and mathematical neuroscience research.</p>
      <p><a class="link-arrow" href="/resources/">See the lab's facilities</a></p>
    </div>
  </div>
</section>

<section class="band-panel">
  <div class="wrap two-col">
    <div>
      <p class="kicker">What we look for</p>
      <h2>Research interests</h2>
      <p class="lede">In general, the lab would be interested in internship, PhD and PostDoc applicants along the following interests.</p>
    </div>
    <ul class="checks">
      <li>Experimental work using focused ultrasound neuromodulation to improve brain and mental health</li>
      <li>Simulating the effect of invasive and non-invasive brain stimulation</li>
      <li>Simulation of dynamics and development of large-scale human neural networks involving high-performance computing, cloud computing, and grid computing</li>
      <li>Analysis of structural and functional brain connectivity in human subjects; in particular of patients with developmental disorders leading to schizophrenia and (childhood-onset) epilepsy</li>
      <li>Development of novel tools for neuroimaging and connectome analysis</li>
    </ul>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head"><h2>Potential opportunities</h2><p class="muted">By career stage, with funding routes</p></div>
    <div class="grid-2">
      <div class="card"><span class="tag">Internship</span><h3>Internship</h3>
        <p>Internships are welcome. As there are currently no studentships available, you should bring funding from other sources. Internship students should visit for preferably three months or more to be able to engage in a challenging research project.</p>
        <p>UK undergraduate (including medical) students can apply for <a href="http://www.wellcome.ac.uk/Funding/Biomedical-science/Funding-schemes/PhD-funding-and-undergraduate-opportunities/WTD004448.htm" rel="noopener">Wellcome Trust Vacation Scholarships</a>. For students from Germany or other German-speaking countries, the <a href="http://www.bayer-foundations.com/en/bayer-scholarships.aspx" rel="noopener">Bayer scholarship</a> provides funding for study projects, internships, summer courses, preparatory and supplementary study courses, as well as theses and doctoral studies in the UK.</p></div>
      <div class="card"><span class="tag">MSc</span><h3>Master studies</h3>
        <p>Nottingham offers one-year master programmes in <a href="https://www.nottingham.ac.uk/pgstudy/course/taught/computational-neuroscience-cognition-and-ai-msc" rel="noopener">Computational Neuroscience, Cognition and AI MSc</a> and <a href="https://www.nottingham.ac.uk/pgstudy/course/taught/mental-health-research-and-practice-msc" rel="noopener">Mental Health</a>. Students in these programmes can undertake their master research project in the lab.</p></div>
      <div class="card"><span class="tag">PhD</span><h3>PhD studies</h3>
        <p>If you are looking for an interesting research project, you are encouraged to get in touch. Several possibilities for funding exist. There is a number of PhD studentships for international students available from the <a href="http://www.ncl.ac.uk/fms/postgrad/funding/ors.htm" rel="noopener">Overseas Research Students Awards Scheme</a> and <a href="http://www.findaphd.com/students/funding.asp" rel="noopener">other sources</a>.</p>
        <p>There are also master and PhD studentships for different countries including <a href="https://www.johnmonash.com/john-monash-scholars" rel="noopener">Australia</a>, <a href="http://www.canadianscholarshipfund.co.uk/" rel="noopener">Canada</a>, <a href="https://www.gov.uk/government/organisations/foreign-commonwealth-office/about#our-funding-programmes" rel="noopener">China</a>, <a href="http://cscuk.dfid.gov.uk/" rel="noopener">Commonwealth</a>, <a href="http://www.anglo-danishsociety.org.uk/scholarships" rel="noopener">Denmark</a>, <a href="http://www.britishcouncil.org/france-education-scholarships-entente-cordiale.htm" rel="noopener">France</a>, <a href="http://www.oreillyfoundation.ie/" rel="noopener">Ireland</a>, <a href="http://www.educationuk.org/" rel="noopener">Malaysia</a>, the USA (<a href="http://us.fulbrightonline.org/" rel="noopener">Fulbright</a> &amp; <a href="http://www.marshallscholarship.org/" rel="noopener">Marshall</a>), and <a href="https://www.canoncollins.org.uk/scholarship/our-scholarships" rel="noopener">Southern Africa</a>. There are studentships for female students provided by <a href="https://bfwg.org.uk/bfwg2/" rel="noopener">BFWG</a>.</p></div>
      <div class="card"><span class="tag">Post-doc</span><h3>Post-Doc</h3>
        <p>Two-year funding for non-UK residents with follow-on funding for continuing collaboration are provided as <a href="https://royalsociety.org/grants-schemes-awards/grants/newton-international/" rel="noopener">Newton Fellowships</a>. Short-term visits can be funded by the <a href="http://www.britishcouncil.org/science-research.htm" rel="noopener">British Council Research Collaboration Programme</a>. Also EPSRC offers <a href="https://epsrc.ukri.org/skills/fellows/overview/" rel="noopener">fellowships</a> to allow outstanding researchers up to 5 years full-time research; open to tenured/non tenured candidates, also international possible, who have a host university. Please get in touch if you are interested and eligible.</p>
        <p>There are programmes for researchers from the Netherlands (<a href="https://www.nwo.nl/en/funding/our-funding-instruments/nwo/rubicon/index.html" rel="noopener">Rubikon</a>), Austria (<a href="https://www.fwf.ac.at/en/research-funding/fwf-programmes/schroedinger-programme/" rel="noopener">Schrödinger Fellowships</a>), and Switzerland (<a href="http://www.snf.ch/en/funding/careers/postdoc-mobility/Pages/default.aspx" rel="noopener">postdoc.mobility</a>). Furthermore, research / training opportunities exist funded by the EU’s <a href="https://ec.europa.eu/research/mariecurieactions/" rel="noopener">Marie Curie programme</a>. These ‘International Incoming Fellowships’ are open to both EU and non-EU applicants.</p>
        <p>Another opportunity are <a href="http://www.fondationfyssen.fr/" rel="noopener">Fondation Fyssen</a> PostDoc Fellowships for French citizens or holders of a PhD degree from France. Research topics are neurobiological bases of cognitive processes, their embryonic and post-natal development, and their elementary mechanisms. These fellowships are intended to help young research scientists under 35 years of age. Short-term visits for Australian PostDocs and PhD students can be funded by the <a href="http://www.innovation.gov.au/InternationalEducation/EndeavourAwards/Pages/default.aspx" rel="noopener">Australian Government Fellowships</a>. Please contact the lab as soon as possible if you are interested in any of these fellowships.</p></div>
    </div>
  </div>
</section>

<section class="band-navy on-dark">
  <div class="wrap two-col">
    <div><p class="kicker">Next step</p><h2>Get in touch</h2><p class="lede">Write to Marcus Kaiser with a short note on your background and which of the interests above fits you.</p></div>
    <div class="actions" style="margin-top:0"><a class="btn" href="/contact/">Contact details</a><a class="btn btn-ghost" href="/publications/">Read recent papers</a></div>
  </div>
</section>
`,
};

// ── Contact ─────────────────────────────────────────────────────────────
const contact = {
  path: '/contact/', title: 'Contact',
  description: 'Contact the Dynamic Connectome Lab — Precision Imaging, School of Medicine, University of Nottingham, Queen’s Medical Centre, Nottingham NG7 2UH.',
  body: `
<section class="hero-inner on-dark">
  <div class="wrap">
    <p class="kicker">Contact</p>
    <h1>Contact</h1>
    <p class="lede">Precision Imaging, School of Medicine, University of Nottingham — at the Queen’s Medical Centre.</p>
  </div>
</section>

<section>
  <div class="wrap grid-2">
    <div class="card"><span class="tag">Write</span><h3>Email &amp; phone</h3>
      <p><a href="mailto:Marcus.Kaiser@nottingham.ac.uk">Marcus.Kaiser@nottingham.ac.uk</a> <span class="chip-confirm" title="Taken from the University of Nottingham staff listing, not from the lab site — please confirm">To confirm</span></p>
      <p><a href="tel:+441157486065">+44 (0) 115 748 6065</a> <span class="chip-confirm" title="Taken from the University of Nottingham staff listing, not from the lab site — please confirm">To confirm</span></p>
      <p class="muted small">Prospective interns, PhD candidates and post-docs: see <a href="/join-us/">Join us</a> first, then write with a short note on your background.</p></div>
    <div class="card"><span class="tag">Visit</span><h3>Address</h3>
      <address class="address">Precision Imaging<br>School of Medicine<br>University of Nottingham<br>QMC<br>Nottingham<br>NG7 2UH</address>
      <div class="dl card-foot"><a href="https://www.google.com/maps/search/?api=1&amp;query=52.943778,-1.186202" rel="noopener">Open in Google Maps</a><a href="https://www.openstreetmap.org/?mlat=52.943778&amp;mlon=-1.186202#map=16/52.943778/-1.186202" rel="noopener">OpenStreetMap</a></div></div>
  </div>
</section>

<section class="band-panel">
  <div class="wrap two-col">
    <div><p class="kicker">Elsewhere</p><h2>Follow the lab</h2><p class="lede">News, papers and open positions are posted on the lab's channels.</p></div>
    <div>${socialList()}
      <p style="margin-top:18px"><a href="https://www.dynamic-connectome.org/" rel="noopener">dynamic-connectome.org</a> — the lab's archive of PDFs, datasets and the PI's CV.</p></div>
  </div>
</section>
`,
};

// ── 404 ─────────────────────────────────────────────────────────────────
const notFound = {
  path: '/404.html', title: 'Page not found',
  description: 'That page is not here.',
  body: `
<section class="hero-inner on-dark">
  <div class="wrap">
    <p class="kicker">404</p>
    <h1>Not found</h1>
    <p class="lede">That page isn't here — a disconnected node. Try one of these.</p>
    <div class="actions"><a class="btn" href="/">Home</a><a class="btn btn-ghost" href="/publications/">Publications</a><a class="btn btn-ghost" href="/contact/">Contact</a></div>
  </div>
</section>
`,
};

module.exports = { renderPublications, PUB_JS, resources, joinUs, contact, notFound, parsePublications };
